import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createPaymentService,
  paymentConfiguration,
} from "../lib/server/payment-service.mjs";
import {
  buildCheckout,
  cents,
  money,
  paymentState,
  validateCheckoutUrl,
  verifyOrder,
} from "../lib/server/checkout-core.mjs";
import {
  deriveKey,
  seal,
  unseal,
  externalReference,
  verifyReference,
} from "../lib/server/crypto-state.mjs";
import {
  RateLimiter,
  readJson,
  safeFailure,
} from "../lib/server/http-security.mjs";
import { verifyWebhookSignature } from "../lib/server/webhook.mjs";
import { createMercadoPagoClient } from "../lib/server/mercado-pago.mjs";
const now = 1800000000;
const config = {
  accessToken: "APP_USR-" + "fixture".repeat(8),
  origin: "https://loja.example",
  secure: true,
  environment: "production",
  webhookSecret: "webhook-fixture-secret-value",
};
const catalog = [
  {
    id: "bulk",
    nome_produto: "Castanha",
    peso_produto: "kg",
    isGranel: true,
    valor_unitario: 119.99,
  },
  {
    id: "unit",
    nome_produto: "Pasta",
    peso_produto: "500 g",
    isGranel: false,
    valor_unitario: 19.99,
  },
];
const policy = {
  pricesConfirmedByMerchant: true,
  onlinePickupEnabled: true,
  maxOrderCents: 1000000,
  maxDistinctLines: 20,
  maxQuantityPerLine: 20,
  disabledProductIds: [],
};
const input = () => ({
  items: [
    { id: "bulk", quantity: 3, weight: 300 },
    { id: "unit", quantity: 2 },
  ],
  name: "Maria Silva",
  email: "maria@example.com",
  fulfillment: "pickup",
  expectedTotalCents: 14798,
});
const key = deriveKey(config.accessToken);
function setup(customFetcher) {
  const calls = [],
    orders = new Map(),
    jar = new Map();
  const fetcher =
    customFetcher ||
    (async (url, options) => {
      calls.push({ url, options });
      if (options.method === "POST") {
        const body = JSON.parse(options.body),
          id =
            "ORD01MN" +
            options.headers["X-Idempotency-Key"]
              .replace(/[^A-Za-z0-9]/g, "")
              .slice(0, 22)
              .toUpperCase();
        const order = {
          ...body,
          id,
          currency: "BRL",
          country_code: "BRA",
          status: "created",
          status_detail: "created",
          total_paid_amount: "0.00",
          checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}`,
        };
        orders.set(id, order);
        return Response.json(order, { status: 201 });
      }
      return Response.json(orders.get(url.split("/").at(-1)));
    });
  const service = createPaymentService({
    catalog,
    policy,
    config,
    fetcher,
    now: () => now,
  });
  function request(path, method = "GET", body, extra = {}) {
    return new Request(config.origin + path, {
      method,
      headers: {
        ...(method === "POST"
          ? { Origin: config.origin, "Content-Type": "application/json" }
          : {}),
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  function remember(response) {
    for (const value of response.headers.getSetCookie()) {
      const [name, ...rest] = value.split(";")[0].split("=");
      jar.set(name, rest.join("="));
    }
  }
  async function session() {
    const response = await service.session(request("/api/checkout/session"));
    remember(response);
    return response.json();
  }
  async function checkout(body = input(), csrf) {
    const token = csrf || (await session()).csrfToken;
    const response = await service.checkout(
      request("/api/checkout", "POST", body, { "X-CSRF-Token": token }),
    );
    remember(response);
    return response;
  }
  return { service, calls, orders, jar, request, remember, session, checkout };
}
test("canonical catalog prices use integer cents and round the unit before multiplying", () => {
  const result = buildCheckout(input(), catalog, policy);
  assert.equal(result.totalCents, 14798);
  assert.equal(result.items[0].unitCents, 3600);
  assert.equal(result.items[0].quantity, 3);
  assert.equal(cents("119.99"), 11999);
  assert.equal(cents("1e3"), null);
  assert.equal(cents("1.001"), null);
  assert.equal(money(14798), "147.98");
});
test("tampered prices, unknown fields, invalid weights and quantities are rejected before provider calls", async () => {
  const cases = [
    { ...input(), expectedTotalCents: 1 },
    { ...input(), total: 1 },
    {
      ...input(),
      items: [{ id: "bulk", quantity: 1, weight: 300, price: 0.01 }],
    },
    { ...input(), items: [{ id: "bulk", quantity: 1, weight: -100 }] },
    { ...input(), items: [{ id: "missing", quantity: 1 }] },
    { ...input(), items: [{ id: "unit", quantity: -1 }] },
    { ...input(), items: [{ id: "unit", quantity: 1.5 }] },
    { ...input(), items: [{ id: "unit", quantity: "1" }] },
    { ...input(), fulfillment: "delivery" },
  ];
  for (const body of cases) {
    const f = setup();
    const response = await f.checkout(body);
    assert.ok(response.status >= 400);
    assert.equal(f.calls.length, 0);
  }
});
test("duplicates, disabled products, customer input and business ceilings are validated", () => {
  assert.throws(() =>
    buildCheckout(
      {
        ...input(),
        items: [
          { id: "unit", quantity: 15 },
          { id: "unit", quantity: 15 },
        ],
      },
      catalog,
      policy,
    ),
  );
  assert.throws(() =>
    buildCheckout(input(), catalog, {
      ...policy,
      disabledProductIds: ["bulk"],
    }),
  );
  assert.throws(() =>
    buildCheckout(
      { ...input(), email: "bad\r\n@example.com" },
      catalog,
      policy,
    ),
  );
  assert.throws(() =>
    buildCheckout(input(), catalog, { ...policy, maxOrderCents: 1000 }),
  );
  assert.throws(() =>
    buildCheckout(input(), catalog, {
      ...policy,
      pricesConfirmedByMerchant: false,
    }),
  );
});
test("secure checkout creates an Orders API request and an authenticated order cookie", async () => {
  const f = setup(),
    response = await f.checkout(),
    body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.totalCents, 14798);
  assert.ok(
    body.checkoutUrl.startsWith("https://www.mercadopago.com.br/checkout/"),
  );
  const call = f.calls[0],
    payload = JSON.parse(call.options.body);
  assert.equal(call.url, "https://api.mercadopago.com/v1/orders");
  assert.equal(payload.type, "online");
  assert.equal(payload.processing_mode, "manual");
  assert.equal(payload.total_amount, "147.98");
  assert.equal(
    payload.config.online.success_url,
    "https://loja.example/pagamento/retorno",
  );
  assert.equal(payload.payer.email, "maria@example.com");
  assert.equal(payload.items[0].unit_price, "36.00");
  assert.ok(response.headers.get("set-cookie").includes("HttpOnly"));
  assert.ok(response.headers.get("set-cookie").includes("Secure"));
  assert.ok(response.headers.get("set-cookie").includes("SameSite=Lax"));
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(JSON.stringify(body).includes(config.accessToken), false);
});
test("a retried checkout uses the same server-derived idempotency key", async () => {
  const f = setup(),
    session = await f.session();
  await f.checkout(input(), session.csrfToken);
  await f.checkout(input(), session.csrfToken);
  assert.equal(
    f.calls[0].options.headers["X-Idempotency-Key"],
    f.calls[1].options.headers["X-Idempotency-Key"],
  );
  assert.equal(
    JSON.parse(f.calls[0].options.body).external_reference,
    JSON.parse(f.calls[1].options.body).external_reference,
  );
});
test("Origin, same-site metadata and CSRF checks prevent cross-site checkout", async () => {
  const f = setup(),
    s = await f.session();
  for (const headers of [
    { Origin: "https://attacker.example", "X-CSRF-Token": s.csrfToken },
    { Origin: config.origin, "X-CSRF-Token": "forged" },
    {
      Origin: config.origin,
      "Sec-Fetch-Site": "cross-site",
      "X-CSRF-Token": s.csrfToken,
    },
  ]) {
    const response = await f.service.checkout(
      f.request("/api/checkout", "POST", input(), headers),
    );
    assert.equal(response.status, 403);
  }
  assert.equal(f.calls.length, 0);
});
test("duplicate authenticated cookies cannot bypass checkout or order ownership", async () => {
  const f = setup(),
    session = await f.session();
  const [sessionName, sessionValue] = [...f.jar][0];
  const rejected = await f.service.checkout(
    f.request("/api/checkout", "POST", input(), {
      "X-CSRF-Token": session.csrfToken,
      Cookie: `${sessionName}=${sessionValue}; ${sessionName}=forged`,
    }),
  );
  assert.equal(rejected.status, 403);
  assert.equal(f.calls.length, 0);

  const accepted = await f.checkout(input(), session.csrfToken);
  assert.equal(accepted.status, 200);
  const id = (await accepted.json()).orderId;
  const [orderName, orderValue] = [...f.jar].find(([name]) =>
    name.endsWith("mn-orders"),
  );
  const calls = f.calls.length;
  const status = await f.service.status(
    f.request(`/api/orders/${id}`, "GET", undefined, {
      Cookie: `${orderName}=${orderValue}; ${orderName}=forged`,
    }),
    id,
  );
  assert.equal(status.status, 404);
  assert.equal(f.calls.length, calls);
});

test("payment status needs ownership and never trusts redirect query parameters", async () => {
  const f = setup(),
    response = await f.checkout(),
    data = await response.json();
  const owned = await f.service.status(
    f.request("/api/orders/current?status=approved"),
    "current",
  );
  assert.equal((await owned.json()).state, "pending");
  const order = f.orders.get(data.orderId);
  order.status = "processed";
  order.status_detail = "accredited";
  order.total_paid_amount = order.total_amount;
  const approved = await f.service.status(
    f.request("/api/orders/current"),
    "current",
  );
  assert.equal((await approved.json()).state, "paid");
  f.jar.delete("__Host-mn-orders");
  const count = f.calls.length;
  const denied = await f.service.status(
    f.request("/api/orders/" + data.orderId),
    data.orderId,
  );
  assert.equal(denied.status, 404);
  assert.equal(f.calls.length, count);
});
test("another order, currency, amount or signed reference cannot be substituted", () => {
  const ref = externalReference(key, "a".repeat(22), 1000),
    good = {
      id: "ORD01ABCDEFGHIJKLMN",
      external_reference: ref,
      total_amount: "10.00",
      total_paid_amount: "10.00",
      currency: "BRL",
      country_code: "BRA",
      processing_mode: "manual",
      type: "online",
      status: "processed",
      status_detail: "accredited",
    };
  assert.ok(
    verifyOrder(
      good,
      key,
      { id: good.id, ref, totalCents: 1000 },
      "production",
    ),
  );
  for (const change of [
    { currency: "USD" },
    { country_code: "USA" },
    { total_amount: "1.00" },
    { external_reference: ref.slice(0, -1) + "X" },
    { id: "ORDTST01234567890" },
  ])
    assert.throws(() =>
      verifyOrder(
        { ...good, ...change },
        key,
        { id: good.id, ref, totalCents: 1000 },
        "production",
      ),
    );
  assert.equal(paymentState({ ...good, total_paid_amount: "1.00" }), "pending");
  assert.equal(
    paymentState({ ...good, status_detail: "partially_refunded" }),
    "refunded",
  );
  assert.equal(
    paymentState({
      ...good,
      status: "action_required",
      status_detail: "waiting_capture",
    }),
    "pending",
  );
});
test("order validation identifies the failing contract check without exposing provider data", async () => {
  const ref = externalReference(key, "a".repeat(22), 1000);
  const order = {
    id: "ORD01VALIDATIONFIXTURE",
    external_reference: ref,
    total_amount: "10.00",
    type: "online",
    processing_mode: "manual",
    currency: "BRL",
    country_code: "BRA",
    payer: { email: "private-customer@example.invalid" },
    client_token: "private-client-token",
  };
  const expected = { id: order.id, ref, totalCents: 1000 };
  const cases = [
    [{ id: "invalid" }, "MPV01"],
    [{ type: "other" }, "MPV02"],
    [{ processing_mode: "automatic" }, "MPV03"],
    [{ currency: "USD" }, "MPV04"],
    [{ country_code: "USA" }, "MPV05"],
    [{ external_reference: "other" }, "MPV06"],
    [{ total_amount: "1.00" }, "MPV07"],
    [{ id: "ORDTST01VALIDATIONFIXTURE" }, "MPV08"],
  ];
  for (const [change, code] of cases) {
    let failure;
    try {
      verifyOrder({ ...order, ...change }, key, expected, "production");
    } catch (error) {
      failure = error;
    }
    assert.equal(failure?.supportCode, code);
    const response = safeFailure(failure),
      body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.code, "ORDER_VERIFICATION_FAILED");
    assert.equal(body.supportCode, code);
    assert.deepEqual(Object.keys(body).sort(), [
      "code",
      "error",
      "supportCode",
    ]);
    const output = JSON.stringify(body);
    for (const sensitive of [
      order.id,
      ref,
      order.payer.email,
      order.client_token,
    ])
      assert.equal(output.includes(sensitive), false);
  }
  assert.throws(
    () =>
      verifyOrder(
        order,
        key,
        { ...expected, id: "ORD01OTHERFIXTURE" },
        "production",
      ),
    (error) => error.supportCode === "MPV09",
  );
  let unsafeFailure;
  try {
    verifyOrder(
      {
        ...order,
        currency: "private-currency-value",
        country_code: "private-country-value",
      },
      key,
      expected,
      "production",
    );
  } catch (error) {
    unsafeFailure = error;
  }
  assert.equal(unsafeFailure.validationContext.currency, "unexpected");
  assert.equal(unsafeFailure.validationContext.country, "unexpected");
  assert.equal(
    JSON.stringify(unsafeFailure.validationContext).includes("private-"),
    false,
  );
});
test("a test order in production stays blocked with a safe support code and sanitized server log", async (t) => {
  const logs = [];
  t.mock.method(console, "warn", (...args) => logs.push(args));
  const f = setup(async (url, options) => {
    const body = JSON.parse(options.body),
      id = "ORDTST01DIAGNOSTICFIXTURE";
    return Response.json({
      ...body,
      id,
      currency: "BRL",
      country_code: "BRA",
      status: "created",
      client_token: "private-client-token",
      checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}`,
    });
  });
  const response = await f.checkout(),
    body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.supportCode, "MPV08");
  assert.deepEqual(logs, [
    [
      "[mercadopago.validation]",
      {
        supportCode: "MPV08",
        failedChecks: ["environment"],
        received: { environment: "test", currency: "BRL", country: "BRA" },
      },
    ],
  ]);
  const output = JSON.stringify({ body, logs });
  for (const privateValue of [
    "private-client-token",
    input().email,
    input().name,
    config.accessToken,
  ])
    assert.equal(output.includes(privateValue), false);
});
test("signed state is purpose-bound, expires and rejects tampering", () => {
  const token = seal(key, "session", { jti: "test" }, now, 3600);
  assert.equal(unseal(key, "session", token, now).jti, "test");
  assert.equal(unseal(key, "orders", token, now), null);
  assert.equal(unseal(key, "session", token, now + 3600), null);
  assert.equal(unseal(key, "session", token + "x", now), null);
  const ref = externalReference(key, "x".repeat(22), 12345);
  assert.equal(verifyReference(key, ref).totalCents, 12345);
  assert.equal(verifyReference(key, ref.replace("12345", "1")), null);
});
test("checkout redirect URLs cannot target another host or an arbitrary payment page", () => {
  const id = "ORD01ABCDEFGHIJKLMN";
  for (const value of [
    "https://attacker.example/checkout/v1/redirect?order_id=" + id,
    "https://www.mercadopago.com.br.attacker.example/checkout/v1/redirect?order_id=" +
      id,
    "http://www.mercadopago.com.br/checkout/v1/redirect?order_id=" + id,
    "https://user@www.mercadopago.com.br/checkout/v1/redirect?order_id=" + id,
    "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=another",
    "https://www.mercadopago.com.br/unrelated?order_id=" + id,
  ])
    assert.throws(() => validateCheckoutUrl(value, id));
});
test("streamed bodies, malformed JSON and content types are bounded", async () => {
  await assert.rejects(
    readJson(
      new Request(config.origin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(17000),
      }),
    ),
    (error) => error.status === 413,
  );
  await assert.rejects(
    readJson(
      new Request(config.origin, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }),
    ),
    (error) => error.status === 415,
  );
  await assert.rejects(
    readJson(
      new Request(config.origin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    ),
    (error) => error.code === "INVALID_JSON",
  );
});
test("provider network and error responses never expose tokens or customer details", async () => {
  const f = setup(async () =>
    Response.json(
      { error: config.accessToken, payer: { email: input().email } },
      { status: 401 },
    ),
  );
  const response = await f.checkout();
  assert.equal(response.status, 502);
  const data = await response.text();
  assert.equal(data.includes(config.accessToken), false);
  assert.equal(data.includes(input().email), false);
  const client = createMercadoPagoClient(config.accessToken, async () => {
    throw Error("network " + config.accessToken);
  });
  await assert.rejects(
    client("/v1/orders"),
    (error) => !error.message.includes(config.accessToken),
  );
  await assert.rejects(client("/users/me"));
});
function signedWebhook(id, body, override = {}) {
  const ts = String(now * 1000),
    requestId = "request-fixture-123",
    signature = createHmac("sha256", config.webhookSecret)
      .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`)
      .digest("hex");
  return new Request(
    `${config.origin}/api/mercadopago/webhook?data.id=${id}&type=order`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "X-Signature": `ts=${ts},v1=${signature}`,
        ...override,
      },
      body: JSON.stringify(body),
    },
  );
}
test("webhook HMAC rejects missing, forged, stale and duplicate parameters", () => {
  const id = "ORD01ABCDEFGHIJKLMN",
    body = { type: "order", live_mode: true, data: { id } };
  assert.equal(
    verifyWebhookSignature(signedWebhook(id, body), config.webhookSecret, now),
    id,
  );
  assert.equal(
    verifyWebhookSignature(
      signedWebhook(id, body, {
        "X-Signature": "ts=1800000000000,v1=" + "0".repeat(64),
      }),
      config.webhookSecret,
      now,
    ),
    null,
  );
  assert.equal(
    verifyWebhookSignature(
      signedWebhook(id, body),
      config.webhookSecret,
      now + 301,
    ),
    null,
  );
  const original = signedWebhook(id, body);
  assert.equal(
    verifyWebhookSignature(
      new Request(original.url + "&data.id=" + id, original),
      config.webhookSecret,
      now,
    ),
    null,
  );
});
test("webhook validates body identity and rechecks authoritative status; repeats have no financial writes", async () => {
  const f = setup(),
    response = await f.checkout(),
    data = await response.json(),
    order = f.orders.get(data.orderId);
  order.status = "processed";
  order.status_detail = "accredited";
  order.total_paid_amount = order.total_amount;
  const bad = await f.service.webhook(
    signedWebhook(data.orderId, {
      type: "order",
      live_mode: true,
      data: { id: "ORD01WRONGRESOURCE" },
    }),
  );
  assert.equal(bad.status, 400);
  for (let i = 0; i < 2; i++) {
    const good = await f.service.webhook(
      signedWebhook(data.orderId, {
        type: "order",
        live_mode: true,
        data: { id: data.orderId },
      }),
    );
    assert.equal(good.status, 200);
  }
  assert.deepEqual(
    f.calls.map((c) => c.options.method),
    ["POST", "GET", "GET"],
  );
});
test("resetting a session requires CSRF and permits a deliberate new purchase", async () => {
  const f = setup(),
    first = await f.session();
  await f.checkout(input(), first.csrfToken);
  const r = await f.service.resetSession(
    f.request("/api/checkout/session", "POST", undefined, {
      "X-CSRF-Token": first.csrfToken,
    }),
  );
  assert.equal(r.status, 200);
  f.remember(r);
  const second = await r.json();
  await f.checkout(input(), second.csrfToken);
  assert.notEqual(
    f.calls[0].options.headers["X-Idempotency-Key"],
    f.calls[1].options.headers["X-Idempotency-Key"],
  );
});
test("rate limiter memory and checkout attempts are bounded", () => {
  const limiter = new RateLimiter(5);
  limiter.take("one", 1, 60, now);
  assert.throws(
    () => limiter.take("one", 1, 60, now),
    (error) => error.status === 429,
  );
  limiter.take("one", 1, 60, now + 61);
  for (let i = 0; i < 20; i++) limiter.take("key-" + i, 10, 60, now);
  assert.ok(limiter.entries.size <= 5);
});
test("configuration requires a private server token and an explicit safe origin", () => {
  assert.equal(paymentConfiguration({}), null);
  assert.equal(
    paymentConfiguration({
      APP_URL: "http://loja.example",
      MERCADOPAGO_ACCESS_TOKEN: config.accessToken,
      NODE_ENV: "production",
    }),
    null,
  );
  assert.equal(
    paymentConfiguration({
      APP_URL: "https://loja.example/path",
      MERCADOPAGO_ACCESS_TOKEN: config.accessToken,
    }),
    null,
  );
  assert.equal(
    paymentConfiguration({
      APP_URL: config.origin,
      MERCADOPAGO_ACCESS_TOKEN: config.accessToken,
    }).origin,
    config.origin,
  );
});
test("without credentials the public shop can run and payment APIs fail closed", async () => {
  const service = createPaymentService({ catalog, policy, config: null });
  assert.equal(
    (await (await service.session(new Request(config.origin))).json())
      .available,
    false,
  );
  assert.equal(
    (await service.checkout(new Request(config.origin, { method: "POST" })))
      .status,
    503,
  );
  assert.equal(
    (await service.webhook(new Request(config.origin, { method: "POST" })))
      .status,
    404,
  );
});
