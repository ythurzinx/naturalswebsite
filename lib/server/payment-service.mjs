import { randomUUID } from "node:crypto";
import {
  deriveKey,
  mac,
  seal,
  unseal,
  digest,
  equalSecret,
  externalReference,
} from "./crypto-state.mjs";
import {
  assertSameOrigin,
  readJson,
  readCookie,
  cookieValue,
  jsonResponse,
  safeFailure,
  RateLimiter,
} from "./http-security.mjs";
import { reject } from "./errors.mjs";
import {
  buildCheckout,
  cents,
  money,
  verifyOrder,
  paymentState,
  orderIdPattern,
  validateCheckoutUrl,
} from "./checkout-core.mjs";
import { createMercadoPagoClient } from "./mercado-pago.mjs";
import { verifyWebhookSignature } from "./webhook.mjs";

export function paymentConfiguration(env) {
  try {
    const accessToken = env.MERCADOPAGO_ACCESS_TOKEN || "";
    const rawOrigin = env.APP_URL || env.NEXT_PUBLIC_SITE_URL || "";
    const url = new URL(rawOrigin);
    const local =
      env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    const environment = env.MERCADOPAGO_ENV || "production";
    if (
      (!local && url.protocol !== "https:") ||
      (url.protocol !== "https:" && !local) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !/^APP_USR-[A-Za-z0-9_-]{24,1000}$/.test(accessToken) ||
      !["production", "test"].includes(environment)
    )
      return null;
    return {
      accessToken,
      origin: url.origin,
      secure: url.protocol === "https:",
      environment,
      webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || "",
    };
  } catch {
    return null;
  }
}

