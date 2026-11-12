import { CheckoutError, reject } from "./errors.mjs";
import { verifyReference, digest } from "./crypto-state.mjs";
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
export function buildCheckout(input, catalog, policy, delivery = null) {
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
      "delivery",
      "phone",
      "notes",
      "whatsappOptIn",
    ]) ||
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > policy.maxDistinctLines
  )
    reject("INVALID_CART", "Revise os itens do carrinho.");
  if (
    !["pickup", "delivery"].includes(input.fulfillment) ||
    (input.fulfillment === "delivery" && !delivery) ||
    (input.fulfillment === "pickup" && input.delivery !== undefined)
  )
    reject(
      "DELIVERY_QUOTE_REQUIRED",
      "Calcule e confirme o frete antes de pagar pela entrega.",
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
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const phone =
    typeof input.phone === "string" ? input.phone.replace(/[ ()+-]/g, "") : "";
  if (
    (input.notes !== undefined && typeof input.notes !== "string") ||
    notes.length > 500 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(notes) ||
    (input.phone !== undefined && typeof input.phone !== "string") ||
    (phone && !/^(?:55)?[1-9]{2}\d{8,9}$/.test(phone)) ||
    ((input.fulfillment === "delivery" || policy.requireCustomerPhone) &&
      !phone) ||
    (input.whatsappOptIn !== undefined &&
      typeof input.whatsappOptIn !== "boolean") ||
    (input.whatsappOptIn === true && !phone)
  )
    reject(
      "INVALID_CONTACT",
      "Revise seu telefone e as observações do pedido.",
    );
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
    if (product.combo) {
      if (
        product.combo.reduce(
          (sum, component) => sum + component.unitCents,
          0,
        ) !== unitCents
      )
        reject(
          "PRODUCT_UNAVAILABLE",
          "Atualize a página para conferir este combo.",
          409,
        );
      for (const component of product.combo) {
        const key = `${product.id}|${component.productId}:${component.weight}`;
        const quantity = item.quantity + (rows.get(key)?.quantity || 0);
        if (quantity > policy.maxQuantityPerLine)
          reject(
            "INVALID_CART",
            "A quantidade por combo excede o limite permitido.",
          );
        rows.set(key, {
          id: component.productId,
          key,
          title:
            `${product.nome_produto} · ${component.name} · ${component.weight} g`.slice(
              0,
              200,
            ),
          quantity,
          unitCents: component.unitCents,
        });
      }
      continue;
    }
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
  if (rows.size > 49)
    reject(
      "CART_LIMIT",
      "Seu carrinho tem muitos ingredientes. Divida a compra em dois pedidos.",
      409,
    );
  const items = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.unitCents * item.quantity,
    0,
  );
  let shippingCents = 0;
  if (input.fulfillment === "delivery") {
    const fingerprint = digest(
      JSON.stringify(
        items.map((i) => ({
          key: i.key,
          quantity: i.quantity,
          unitCents: i.unitCents,
        })),
      ),
    );
    if (
      delivery.subtotalCents !== subtotalCents ||
      delivery.fingerprint !== fingerprint ||
      !Number.isSafeInteger(delivery.feeCents) ||
      delivery.feeCents < 0
    )
      reject(
        "SHIPPING_CART_CHANGED",
        "Sua seleção mudou. Calcule o frete novamente antes de pagar.",
        409,
      );
    shippingCents = delivery.feeCents;
    if (shippingCents > 0)
      items.push({
        id: "__shipping__",
        key: "__shipping__:0",
        title: "Entrega · frete estimado entre CEPs",
        quantity: 1,
        unitCents: shippingCents,
      });
  }
  const totalCents = subtotalCents + shippingCents;
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
  return {
    items,
    totalCents,
    name,
    email,
    fulfillment: input.fulfillment,
    phone,
    notes,
    whatsappOptIn: input.whatsappOptIn === true,
    shippingCents,
    ...(delivery ? { delivery } : {}),
  };
}
export function verifyOrder(order, key, expected, environment) {
  const ref = verifyReference(key, order?.external_reference);
  const validId =
    typeof order?.id === "string" && orderIdPattern.test(order.id);
  const checks = [
    ["MPV01", "id", validId],
    ["MPV02", "type", order?.type === "online"],
    ["MPV03", "processing_mode", order?.processing_mode === "manual"],
    ["MPV04", "currency", order?.currency === "BRL"],
    ["MPV05", "country_code", order?.country_code === "BRA"],
    ["MPV06", "reference", !!ref],
    ["MPV07", "amount", !!ref && cents(order?.total_amount) === ref.totalCents],
    [
      "MPV08",
      "environment",
      validId &&
        (environment === "production"
          ? !order.id.startsWith("ORDTST")
          : environment === "test" && order.id.startsWith("ORDTST")),
    ],
    [
      "MPV09",
      "expected_order",
      !expected ||
        (order?.id === expected.id &&
          order?.external_reference === expected.ref &&
          ref?.totalCents === expected.totalCents),
    ],
  ];
  const failures = checks.filter(([, , ok]) => !ok);
  if (failures.length) {
    const error = new CheckoutError(
      "ORDER_VERIFICATION_FAILED",
      failures[0][0] === "MPV08"
        ? "O pagamento está indisponível. A loja precisa revisar o ambiente do Mercado Pago."
        : "Não foi possível validar este pedido. Fale com o atendimento.",
      502,
    );
    // Diagnostics use fixed labels and allowlisted classifications, never raw
    // payloads, payer data, signed references, client tokens or credentials.
    error.supportCode = failures[0][0];
    error.validationChecks = failures.map(([, name]) => name);
    const safeEnum = (value, allowed) =>
      allowed.includes(value)
        ? value
        : value == null
          ? "missing"
          : "unexpected";
    error.validationContext = {
      environment: validId
        ? order.id.startsWith("ORDTST")
          ? "test"
          : "production"
        : "unknown",
      currency: safeEnum(order?.currency, [
        "BRL",
        "USD",
        "ARS",
        "MXN",
        "CLP",
        "COP",
        "PEN",
        "UYU",
      ]),
      country: safeEnum(order?.country_code, [
        "BRA",
        "BR",
        "USA",
        "US",
        "ARG",
        "AR",
        "MEX",
        "MX",
        "CHL",
        "CL",
        "COL",
        "CO",
        "PER",
        "PE",
        "URY",
        "UY",
      ]),
    };
    throw error;
  }
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
