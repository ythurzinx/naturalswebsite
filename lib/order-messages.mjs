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

// Texts the team can edit in the admin panel. {campos} are filled in with
// the order data when the message is opened in WhatsApp.
export const MESSAGE_TEMPLATES = [
  { id: "confirmed", label: "Pagamento confirmado" },
  { id: "ready_delivery", label: "Separado e embalado (entrega)" },
  { id: "ready_pickup", label: "Pronto para retirar" },
  { id: "out_for_delivery", label: "Saiu para entrega" },
  { id: "completed", label: "Agradecimento" },
];
export const TEMPLATE_FIELDS = [
  { key: "saudacao", label: "Olá, nome!" },
  { key: "nome", label: "Primeiro nome" },
  { key: "loja", label: "Nome da loja" },
  { key: "itens", label: "Lista de itens" },
  { key: "valores", label: "Frete, cupom e total" },
  { key: "total", label: "Total pago" },
  { key: "recebimento", label: "Entrega ou retirada" },
  { key: "endereco", label: "Endereço" },
  { key: "previsao", label: "Previsão (minutos)" },
  { key: "telefone_loja", label: "Telefone da loja" },
  { key: "avaliacoes", label: "Link de avaliações" },
];
const hello = "{saudacao} Aqui é a {loja} 🌿";
const reply = "Qualquer dúvida, é só responder esta mensagem. 💚";
export const DEFAULT_TEMPLATES = Object.freeze({
  confirmed: `${hello}\n\n✅ Seu pagamento foi confirmado e já estamos separando seus produtos com carinho.\n\n*Seu pedido:*\n{itens}\n\n{valores}\n\n{recebimento}\n\n${reply}`,
  ready_delivery: `${hello}\n\n📦 Seu pedido foi separado e embalado. Avisamos assim que sair para entrega.\n\n*Seu pedido:*\n{itens}\n\n{recebimento}\n\n${reply}`,
  ready_pickup: `${hello}\n\n📦 Seu pedido está separado e pronto para retirada!\n\n*Seu pedido:*\n{itens}\n\n{recebimento}\n\nAtendimento: {telefone_loja}.\n\n${reply}`,
  out_for_delivery: `${hello}\n\n🛵 Seu pedido saiu para entrega!\n\n*Previsão de chegada:* cerca de {previsao} minutos.\n\n{recebimento}\n\n*Seu pedido:*\n{itens}\n\n{valores}\n\n${reply}`,
  completed: `${hello}\n\nMuito obrigado pela compra! Esperamos que goste dos produtos.\n\nSe puder, conte o que achou: {avaliacoes}\n\nAté a próxima! 💚`,
});
export function validateTemplates(input) {
  const ids = MESSAGE_TEMPLATES.map((t) => t.id);
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !ids.includes(key))
  )
    return null;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string") return null;
    const text = value.replace(/\r\n?/g, "\n").trim();
    if (
      text.length < 1 ||
      text.length > 2000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)
    )
      return null;
    output[key] = text;
  }
  return output;
}
export function renderTemplate(template, fields) {
  return template
    .replace(/\{([a-z_]+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : match,
    )
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function messageFields(order, origin = "") {
  const name = firstName(order.customer_name);
  const delivery = order.fulfillment_mode === "delivery";
  return {
    saudacao: `Olá${name ? `, ${name}` : ""}!`,
    nome: name,
    loja: store.name,
    itens: itemLines(order.items).join("\n"),
    valores: totals(order).join("\n"),
    total: money(order.total_cents),
    recebimento: delivery
      ? deliveryAddress(order)
        ? `*Entrega em:* ${deliveryAddress(order)}`
        : "*Entrega* no endereço informado."
      : `*Retirada na loja:* ${store.address}`,
    endereco: delivery ? deliveryAddress(order) : store.address,
    previsao:
      Number.isInteger(order.estimated_minutes) && order.estimated_minutes > 0
        ? String(order.estimated_minutes)
        : "",
    telefone_loja: store.phoneLabel,
    avaliacoes: `${origin || store.site}/avaliacoes`,
  };
}
export function orderMessages(order, origin = "", templates = {}) {
  const texts = { ...DEFAULT_TEMPLATES, ...templates };
  const fields = messageFields(order, origin);
  const delivery = order.fulfillment_mode === "delivery";
  const message = (id, template, label) => ({
    id,
    label,
    text: renderTemplate(texts[template], fields),
  });
  return [
    message("confirmed", "confirmed", "Pagamento confirmado"),
    delivery
      ? message("ready", "ready_delivery", "Separado e embalado")
      : message("ready", "ready_pickup", "Pronto para retirar"),
    ...(delivery
      ? [message("out_for_delivery", "out_for_delivery", "Saiu para entrega")]
      : []),
    message("completed", "completed", "Agradecer"),
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
