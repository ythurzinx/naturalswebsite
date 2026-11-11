import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShippingService,
  shippingConfiguration,
  shippingDefaults,
  validateShippingSettings,
  distanceMeters,
  shippingFee,
} from "../lib/server/shipping-service.mjs";
import { buildCheckout } from "../lib/server/checkout-core.mjs";
import { createPaymentService } from "../lib/server/payment-service.mjs";

const config = {
  origin: "https://loja.example",
  secret: "f".repeat(64),
  secure: true,
};
const catalog = [
  {
    id: "prod-1",
    nome_produto: "Castanha",
    peso_produto: "kg",
    isGranel: true,
    valor_unitario: 120,
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
const origin = {
  postalCode: "06754000",
  street: "Rua de teste",
  neighborhood: "Bairro",
  city: "Taboão da Serra",
  state: "SP",
  latitude: -23.62611,
  longitude: -46.79167,
};
function fixture(customFetcher) {
  let now = 1800000000,
    value = {
      ...shippingDefaults,
      enabled: true,
      originPostalCode: origin.postalCode,
      pricePerKmCents: 300,
      minimumFeeCents: 800,
      baseFeeCents: 200,
      revision: 1,
      origin,
    };
  const lookups = [],
    jar = new Map();
  const repository = {
    shippingSettings: async () => value,
    saveShippingSettings: async (next) => {
      if (next.revision !== value.revision) throw Error("revision");
      value = { ...next, revision: value.revision + 1 };
    },
    loginLimit: async () => true,
  };
  const fetcher =
    customFetcher ||
    (async (url, options) => {
      lookups.push({ url, options });
      return Response.json({
        cep: url.split("/").at(-1),
        state: "SP",
        city: "Taboão da Serra",
        street: "Rua de destino",
        neighborhood: "Centro",
        location: {
          coordinates: { latitude: "-23.63611", longitude: "-46.80167" },
        },
      });
    });
  const service = createShippingService({
    repository,
    catalogProvider: async () => catalog,
    policy,
    config,
    fetcher,
    now: () => now,
  });
  function request(path, body, headers = {}) {
    return new Request(config.origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: config.origin,
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/json",
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function session() {
    const response = await service.session(request("/api/shipping/session"));
    assert.equal(response.status, 200);
    for (const cookie of response.headers.getSetCookie()) {
      const [key, value] = cookie.split(";")[0].split("=");
      jar.set(key, value);
    }
    return (await response.json()).csrfToken;
  }
  const body = () => ({
    postalCode: "06754100",
    expectedSubtotalCents: 3600,
    items: [{ id: "prod-1", weight: 300, quantity: 1 }],
  });
  async function quote() {
    const csrf = await session();
    const response = await service.quote(
      request("/api/shipping/quote", body(), { "X-CSRF-Token": csrf }),
    );
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  return {
    service,
    repository,
    lookups,
    request,
    session,
    body,
    quote,
    advance: (seconds) => {
      now += seconds;
    },
    change: (next) => {
      value = { ...value, ...next };
    },
  };
}
test("shipping setup rejects unsafe origins, malformed rates and client coordinates", () => {
  assert.equal(shippingConfiguration({}), null);
  assert.equal(
    shippingConfiguration({
      APP_URL: "http://loja.example",
      ADMIN_SESSION_SECRET: config.secret,
      NODE_ENV: "production",
    }),
    null,
  );
  assert.ok(
    shippingConfiguration({
      APP_URL: config.origin,
      ADMIN_SESSION_SECRET: config.secret,
      NODE_ENV: "production",
    }),
  );
  const settings = {
    ...shippingDefaults,
    enabled: true,
    originPostalCode: "06754-000",
    pricePerKmCents: 300,
  };
  assert.equal(validateShippingSettings(settings).originPostalCode, "06754000");
  for (const bad of [
    { pricePerKmCents: -1 },
    { pricePerKmCents: 1.2 },
    { latitude: -23 },
    { maxDistanceMeters: 0 },
    { maxDistanceMeters: 100001 },
    { freeAboveCents: 0 },
    { revision: NaN },
    { pricePerKmCents: 0 },
  ])
    assert.throws(() => validateShippingSettings({ ...settings, ...bad }));
});
test("CEP distance uses the earth radius, minimum fee, base, free threshold and service radius", () => {
  assert.equal(distanceMeters(origin, origin), 0);
  assert.ok(
    Math.abs(
      distanceMeters(
        { latitude: 0, longitude: -46 },
        { latitude: 1, longitude: -46 },
      ) - 111195,
    ) < 2,
  );
  const settings = {
    ...shippingDefaults,
    enabled: true,
    pricePerKmCents: 300,
    baseFeeCents: 200,
    minimumFeeCents: 800,
    freeAboveCents: 10000,
  };
  assert.equal(shippingFee(settings, 0, 9999), 800);
  assert.equal(shippingFee(settings, 3000, 9999), 1100);
  assert.equal(shippingFee(settings, 3000, 10000), 0);
  assert.throws(() => shippingFee(settings, 10001, 10000), {
    code: "OUTSIDE_DELIVERY_AREA",
  });
  assert.throws(() => shippingFee({ ...settings, enabled: false }, 0, 10000), {
    code: "DELIVERY_DISABLED",
  });
});
test("quotes are signed, bound to canonical cart prices and expire after ten minutes", async () => {
  const f = fixture(),
    quote = await f.quote();
  assert.equal(quote.feeCents, 800);
  assert.ok(quote.distanceMeters > 1000);
  assert.equal(quote.address.postalCode, "06754100");
  assert.equal(
    f.lookups[0].url,
    "https://brasilapi.com.br/api/cep/v2/06754100",
  );
  assert.equal(f.lookups[0].options.redirect, "error");
  const input = {
    quoteToken: quote.quoteToken,
    number: "123",
    complement: "Apto 2",
  };
  const delivery = await f.service.resolveDelivery(input);
  const checkout = {
    items: f.body().items,
    name: "Cliente Teste",
    email: "cliente@example.invalid",
    fulfillment: "delivery",
    phone: "(11) 99999-9999",
    delivery: input,
    notes: "Entregar na portaria",
    expectedTotalCents: 4400,
  };
  const selection = buildCheckout(checkout, catalog, policy, delivery);
  assert.equal(selection.totalCents, 4400);
  assert.equal(selection.items.at(-1).id, "__shipping__");
  assert.equal(selection.delivery.address.number, "123");
  assert.throws(
    () =>
      buildCheckout(
        {
          ...checkout,
          items: [{ id: "prod-1", weight: 300, quantity: 2 }],
          expectedTotalCents: 8000,
        },
        catalog,
        policy,
        delivery,
      ),
    { code: "SHIPPING_CART_CHANGED" },
  );
  assert.throws(
    () =>
      buildCheckout(
        { ...checkout, expectedTotalCents: 3600 },
        catalog,
        policy,
        delivery,
      ),
    { code: "PRICE_CHANGED" },
  );
  assert.throws(
    () => buildCheckout({ ...checkout, phone: "" }, catalog, policy, delivery),
    { code: "INVALID_CONTACT" },
  );
  await assert.rejects(f.service.resolveDelivery({ ...input, feeCents: 0 }), {
    code: "INVALID_DELIVERY",
  });
  await assert.rejects(
    f.service.resolveDelivery({ ...input, quoteToken: quote.quoteToken + "x" }),
    { code: "SHIPPING_QUOTE_EXPIRED" },
  );
  f.advance(600);
  await assert.rejects(f.service.resolveDelivery(input), {
    code: "SHIPPING_QUOTE_EXPIRED",
  });
});
test("new shipping settings invalidate old quotes while free delivery has no zero-price provider item", async () => {
  const f = fixture(),
    old = await f.quote();
  f.change({ revision: 2, freeAboveCents: 3600 });
  await assert.rejects(
    f.service.resolveDelivery({ quoteToken: old.quoteToken, number: "s/n" }),
    { code: "SHIPPING_QUOTE_EXPIRED" },
  );
  const fresh = await f.quote();
  assert.equal(fresh.feeCents, 0);
  assert.equal(f.lookups.length, 1);
  const delivery = await f.service.resolveDelivery({
    quoteToken: fresh.quoteToken,
    number: "s/n",
  });
  const selection = buildCheckout(
    {
      items: f.body().items,
      name: "Teste Cliente",
      email: "teste@example.invalid",
      fulfillment: "delivery",
      phone: "11999999999",
      expectedTotalCents: 3600,
    },
    catalog,
    policy,
    delivery,
  );
  assert.equal(selection.items.length, 1);
  assert.equal(selection.shippingCents, 0);
});
test("shipping APIs reject cross-origin, missing CSRF, forged subtotal, URLs and client fee fields", async () => {
  const f = fixture();
  assert.equal(
    (await f.service.quote(f.request("/api/shipping/quote", f.body()))).status,
    403,
  );
  const csrf = await f.session();
  assert.equal(
    (
      await f.service.quote(
        f.request("/api/shipping/quote", f.body(), {
          "X-CSRF-Token": csrf,
          Origin: "https://evil.example",
        }),
      )
    ).status,
    403,
  );
  for (const bad of [
    { postalCode: "https://evil.example" },
    { feeCents: 0 },
    { distanceMeters: 0 },
    { expectedSubtotalCents: 1 },
  ])
    assert.equal(
      (
        await f.service.quote(
          f.request(
            "/api/shipping/quote",
            { ...f.body(), ...bad },
            { "X-CSRF-Token": csrf },
          ),
        )
      ).status,
      bad.expectedSubtotalCents ? 409 : 400,
    );
  assert.equal(f.lookups.length, 0);
});
test("missing coordinates, generic CEPs, upstream errors and oversized responses fail closed", async () => {
  for (const fetcher of [
    async () => {
      throw Error("private network detail");
    },
    async () => Response.json({ cep: "06754100" }),
    async () => new Response("x".repeat(17000)),
    async () => new Response("{}", { status: 404 }),
  ]) {
    const f = fixture(fetcher),
      csrf = await f.session(),
      response = await f.service.quote(
        f.request("/api/shipping/quote", f.body(), { "X-CSRF-Token": csrf }),
      );
    assert.ok([409, 503].includes(response.status));
    const output = await response.text();
    assert.equal(output.includes("private network detail"), false);
    assert.equal(output.includes('"feeCents":0'), false);
  }
});
test("payment provider receives shipping exactly once and delivery intent is saved before the provider call", async () => {
  const f = fixture(),
    quote = await f.quote();
  const calls = [],
    jar = new Map();
  const payments = createPaymentService({
    catalog,
    policy,
    shipping: f.service,
    config: {
      accessToken: "APP_USR-" + "fixture".repeat(8),
      origin: config.origin,
      secure: true,
      environment: "production",
    },
    repository: {
      recordCheckoutIntent: async (ref, selection) => {
        calls.push("intent");
        assert.equal(selection.delivery.address.number, "22");
      },
      recordOrder: async () => {
        calls.push("order");
      },
    },
    fetcher: async (url, options) => {
      calls.push("provider");
      const body = JSON.parse(options.body);
      assert.equal(body.total_amount, "44.00");
      assert.equal(body.items.length, 2);
      assert.equal(body.items.at(-1).unit_price, "8.00");
      const id = "ORD01MNDELIVERYFIXTURE";
      return Response.json({
        ...body,
        id,
        currency: "BRL",
        country_code: "BRA",
        status: "created",
        total_paid_amount: "0.00",
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}`,
      });
    },
  });
  function req(path, body, headers = {}) {
    return new Request(config.origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: config.origin,
        "Content-Type": "application/json",
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const session = await payments.session(req("/api/checkout/session"));
  for (const cookie of session.headers.getSetCookie()) {
    const [k, v] = cookie.split(";")[0].split("=");
    jar.set(k, v);
  }
  const csrf = (await session.json()).csrfToken;
  const response = await payments.checkout(
    req(
      "/api/checkout",
      {
        items: f.body().items,
        name: "Cliente Teste",
        email: "teste@example.invalid",
        phone: "11999999999",
        fulfillment: "delivery",
        expectedTotalCents: 4400,
        delivery: { quoteToken: quote.quoteToken, number: "22" },
      },
      { "X-CSRF-Token": csrf },
    ),
  );
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(calls, ["intent", "provider", "order"]);
});

test("shipping lookup quotas and duplicate session cookies cannot be bypassed", async () => {
  const f = fixture();
  const csrf = await f.session();
  const base = f.request("/api/shipping/quote", f.body(), {
    "X-CSRF-Token": csrf,
  });
  const cookie = base.headers.get("cookie");
  const duplicate = await f.service.quote(
    f.request("/api/shipping/quote", f.body(), {
      "X-CSRF-Token": csrf,
      Cookie: `${cookie}; ${cookie}`,
    }),
  );
  assert.equal(duplicate.status, 403);
  f.repository.loginLimit = async () => false;
  const blocked = await f.service.quote(base);
  assert.equal(blocked.status, 429);
  assert.equal(f.lookups.length, 0);
});