export function createPaymentService({
  catalog,
  catalogProvider = async () => catalog,
  repository = /** @type {import("./shop-repository.mjs").ShopRepository|null} */ (
    null
  ),
  policy,
  config,
  shipping = /** @type {ReturnType<typeof import("./shipping-service.mjs").createShippingService>|null} */ (
    null
  ),
  fetcher = fetch,
  now = () => Math.floor(Date.now() / 1000),
  limiter = new RateLimiter(),
}) {
  const key = config ? deriveKey(config.accessToken, config.origin) : null;
  const provider = config
    ? createMercadoPagoClient(config.accessToken, fetcher)
    : null;
  const prefix = config?.secure ? "__Host-" : "";
  const sessionName = `${prefix}mn-checkout`,
    orderName = `${prefix}mn-orders`;
  const safe =
    (handler) =>
    async (...args) => {
      try {
        return await handler(...args);
      } catch (error) {
        if (
          error?.code === "ORDER_VERIFICATION_FAILED" &&
          /^MPV0[1-9]$/.test(error.supportCode || "")
        ) {
          console.warn("[mercadopago.validation]", {
            supportCode: error.supportCode,
            failedChecks: error.validationChecks,
            received: error.validationContext,
          });
        }
        return safeFailure(error);
      }
    };
  function configured() {
    if (!config)
      reject(
        "PAYMENT_NOT_CONFIGURED",
        "O pagamento online ainda não está disponível. Você pode continuar pelo atendimento.",
        503,
      );
  }
  function context(request) {
    return unseal(key, "session", readCookie(request, sessionName), now());
  }
  function requireContext(request) {
    const session = context(request);
    if (
      !session ||
      typeof session.jti !== "string" ||
      !equalSecret(
        request.headers.get("x-csrf-token"),
        mac(key, "csrf", session.jti),
      )
    )
      reject(
        "CHECKOUT_SESSION_EXPIRED",
        "Atualize a página para iniciar uma sessão segura de pagamento.",
        403,
      );
    return session;
  }
  function ownedOrders(request) {
    const state = unseal(key, "orders", readCookie(request, orderName), now());
    return Array.isArray(state?.orders)
      ? state.orders
          .filter(
            (order) =>
              order &&
              orderIdPattern.test(order.id) &&
              typeof order.ref === "string" &&
              Number.isSafeInteger(order.totalCents) &&
              order.expires > now(),
          )
          .slice(-5)
      : [];
  }
  function newSession(request, rotate = false) {
    configured();
    assertSameOrigin(request, config.origin, rotate);
    limiter.take("global:session", 200, 60, now());
    if (rotate) requireContext(request);
    const existing = !rotate && context(request);
    const session =
      existing && typeof existing.jti === "string"
        ? existing
        : { jti: randomUUID() };
    const response = jsonResponse({
      available: true,
      csrfToken: mac(key, "csrf", session.jti),
      methods: ["pix", "card"],
      fulfillment: "pickup",
      testMode: config.environment === "test",
    });
    if (!existing)
      response.headers.append(
        "Set-Cookie",
        cookieValue(
          sessionName,
          seal(key, "session", session, now(), 3600),
          config.secure,
          3600,
        ),
      );
    return response;
  }
  const session = safe((request) => {
    if (!config)
      return jsonResponse({
        available: false,
        reason: "O pagamento online será liberado após a configuração da loja.",
      });
    return newSession(request);
  });
  const resetSession = safe((request) => newSession(request, true));
  const checkout = safe(async (request) => {
    configured();
    assertSameOrigin(request, config.origin);
    const session = requireContext(request);
    limiter.take("global:create", 60, 600, now());
    limiter.take(`create:${session.jti}`, 8, 600, now());
    const input = await readJson(request);
    const delivery =
      input?.fulfillment === "delivery" && shipping
        ? await shipping.resolveDelivery(input.delivery)
        : null;
    const selection = buildCheckout(
      input,
      await catalogProvider(),
      policy,
      delivery,
    );
    const idempotencyKey = mac(
      key,
      "idempotency",
      `${session.jti}:${digest(JSON.stringify(selection))}`,
    );
    const reference = externalReference(
      key,
      idempotencyKey.slice(0, 22),
      selection.totalCents,
    );
    const returnUrl = `${config.origin}/pagamento/retorno`;
    // Persist the address before contacting the provider so a webhook or retry
    // can recover delivery details even when the checkout response is lost.
    if (repository?.recordCheckoutIntent)
      await repository.recordCheckoutIntent(reference, selection);
    const order = await provider("/v1/orders", {
      method: "POST",
      idempotencyKey,
      body: {
        type: "online",
        processing_mode: "manual",
        capture_mode: "automatic_async",
        expiration_time: "P1D",
        total_amount: money(selection.totalCents),
        external_reference: reference,
        description:
          selection.fulfillment === "delivery"
            ? "Mundo Natural — entrega"
            : "Mundo Natural — retirada na loja",
        payer: { email: selection.email, first_name: selection.name },
        items: selection.items.map((item) => ({
          external_code: item.key,
          title: item.title,
          quantity: item.quantity,
          unit_price: money(item.unitCents),
        })),
        config: {
          online: {
            success_url: returnUrl,
            failure_url: returnUrl,
            pending_url: returnUrl,
            auto_return: "approved",
          },
          payment_method: { not_allowed_types: ["ticket", "atm"] },
        },
      },
    });
    verifyOrder(
      order,
      key,
      { id: order.id, ref: reference, totalCents: selection.totalCents },
      config.environment,
    );
    const checkoutUrl = validateCheckoutUrl(order.checkout_url, order.id);
    if (repository) await repository.recordOrder(order, selection);
    const prior = ownedOrders(request).filter((entry) => entry.id !== order.id);
    const orders = [
      ...prior,
      {
        id: order.id,
        ref: reference,
        totalCents: selection.totalCents,
        expires: now() + 7 * 86400,
      },
    ].slice(-5);
    const response = jsonResponse({
      checkoutUrl,
      orderId: order.id,
      totalCents: selection.totalCents,
    });
    response.headers.append(
      "Set-Cookie",
      cookieValue(
        orderName,
        seal(key, "orders", { orders }, now(), 7 * 86400),
        config.secure,
        7 * 86400,
      ),
    );
    return response;
  });
  const status = safe(async (request, id) => {
    configured();
    assertSameOrigin(request, config.origin, false);
    const orders = ownedOrders(request),
      owned =
        id === "current"
          ? orders.at(-1)
          : orders.find((entry) => entry.id === id);
    if (!owned)
      reject(
        "ORDER_NOT_FOUND",
        "Não encontramos um pedido acessível neste navegador. Fale com o atendimento se precisar de ajuda.",
        404,
      );
    limiter.take(`status:${owned.id}`, 15, 60, now());
    limiter.take("global:status", 300, 60, now());
    const order = await provider(`/v1/orders/${owned.id}`);
    verifyOrder(order, key, owned, config.environment);
    await persist(order);
    return jsonResponse({
      orderId: order.id,
      state: paymentState(order),
      totalCents: owned.totalCents,
      fulfillment: repository
        ? (await repository.order(order.id))?.fulfillment_mode || "pickup"
        : "pickup",
      testMode: config.environment === "test",
    });
  });
  const webhook = safe(async (request) => {
    if (!config?.webhookSecret || config.webhookSecret.length < 16)
      reject("NOT_FOUND", "Recurso não encontrado.", 404);
    const id = verifyWebhookSignature(request, config.webhookSecret, now());
    if (!id) reject("INVALID_SIGNATURE", "Notificação não autenticada.", 401);
    limiter.take("global:webhook", 300, 60, now());
    limiter.take(`webhook:${id}`, 20, 60, now());
    const event = await readJson(request, 32000);
    if (
      !event ||
      event.type !== "order" ||
      typeof event.data?.id !== "string" ||
      event.data.id.toUpperCase() !== id ||
      (config.environment === "production" && event.live_mode !== true) ||
      (config.environment === "test" && event.live_mode !== false)
    )
      reject("INVALID_EVENT", "Notificação inválida.");
    // The event body and redirect query are never the source of payment truth.
    const order = await provider(`/v1/orders/${id}`);
    verifyOrder(order, key, null, config.environment);
    await persist(order);
    // The durable order/payment ledger lives in Mercado Pago. No irreversible
    // fulfillment, emails or stock mutation runs from this repeatable callback.
    console.info("[mercadopago.webhook] verified", {
      orderId: order.id,
      state: paymentState(order),
    });
    return jsonResponse({ received: true });
  });
  async function persist(order) {
    if (!repository) return;
    await repository.recordOrder(order);
    const transactions = order.transactions?.payments;
    if (
      !Array.isArray(transactions) ||
      !transactions.length ||
      transactions.length > 4
    )
      return;
    const refs = transactions.map((item) => String(item.reference?.id || ""));
    if (refs.some((id) => !/^\d{1,25}$/.test(id))) return;
    const details = await Promise.allSettled(
      refs.map((id) => provider(`/v1/payments/${id}`)),
    );
    if (details.some((result) => result.status !== "fulfilled")) return;
    let fees = 0,
      refunds = 0,
      total = 0;
    for (let i = 0; i < details.length; i++) {
      const payment = details[i].value;
      if (
        String(payment.id) !== refs[i] ||
        payment.currency_id !== "BRL" ||
        payment.external_reference !== order.external_reference ||
        String(payment.collector_id) !== String(order.user_id) ||
        !Array.isArray(payment.fee_details)
      )
        return;
      if (
        order.status_detail === "partially_refunded" &&
        payment.transaction_amount_refunded === undefined
      )
        return;
      const amount = cents(String(payment.transaction_amount)),
        refunded = cents(String(payment.transaction_amount_refunded ?? 0));
      if (amount === null || refunded === null || refunded > amount) return;
      total += amount;
      refunds += refunded;
      for (const fee of payment.fee_details) {
        const value = cents(String(fee.amount));
        if (value === null || !["collector", "payer"].includes(fee.fee_payer))
          return;
        if (fee.fee_payer === "collector") fees += value;
      }
    }
    if (total !== cents(order.total_amount)) return;
    const providerUpdatedAt = Date.parse(
      order.last_updated_date || order.created_date,
    );
    if (!Number.isFinite(providerUpdatedAt)) return;
    await repository.settlement(order.id, {
      feeCents: fees,
      refundedCents: refunds,
      providerUpdatedAt,
    });
  }
  async function reconcile(id) {
    configured();
    if (!orderIdPattern.test(id)) reject("INVALID_ORDER", "Pedido inválido.");
    const order = await provider(`/v1/orders/${id}`);
    verifyOrder(order, key, null, config.environment);
    await persist(order);
    return order;
  }
  return { session, resetSession, checkout, status, webhook, reconcile };
}
