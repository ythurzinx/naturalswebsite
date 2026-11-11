import { reject } from "./errors.mjs";
import { verifyReference } from "./crypto-state.mjs";
import { isBulkWeight, portionPriceCents } from "../pricing.mjs";
export const orderIdPattern = /^ORD[A-Z0-9]{8,64}$/;
export function cents(value) {
  if (typeof value !== "string" || !/^\d{1,9}(?:\.\d{1,2})?$/.test(value))
    return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function money(value) {
  return (value / 100).toFixed(2);
}
function strictObject(value, allowed) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}
export function buildCheckout(input, catalog, policy) {
  if (!policy.pricesConfirmedByMerchant || !policy.onlinePickupEnabled)
    reject(
      "SALES_DISABLED",
      "As vendas online estão temporariamente indisponíveis.",
      503,
    );
  if (
    !strictObject(input, [
      "items",
      "name",
      "email",
      "fulfillment",
      "expectedTotalCents",
    ]) ||
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > policy.maxDistinctLines
  )
    reject("INVALID_CART", "Revise os itens do carrinho.");
  if (input.fulfillment !== "pickup")
    reject(
      "DELIVERY_QUOTE_REQUIRED",
      "Para entrega, confirme o frete pelo atendimento antes de pagar.",
      409,
    );
  const name =
    typeof input.name === "string" ? input.name.trim().normalize("NFC") : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (
    name.length < 2 ||
    name.length > 80 ||
    /[\x00-\x1f\x7f<>]/.test(name) ||
    email.length > 180 ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
  )
    reject("INVALID_CUSTOMER", "Informe seu nome e um e-mail válido.");
  const lookup = new Map(catalog.map((p) => [p.id, p])),
    rows = new Map();
  for (const item of input.items) {
    if (
      !strictObject(item, ["id", "quantity", "weight"]) ||
      typeof item.id !== "string" ||
      item.id.length > 80 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > policy.maxQuantityPerLine
    )
      reject("INVALID_CART", "Quantidade ou produto inválido.");
    const product = lookup.get(item.id);
    if (!product || policy.disabledProductIds.includes(product.id))
      reject(
        "PRODUCT_UNAVAILABLE",
        "Um produto não está disponível. Revise sua seleção.",
        409,
      );
    const weight = product.isGranel ? item.weight : 0;
    if (
      (product.isGranel && !isBulkWeight(weight)) ||
      (!product.isGranel && item.weight !== undefined && item.weight !== 0)
    )
      reject(
        "INVALID_WEIGHT",
        "Escolha o peso de 100 em 100 g, entre 100 g e 5.000 g.",
      );
    const base = Math.round(product.valor_unitario * 100);
    if (!Number.isSafeInteger(base) || base <= 0)
      reject(
        "PRODUCT_UNAVAILABLE",
        "Produto temporariamente indisponível.",
        409,
      );
    const unitCents = portionPriceCents(product, weight);
    if (unitCents < 1)
      reject(
        "INVALID_AMOUNT",
        "A porção selecionada não pode ser vendida online.",
      );
    const key = `${product.id}:${weight}`,
      prior = rows.get(key);
    const quantity = item.quantity + (prior?.quantity || 0);
    if (quantity > policy.maxQuantityPerLine)
      reject(
        "INVALID_CART",
        "A quantidade por item excede o limite permitido.",
      );
    rows.set(key, {
      id: product.id,
      key,
      title:
        `${product.nome_produto} · ${product.isGranel ? `${weight} g` : product.peso_produto}`.slice(
          0,
          200,
        ),
      quantity,
      unitCents,
    });
  }
  const items = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  const totalCents = items.reduce(
    (sum, item) => sum + item.unitCents * item.quantity,
    0,
  );
  if (
    !Number.isSafeInteger(totalCents) ||
    totalCents < 100 ||
    totalCents > policy.maxOrderCents
  )
    reject(
      "ORDER_LIMIT",
      "O total está fora dos limites de pagamento online. Fale com a equipe.",
      409,
    );
  if (
    !Number.isSafeInteger(input.expectedTotalCents) ||
    input.expectedTotalCents !== totalCents
  )
    reject(
      "PRICE_CHANGED",
      "Os valores da seleção mudaram. Atualize a página e confira o total antes de pagar.",
      409,
    );
  return { items, totalCents, name, email, fulfillment: "pickup" };
}
export function verifyOrder(order, key, expected, environment) {
  const ref = verifyReference(key, order?.external_reference);
  if (
    !order ||
    !orderIdPattern.test(order.id) ||
    order.type !== "online" ||
    order.processing_mode !== "manual" ||
    order.currency !== "BRL" ||
    order.country_code !== "BRA" ||
    !ref ||
    cents(order.total_amount) !== ref.totalCents ||
    (environment === "production" && order.id.startsWith("ORDTST")) ||
    (environment === "test" && !order.id.startsWith("ORDTST"))
  )
    reject(
      "ORDER_VERIFICATION_FAILED",
      "Não foi possível validar este pedido. Fale com o atendimento.",
      502,
    );
  if (
    expected &&
    (order.id !== expected.id ||
      order.external_reference !== expected.ref ||
      ref.totalCents !== expected.totalCents)
  )
    reject(
      "ORDER_VERIFICATION_FAILED",
      "Não foi possível validar este pedido.",
      502,
    );
  return ref;
}
export function paymentState(order) {
  if (
    order.status === "processed" &&
    order.status_detail === "accredited" &&
    cents(order.total_paid_amount) === cents(order.total_amount)
  )
    return "paid";
  if (
    order.status === "refunded" ||
    order.status_detail === "partially_refunded"
  )
    return "refunded";
  if (order.status === "canceled") return "canceled";
  if (order.status === "failed") return "failed";
  return "pending";
}
export function validateCheckoutUrl(value, orderId) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      ["www.mercadopago.com.br", "mercadopago.com.br"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/checkout/v1/redirect" &&
      url.searchParams.get("order_id") === orderId
    )
      return url.toString();
  } catch {}
  reject(
    "INVALID_CHECKOUT_URL",
    "O serviço de pagamento retornou uma resposta inválida. Tente novamente.",
    502,
  );
}
