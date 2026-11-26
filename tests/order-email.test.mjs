import { test } from "node:test";
import assert from "node:assert/strict";
import { orderEmail } from "../lib/server/order-email.mjs";
const order = {
  id: "ORD-FIXTURE", customer_name: "Ana Silva", fulfillment_mode: "delivery",
  shipping_cents: 800, coupon_discount_cents: 200, coupon_code: "BEMVINDA",
  total_cents: 2800, cost_total_cents: 1753, staff_note: "private note", customer_email: "private@example.invalid",
  address: { street: "private address" },
  items: [
    { line_key: "a:100", title: "Aveia · 100 g", quantity: 2, unit_cents: 500, cost_unit_cents: 173 },
    { line_key: "combo:100|a", title: "Combo Temperos · Páprica · 100 g", quantity: 1, unit_cents: 700 },
    { line_key: "combo:100|b", title: "Combo Temperos · Orégano · 100 g", quantity: 1, unit_cents: 300 },
    { line_key: "shipping", product_id: "__shipping__", title: "Frete", quantity: 1, unit_cents: 800 },
  ],
};
test("transactional email groups combo components and uses only purchase prices", () => {
  const message = orderEmail(order, "paid", null, "https://loja.example/path");
  assert.equal(message.subject, "Pagamento confirmado! · Mundo Natural");
  assert.match(message.textContent, /2 × Aveia · 100 g — R\$\s10,00/);
  assert.match(message.textContent, /1 × Combo Temperos — R\$\s10,00/);
  assert.equal(message.textContent.match(/Combo Temperos/g).length, 1);
  assert.match(message.textContent, /Economia já incluída · BEMVINDA: R\$\s2,00/);
  assert.match(message.textContent, /Total pago: R\$\s28,00/);
  assert.match(message.htmlContent, /https:\/\/loja.example\/pagamento\/retorno/);
  assert.ok(message.htmlContent.includes("https://loja.example/pagamento/retorno?order_id=ORD-FIXTURE"));
  const second = orderEmail({ ...order, id: "ORD-ANOTHER" }, "paid", null, "https://loja.example");
  assert.ok(second.textContent.includes("https://loja.example/pagamento/retorno?order_id=ORD-ANOTHER"));
  assert.ok(!second.textContent.includes("order_id=ORD-FIXTURE"));
  assert.doesNotMatch(JSON.stringify(message), /private|1753|cost_unit|173|Páprica|Orégano/);
});
test("email escapes untrusted purchase text and uses safe tracking URLs", () => {
  const message = orderEmail({ ...order, customer_name: '<img/onerror="bad">',
    items: [{ line_key: "a", title: "<script>bad</script>", quantity: 1, unit_cents: 300 }] }, "paid", null, "javascript:alert(1)");
  assert.doesNotMatch(message.htmlContent, /<img|<script|javascript:|onerror="/);
  assert.match(message.htmlContent, /&lt;script&gt;/);
  assert.match(message.htmlContent, /https:\/\/mundonaturaltaboao.com.br\/pagamento\/retorno/);
  assert.doesNotMatch(message.htmlContent, /<img|tracking-pixel/);
});
test("pickup and delivery stages have precise content, ETA bounds and no invented money", () => {
  const pickup = orderEmail({ id: "fixture", fulfillment_mode: "pickup" }, "ready");
  assert.match(pickup.subject, /Tudo pronto para retirar/);
  assert.match(pickup.textContent, /Retirada na loja/);
  assert.doesNotMatch(pickup.textContent, /R\$|Total pago/);
  assert.match(orderEmail(order, "out_for_delivery", 25).textContent, /aproximadamente 25 minutos/);
  assert.doesNotMatch(orderEmail(order, "out_for_delivery", 241).textContent, /241 minutos/);
  assert.throws(() => orderEmail(order, "invented"));
});
