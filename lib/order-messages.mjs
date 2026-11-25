import { store } from "./store-data.mjs";

// Ready-made WhatsApp messages the team sends by hand from the store's own
// WhatsApp. Nothing is sent automatically and no API key is involved.
export function whatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55[1-9]{2}\d{8,9}$/.test(digits)) return digits;
  if (/^[1-9]{2}\d{8,9}$/.test(digits)) return `55${digits}`;
  return null;
}
function firstName(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  return first ? `, ${first}` : "";
}
export function orderMessages(order, origin) {
  const hello = `Olá${firstName(order.customer_name)}! Aqui é a ${store.name}.`;
  const track = origin
    ? ` Acompanhe por aqui: ${origin}/pagamento/retorno?order_id=${encodeURIComponent(order.id)}`
    : "";
  const delivery = order.fulfillment_mode === "delivery";
  const eta =
    Number.isInteger(order.estimated_minutes) && order.estimated_minutes > 0
      ? ` A previsão de chegada é de cerca de ${order.estimated_minutes} minutos.`
      : "";
  return [
    {
      id: "confirmed",
      label: "Pedido confirmado",
      text: `${hello} Recebemos seu pedido ${order.id} e o pagamento foi aprovado. Já vamos separar seus produtos.${track}`,
    },
    {
      id: "ready",
      label: delivery ? "Separado e embalado" : "Pronto para retirar",
      text: delivery
        ? `${hello} Seu pedido ${order.id} foi separado e embalado. Avisamos assim que sair para entrega.${track}`
        : `${hello} Seu pedido ${order.id} está separado e pronto para retirada em ${store.address}.${track}`,
    },
    ...(delivery
      ? [
          {
            id: "out_for_delivery",
            label: "Saiu para entrega",
            text: `${hello} Seu pedido ${order.id} saiu para entrega!${eta}${track}`,
          },
        ]
      : []),
    {
      id: "completed",
      label: "Agradecer",
      text: `${hello} Obrigado pela sua compra! Se puder, conte o que achou dos produtos${origin ? ` em ${origin}/avaliacoes` : ""}. Até a próxima!`,
    },
  ];
}
export function contactMessage(order) {
  return `Olá${firstName(order.customer_name)}! Aqui é a ${store.name}, sobre o seu pedido ${order.id}.`;
}
export function whatsappLink(phone, text) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
