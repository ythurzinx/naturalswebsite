import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactMessage,
  customerToStoreMessage,
  itemLines,
  renderTemplate,
  validateTemplates,
  orderMessages,
  whatsappLink,
  whatsappPhone,
} from "../lib/order-messages.mjs";

test("copied Markdown becomes WhatsApp bold without changing emojis or inserted customer data", () => {
  const template = String.raw`{saudacao} 🌿
\***{loja}**\*
✅ **PAGAMENTO CONFIRMADO!** 💚
📦 {itens}`;
  const fields = {
    saudacao: "Olá, João!",
    loja: "Mundo Natural",
    itens: "• 1× Aveia · 100 g",
  };
  const expected = "Olá, João! 🌿\n*Mundo Natural*\n✅ *PAGAMENTO CONFIRMADO!* 💚\n📦 • 1× Aveia · 100 g";
  const text = renderTemplate(template, fields);
  assert.equal(text, expected);
  assert.equal(new URL(whatsappLink("5511999998888", text)).searchParams.get("text"), expected);
  assert.equal(validateTemplates({ confirmed: "**Olá!** 🌿" }).confirmed, "*Olá!* 🌿");
  assert.equal(renderTemplate("**{nome}**", { nome: "**João**" }), "***João***");
});

test("templates reject already lost Unicode and unpaired surrogates without rejecting valid emoji sequences", () => {
  for (const text of ["Olá �", "Olá \ud83c", "Olá \udf3f"])
    assert.equal(validateTemplates({ confirmed: text }), null);
  const text = "✅ 🌿 💚 📦 🚚 ☎️ 👩🏽‍🍳 Família 👨‍👩‍👧‍👦 – Taboão";
  assert.equal(validateTemplates({ confirmed: text }).confirmed, text);
});

const order = {
  id: "ORD01M88MFKDYAZER4GESSR22EGTT",
  customer_name: "Maria da Silva",
  customer_phone: "11999998888",
  fulfillment_mode: "delivery",
  fulfillment_status: "out_for_delivery",
  estimated_minutes: 25,
  shipping_cents: 1340,
  total_cents: 9420,
  coupon_code: "INAUGURA10",
  coupon_discount_cents: 420,
  address: {
    street: "Rua das Magnólias",
    number: "22",
    complement: "Apto 2",
    neighborhood: "Parque Assunção",
    city: "Taboão da Serra",
    state: "SP",
    postalCode: "06754100",
  },
  items: [
    { line_key: "prod-270:300", product_id: "prod-270", title: "Castanha de Caju Crua · 300 g", quantity: 2, unit_cents: 3600 },
    { line_key: "combo-mix|prod-275:100", product_id: "prod-275", title: "Combo energia natural · Farinha de Uva · 100 g", quantity: 1, unit_cents: 532 },
    { line_key: "combo-mix|prod-276:100", product_id: "prod-276", title: "Combo energia natural · Farinha de Beterraba · 100 g", quantity: 1, unit_cents: 1273 },
    { line_key: "__shipping__:0", product_id: "__shipping__", title: "Entrega", quantity: 1, unit_cents: 1340 },
  ],
};

test("customer phones become WhatsApp numbers with the Brazilian prefix", () => {
  assert.equal(whatsappPhone("(11) 99999-8888"), "5511999998888");
  assert.equal(whatsappPhone("5511999998888"), "5511999998888");
  assert.equal(whatsappPhone("1133334444"), "551133334444");
  for (const value of ["", null, "123", "0011999998888", "abc"])
    assert.equal(whatsappPhone(value), null);
});

test("item lists show what was bought, with each combo once and no shipping line", () => {
  assert.deepEqual(itemLines(order.items), [
    "• 2× Castanha de Caju Crua · 300 g",
    "• 1× Combo energia natural",
  ]);
  const many = Array.from({ length: 30 }, (_, i) => ({
    line_key: `p${i}:100`,
    product_id: `p${i}`,
    title: `Item ${i}`,
    quantity: 1,
  }));
  const lines = itemLines(many);
  assert.equal(lines.length, 26);
  assert.equal(lines.at(-1), "• … e mais 5 itens");
});

