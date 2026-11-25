import { store } from "./store-data.mjs";

// Ready-made WhatsApp messages the team sends by hand from the store's own
// WhatsApp. Nothing is sent automatically and no API key is involved.
export function whatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55[1-9]{2}\d{8,9}$/.test(digits)) return digits;
  if (/^[1-9]{2}\d{8,9}$/.test(digits)) return `55${digits}`;
  return null;
}
const money = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(cents / 100)
    .replace(/ /g, " ");
function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}
// Combo ingredients are stored as separate lines ("combo|product:weight");
// the customer bought one combo, so it is listed once.
export function itemLines(items = [], limit = 25) {
  const lines = [],
    combos = new Set();
  for (const item of items) {
    if (item.product_id === "__shipping__") continue;
    const key = String(item.line_key || "");
    if (key.includes("|")) {
      const combo = key.split("|")[0];
      if (combos.has(combo)) continue;
      combos.add(combo);
      lines.push(`• ${item.quantity}× ${String(item.title).split(" · ")[0]}`);
      continue;
    }
    lines.push(`• ${item.quantity}× ${item.title}`);
  }
  return lines.length > limit
    ? [...lines.slice(0, limit), `• … e mais ${lines.length - limit} itens`]
    : lines;
}
function totals(order) {
  return [
    order.shipping_cents > 0 ? `Frete: ${money(order.shipping_cents)}` : "",
    order.coupon_code && order.coupon_discount_cents
      ? `Cupom ${order.coupon_code}: −${money(order.coupon_discount_cents)}`
      : "",
    `Total pago: ${money(order.total_cents)}`,
  ].filter(Boolean);
}
function deliveryAddress(order) {
  const a = order.address;
  if (!a) return "";
  return `${a.street}, ${a.number}${a.complement ? ` (${a.complement})` : ""} — ${a.neighborhood}`;
}
const compose = (...blocks) =>
  blocks
    .map((block) => (Array.isArray(block) ? block.filter(Boolean).join("\n") : block))
    .filter(Boolean)
    .join("\n\n");

export function orderMessages(order, origin = "") {
  const name = firstName(order.customer_name);
  const hello = `Olá${name ? `, ${name}` : ""}! Aqui é a ${store.name} 🌿`;
  const delivery = order.fulfillment_mode === "delivery";
  const items = ["*Seu pedido:*", ...itemLines(order.items)];
  const receive = delivery
    ? deliveryAddress(order)
      ? `*Entrega em:* ${deliveryAddress(order)}`
      : "*Entrega* no endereço informado."
    : `*Retirada na loja:* ${store.address}`;
  const eta =
    Number.isInteger(order.estimated_minutes) && order.estimated_minutes > 0
      ? `*Previsão de chegada:* cerca de ${order.estimated_minutes} minutos.`
      : "";
  const reply = "Qualquer dúvida, é só responder esta mensagem. 💚";
  return [
    {
      id: "confirmed",
      label: "Pagamento confirmado",
      text: compose(
        hello,
        "✅ Seu pagamento foi confirmado e já estamos separando seus produtos com carinho.",
        items,
        totals(order),
        receive,
        reply,
      ),
    },
    {
      id: "ready",
      label: delivery ? "Separado e embalado" : "Pronto para retirar",
      text: delivery
        ? compose(
            hello,
            "📦 Seu pedido foi separado e embalado. Avisamos assim que sair para entrega.",
            items,
            receive,
            reply,
          )
        : compose(
            hello,
            "📦 Seu pedido está separado e pronto para retirada!",
            items,
            receive,
            `Atendimento: ${store.phoneLabel}.`,
            reply,
          ),
    },
    ...(delivery
      ? [
          {
            id: "out_for_delivery",
            label: "Saiu para entrega",
            text: compose(
              hello,
              "🛵 Seu pedido saiu para entrega!",
              eta,
              receive,
              items,
              totals(order),
              reply,
            ),
          },
        ]
      : []),
    {
      id: "completed",
      label: "Agradecer",
      text: compose(
        hello,
        delivery
          ? "Seu pedido foi entregue. Muito obrigado pela preferência!"
          : "Obrigado por retirar seu pedido. Muito obrigado pela preferência!",
        origin
          ? `Se puder, conte o que achou dos produtos: ${origin}/avaliacoes`
          : "",
        "Até a próxima! 💚",
      ),
    },
  ];
}
export function contactMessage(order) {
  const name = firstName(order.customer_name);
  return compose(
    `Olá${name ? `, ${name}` : ""}! Aqui é a ${store.name} 🌿`,
    ["Sobre o seu pedido:", ...itemLines(order.items)],
    order.fulfillment_mode === "delivery"
      ? "Podemos combinar o horário da entrega?"
      : "Podemos combinar o horário da retirada?",
  );
}
// Message the customer sends to the store from the order page.
export function customerToStoreMessage(summary) {
  const lines = ["Olá, Mundo Natural! 🌿"];
  const intro = summary.firstName
    ? `Sou ${summary.firstName} e fiz um pedido pelo site:`
    : "Fiz um pedido pelo site:";
  return compose(
    lines,
    [intro, ...itemLines(summary.items)],
    [
      summary.shippingCents > 0 ? `Frete: ${money(summary.shippingCents)}` : "",
      `Total: ${money(summary.totalCents)}`,
      summary.fulfillment === "delivery" ? "Recebimento: entrega" : "Recebimento: retirada na loja",
      summary.paid ? "Pagamento: confirmado" : "Pagamento: aguardando confirmação",
    ],
    "Gostaria de falar sobre ele.",
  );
}
export function whatsappLink(phone, text) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
