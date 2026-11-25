import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactMessage,
  orderMessages,
  whatsappLink,
  whatsappPhone,
} from "../lib/order-messages.mjs";

const order = {
  id: "ORD01ABCDEF123",
  customer_name: "Maria da Silva",
  fulfillment_mode: "delivery",
  fulfillment_status: "out_for_delivery",
  estimated_minutes: 25,
};

test("customer phones become WhatsApp numbers with the Brazilian prefix", () => {
  assert.equal(whatsappPhone("(11) 99999-8888"), "5511999998888");
  assert.equal(whatsappPhone("5511999998888"), "5511999998888");
  assert.equal(whatsappPhone("1133334444"), "551133334444");
  for (const value of ["", null, "123", "0011999998888", "abc"])
    assert.equal(whatsappPhone(value), null);
});

test("delivery orders get confirmation, ready, out-for-delivery and thanks messages", () => {
  const messages = orderMessages(order, "https://loja.example");
  assert.deepEqual(
    messages.map((m) => m.id),
    ["confirmed", "ready", "out_for_delivery", "completed"],
  );
  const [confirmed, ready, out, thanks] = messages.map((m) => m.text);
  assert.match(confirmed, /^Olá, Maria! Aqui é a Mundo Natural\. Recebemos seu pedido ORD01ABCDEF123/);
  assert.match(confirmed, /https:\/\/loja\.example\/pagamento\/retorno\?order_id=ORD01ABCDEF123$/);
  assert.match(ready, /separado e embalado/);
  assert.match(out, /saiu para entrega! A previsão de chegada é de cerca de 25 minutos\./);
  assert.match(thanks, /https:\/\/loja\.example\/avaliacoes/);
  // Only the first name; no surname, address, phone or e-mail.
  assert.ok(messages.every((m) => !/Silva|@|99999/.test(m.text)));
});

test("pickup orders skip the delivery message and point to the store", () => {
  const messages = orderMessages(
    { ...order, fulfillment_mode: "pickup", estimated_minutes: null },
    "",
  );
  assert.deepEqual(
    messages.map((m) => m.id),
    ["confirmed", "ready", "completed"],
  );
  assert.match(messages[1].text, /pronto para retirada em Rua José Duarte Souza, 21/);
  assert.ok(messages.every((m) => !m.text.includes("Acompanhe")));
  assert.equal(
    contactMessage({ ...order, customer_name: "" }),
    "Olá! Aqui é a Mundo Natural, sobre o seu pedido ORD01ABCDEF123.",
  );
  assert.equal(
    whatsappLink("5511999998888", "Olá & tchau"),
    "https://wa.me/5511999998888?text=Ol%C3%A1%20%26%20tchau",
  );
});