test("store messages list the items, totals and address instead of the order number", () => {
  const messages = orderMessages(order, "https://loja.example");
  assert.deepEqual(
    messages.map((m) => m.id),
    ["confirmed", "ready", "out_for_delivery", "completed"],
  );
  const [confirmed, ready, out, thanks] = messages.map((m) => m.text);
  assert.match(confirmed, /^Olá, Maria! Aqui é a Mundo Natural 🌿/);
  assert.match(confirmed, /Seu pagamento foi confirmado/);
  assert.match(confirmed, /• 2× Castanha de Caju Crua · 300 g\n• 1× Combo energia natural/);
  assert.match(confirmed, /Frete: R\$ 13,40\nCupom INAUGURA10: −R\$ 4,20\nTotal pago: R\$ 94,20/);
  assert.match(confirmed, /\*Entrega em:\* Rua das Magnólias, 22 \(Apto 2\) — Parque Assunção/);
  assert.match(ready, /separado e embalado/);
  assert.match(out, /saiu para entrega!\n\n\*Previsão de chegada:\* cerca de 25 minutos\./);
  assert.match(thanks, /https:\/\/loja\.example\/avaliacoes/);
  for (const text of [confirmed, ready, out, thanks]) {
    assert.ok(!text.includes("ORD01M88"), "sem número do pedido no texto");
    assert.ok(!/Silva|@|99999/.test(text), "sem sobrenome, e-mail ou telefone");
  }
});

test("pickup orders point to the store and skip the delivery message", () => {
  const messages = orderMessages(
    { ...order, fulfillment_mode: "pickup", shipping_cents: 0, address: null },
    "",
  );
  assert.deepEqual(
    messages.map((m) => m.id),
    ["confirmed", "ready", "completed"],
  );
  assert.match(messages[1].text, /pronto para retirada!/);
  assert.match(messages[1].text, /\*Retirada na loja:\* Rua José Duarte Souza, 21/);
  assert.ok(messages.every((m) => !m.text.includes("Acompanhe") && !m.text.includes("Frete")));
  assert.match(contactMessage(order), /Sobre o seu pedido:\n• 2× Castanha/);
  assert.equal(
    whatsappLink("5511999998888", "Olá & tchau"),
    "https://api.whatsapp.com/send?phone=5511999998888&text=Ol%C3%A1%20%26%20tchau",
  );
});

test("the customer writes to the store with the items, not the order code", () => {
  const text = customerToStoreMessage({
    firstName: "Maria",
    items: order.items,
    shippingCents: 1340,
    totalCents: 9420,
    fulfillment: "delivery",
    paid: true,
  });
  assert.equal(
    text,
    [
      "Olá, Mundo Natural! 🌿",
      "",
      "Sou Maria e fiz um pedido pelo site:",
      "• 2× Castanha de Caju Crua · 300 g",
      "• 1× Combo energia natural",
      "",
      "Frete: R$ 13,40",
      "Total: R$ 94,20",
      "Recebimento: entrega",
      "Pagamento: confirmado",
      "",
      "Gostaria de falar sobre ele.",
    ].join("\n"),
  );
});

test("edited templates fill the order fields and are validated before saving", async () => {
  const { renderTemplate, validateTemplates, DEFAULT_TEMPLATES } = await import(
    "../lib/order-messages.mjs"
  );
  const custom = {
    confirmed: "Oi {nome}! Seu total ficou {total}.\n\n\n{itens}\n{desconhecido}",
  };
  const [confirmed, ready] = orderMessages(order, "", custom);
  assert.equal(
    confirmed.text,
    "Oi Maria! Seu total ficou R$ 94,20.\n\n• 2× Castanha de Caju Crua · 300 g\n• 1× Combo energia natural\n{desconhecido}",
  );
  // Templates not edited keep the default text.
  assert.match(ready.text, /separado e embalado/);
  assert.equal(
    renderTemplate("{saudacao} {previsao}", { saudacao: "Olá!", previsao: "" }),
    "Olá!",
  );
  assert.deepEqual(validateTemplates({ confirmed: "  Oi {nome}\r\n" }), {
    confirmed: "Oi {nome}",
  });
  for (const bad of [
    null,
    [],
    { outro: "x" },
    { confirmed: "" },
    { confirmed: 5 },
    { confirmed: "x".repeat(2001) },
    { confirmed: "tem\u0000controle" },
  ])
    assert.equal(validateTemplates(bad), null);
  assert.ok(Object.keys(DEFAULT_TEMPLATES).length === 5);
});
