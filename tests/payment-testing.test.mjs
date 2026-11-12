import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaymentTesting } from "../lib/server/payment-testing.mjs";
import { createPaymentService } from "../lib/server/payment-service.mjs";
const origin = "https://loja.example",
  token = "APP_USR-" + "sandbox-fixture".repeat(5);
function fixture(realOrder = false) {
  let order,
    calls = 0;
  const jar = new Map();
  const service = createPaymentTesting(
    {
      APP_URL: origin,
      MERCADOPAGO_TEST_ACCESS_TOKEN: token,
      NODE_ENV: "production",
    },
    {
      fetcher: async (url, options) => {
        calls++;
        assert.ok(url.startsWith("https://api.mercadopago.com/v1/orders"));
        if (options.method === "POST") {
          const body = JSON.parse(options.body);
          assert.equal(body.total_amount, "1.00");
          const id = realOrder
            ? "ORD01PRIVATEPRODUCTION"
            : "ORDTST01PRIVATETEST";
          order = {
            ...body,
            id,
            currency: "BRL",
            country_code: "BRA",
            status: "created",
            status_detail: "created",
            total_paid_amount: "0.00",
            checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}`,
          };
        }
        return Response.json(order);
      },
    },
  );
  function request(path = "session", method = "GET", body, csrf) {
    return new Request(origin + "/api/admin/payments/test/" + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  function remember(response) {
    for (const value of response.headers.getSetCookie()) {
      const [key, valuePart] = value.split(";")[0].split("=");
      jar.set(key, valuePart);
    }
  }
  return {
    service,
    jar,
    request,
    remember,
    calls: () => calls,
    order: () => order,
  };
}
const input = () => ({
  name: "Teste da Loja",
  email: "teste@example.invalid",
  fulfillment: "pickup",
  items: [{ id: "sandbox-checkout", quantity: 1 }],
  expectedTotalCents: 100,
});
test("private test checkout has isolated cookies and returns only authoritative test results", async () => {
  const f = fixture();
  let response = await f.service.session(f.request());
  f.remember(response);
  const session = await response.json();
  assert.equal(session.testMode, true);
  response = await f.service.checkout(
    f.request("checkout", "POST", input(), session.csrfToken),
  );
  f.remember(response);
  assert.equal(response.status, 200);
  assert.ok(f.jar.has("__Host-mn-sandbox-checkout"));
  assert.ok(f.jar.has("__Host-mn-sandbox-orders"));
  assert.ok(!f.jar.has("__Host-mn-orders"));
  const order = f.order();
  assert.equal(
    order.config.online.success_url,
    origin + "/admin?pagamento_teste=1",
  );
  assert.equal(order.description, "Homologação Mundo Natural — sem venda real");
  response = await f.service.status(f.request("status"));
  assert.equal((await response.json()).state, "pending");
  order.status = "processed";
  order.status_detail = "accredited";
  order.total_paid_amount = "1.00";
  response = await f.service.status(f.request("status"));
  assert.deepEqual(await response.json(), {
    orderId: order.id,
    state: "paid",
    totalCents: 100,
    fulfillment: "pickup",
    testMode: true,
  });
  const before = f.calls();
  const production = createPaymentService({
    catalog: [],
    policy: {},
    config: {
      accessToken: token,
      origin,
      secure: true,
      environment: "production",
    },
    fetcher: () => {
      throw Error("must not reach provider");
    },
  });
  const stolen = new Request(origin + "/api/orders/current", {
    headers: {
      Cookie: `__Host-mn-orders=${f.jar.get("__Host-mn-sandbox-orders")}`,
    },
  });
  assert.equal((await production.status(stolen, "current")).status, 404);
  assert.equal(f.calls(), before);
});
test("sandbox refuses real orders, incorrect totals, unavailable credentials and any financial repository", async () => {
  const f = fixture(true);
  const sessionResponse = await f.service.session(f.request());
  f.remember(sessionResponse);
  const session = await sessionResponse.json();
  let response = await f.service.checkout(
    f.request(
      "checkout",
      "POST",
      { ...input(), expectedTotalCents: 1 },
      session.csrfToken,
    ),
  );
  assert.equal(response.status, 409);
  assert.equal(f.calls(), 0);
  response = await f.service.checkout(
    f.request("checkout", "POST", input(), session.csrfToken),
  );
  assert.equal(response.status, 502);
  assert.equal((await response.json()).supportCode, "MPV08");
  assert.ok(
    !response.headers.getSetCookie().some((c) => c.includes("orders=")),
  );
  assert.throws(() =>
    createPaymentService({
      catalog: [],
      policy: {},
      config: null,
      repository: {},
      channel: "sandbox",
    }),
  );
  assert.throws(() =>
    createPaymentService({
      catalog: [],
      policy: {},
      config: { environment: "production" },
      channel: "sandbox",
    }),
  );
  const absent = createPaymentTesting({ APP_URL: origin });
  assert.equal(
    (await (await absent.session(new Request(origin))).json()).available,
    false,
  );
});
test("sandbox creates a fresh session only with its own CSRF and does not accept arbitrary products", async () => {
  const f = fixture();
  const response = await f.service.session(f.request());
  f.remember(response);
  const session = await response.json();
  assert.equal(
    (await f.service.resetSession(f.request("reset", "POST", {}, "wrong")))
      .status,
    403,
  );
  const reset = await f.service.resetSession(
    f.request("reset", "POST", {}, session.csrfToken),
  );
  f.remember(reset);
  const fresh = await reset.json();
  assert.notEqual(fresh.csrfToken, session.csrfToken);
  const denied = await f.service.checkout(
    f.request(
      "checkout",
      "POST",
      { ...input(), items: [{ id: "prod-270", quantity: 1, weight: 100 }] },
      fresh.csrfToken,
    ),
  );
  assert.equal(denied.status, 409);
  assert.equal(f.calls(), 0);
});
