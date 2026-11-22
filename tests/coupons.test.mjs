import { test } from "node:test";
import assert from "node:assert/strict";
import catalogData from "../lib/catalog.json" with { type: "json" };
import {
  cartCouponDiscountCents,
  couponIsCurrent,
  couponPortionCents,
  normalizeCouponCode,
} from "../lib/coupons.mjs";
import { referencePriceCents, portionPriceCents } from "../lib/pricing.mjs";
import { applyMerchandising } from "../lib/merchandising.mjs";
import { buildCheckout } from "../lib/server/checkout-core.mjs";
import { validateCouponInput } from "../lib/server/coupon-store.mjs";
import { createPaymentService } from "../lib/server/payment-service.mjs";
import { reject } from "../lib/server/errors.mjs";

const policy = {
  pricesConfirmedByMerchant: true,
  onlinePickupEnabled: true,
  maxOrderCents: 10000000,
  maxDistinctLines: 30,
  maxQuantityPerLine: 20,
  disabledProductIds: [],
};
const coupon = {
  code: "INAUGURA10",
  percent: 10,
  minSubtotalCents: 0,
  endsAt: null,
};
const bulk = {
  id: "bulk",
  nome_produto: "Uva passa",
  peso_produto: "A granel",
  isGranel: true,
  valor_unitario: 88.9,
};
const unit = {
  id: "unit",
  nome_produto: "Mel 280 g",
  peso_produto: "280 g",
  isGranel: false,
  valor_unitario: 12.21,
};

test("a 10% coupon returns every raised catalog price to the previous one", () => {
  // The raise used ceil(previous / 0.9) per 100 g or per unit.
  for (const product of catalogData) {
    const raised = referencePriceCents(product);
    const previous = Math.floor((raised * 90) / 100);
    assert.ok(Math.floor((previous * 10 + 8) / 9) === raised, product.id);
    const weights = product.isGranel ? [100, 300, 1000, 5000] : [0];
    for (const weight of weights) {
      const blocks = product.isGranel ? weight / 100 : 1;
      const unitCents = portionPriceCents(product, weight);
      assert.equal(
        couponPortionCents({
          unitCents,
          regularBlockCents: raised,
          blocks,
          percent: 10,
        }),
        previous * blocks,
        `${product.id} ${weight} g`,
      );
    }
  }
});

test("the coupon never stacks on a larger offer and improves a smaller one", () => {
  const [bigOffer] = applyMerchandising([bulk], {
    offers: [{ productId: "bulk", active: true, discountPercent: 30 }],
  });
  const [smallOffer] = applyMerchandising([bulk], {
    offers: [{ productId: "bulk", active: true, discountPercent: 5 }],
  });
  const item = (product) => [{ product, quantity: 1, selectedWeight: 200 }];
  assert.equal(cartCouponDiscountCents(item(bigOffer), 10), 0);
  // 889 regular → 845 offer; coupon price is floor(889 × 0.9) = 800 per 100 g.
  assert.equal(cartCouponDiscountCents(item(smallOffer), 10), (845 - 800) * 2);
});

test("checkout applies the coupon per line, keeps shipping and matches the cart", () => {
  const [combo] = applyMerchandising([bulk, { ...bulk, id: "bulk2" }], {
    combos: [
      {
        id: "combo-a",
        name: "Combo",
        description: "",
        active: true,
        discountPercent: 0,
        components: [
          { productId: "bulk", weight: 100 },
          { productId: "bulk2", weight: 200 },
        ],
      },
    ],
  }).filter((p) => p.id === "combo-a");
  const catalog = [bulk, unit, combo];
  const cart = [
    { product: bulk, quantity: 2, selectedWeight: 300 },
    { product: unit, quantity: 1 },
    { product: combo, quantity: 1 },
  ];
  const subtotal = 889 * 3 * 2 + 1221 + 889 * 3;
  const discount = cartCouponDiscountCents(cart, 10);
  // Previous prices: 800 per 100 g and floor(1221 × 0.9) = 1098 per unit.
  assert.equal(discount, subtotal - (800 * 3 * 2 + 1098 + 800 * 3));
  const input = {
    items: [
      { id: "bulk", quantity: 2, weight: 300 },
      { id: "unit", quantity: 1 },
      { id: "combo-a", quantity: 1 },
    ],
    name: "Maria Silva",
    email: "maria@example.com",
    fulfillment: "pickup",
    expectedTotalCents: subtotal - discount,
    couponCode: "inaugura10",
  };
  const selection = buildCheckout(input, catalog, policy, null, coupon);
  assert.equal(selection.totalCents, subtotal - discount);
  assert.deepEqual(selection.coupon, {
    code: "INAUGURA10",
    percent: 10,
    discountCents: discount,
  });
  assert.equal(
    selection.items.reduce((s, i) => s + i.unitCents * i.quantity, 0),
    selection.totalCents,
  );
  assert.throws(
    () =>
      buildCheckout(
        { ...input, expectedTotalCents: subtotal },
        catalog,
        policy,
        null,
        coupon,
      ),
    { code: "PRICE_CHANGED" },
  );
  assert.throws(
    () =>
      buildCheckout(input, catalog, policy, null, {
        ...coupon,
        minSubtotalCents: subtotal + 1,
      }),
    { code: "COUPON_MIN_SUBTOTAL" },
  );
  assert.throws(
    () => buildCheckout(input, catalog, policy, null, null),
    { code: "COUPON_INVALID" },
  );
  assert.throws(
    () =>
      buildCheckout(
        { ...input, couponCode: undefined },
        catalog,
        policy,
        null,
        coupon,
      ),
    { code: "COUPON_INVALID" },
  );
});

test("coupon codes and settings are validated before saving", () => {
  assert.equal(normalizeCouponCode("  inaugura10 "), "INAUGURA10");
  const saved = validateCouponInput({
    code: "inaugura10",
    percent: 10,
    minSubtotalCents: 5000,
    maxUses: 100,
    onePerCustomer: true,
    note: "Inauguração",
  });
  assert.deepEqual(saved, {
    code: "INAUGURA10",
    percent: 10,
    active: true,
    startsAt: null,
    endsAt: null,
    minSubtotalCents: 5000,
    maxUses: 100,
    onePerCustomer: true,
    note: "Inauguração",
  });
  for (const value of [
    { code: "ab", percent: 10 },
    { code: "ÇUPOM", percent: 10 },
    { code: "CUPOM10", percent: 0 },
    { code: "CUPOM10", percent: 81 },
    { code: "CUPOM10", percent: 10.5 },
    { code: "CUPOM10", percent: 10, startsAt: 20, endsAt: 10 },
    { code: "CUPOM10", percent: 10, maxUses: 0 },
    { code: "CUPOM10", percent: 10, minSubtotalCents: -1 },
    { code: "CUPOM10", percent: 10, note: "<script>" },
    { code: "CUPOM10", percent: 10, extra: true },
  ])
    assert.throws(() => validateCouponInput(value), {
      code: "INVALID_COUPON",
    });
  const now = 1000;
  assert.equal(couponIsCurrent({ active: true }, now), true);
  assert.equal(couponIsCurrent({ active: false }, now), false);
  assert.equal(couponIsCurrent({ active: true, startsAt: 1001 }, now), false);
  assert.equal(couponIsCurrent({ active: true, endsAt: 1000 }, now), false);
});

test("the payment service charges the discounted total and reserves the coupon", async () => {
  const config = {
    accessToken: "APP_USR-" + "fixture".repeat(8),
    origin: "https://loja.example",
    secure: true,
    environment: "production",
    webhookSecret: "webhook-fixture-secret-value",
  };
  const reserved = [];
  const coupons = {
    async resolve(code) {
      if (normalizeCouponCode(code) !== "INAUGURA10")
        reject("COUPON_INVALID", "Cupom inválido ou fora da validade.", 404);
      return { ...coupon, maxUses: null, onePerCustomer: false };
    },
    async reserve(reference, selection) {
      reserved.push({ reference, coupon: selection.coupon });
    },
  };
  let body;
  const fetcher = async (url, options) => {
    body = JSON.parse(options.body);
    const id = "ORD01MNCOUPONTEST";
    return Response.json(
      {
        ...body,
        id,
        currency: "BRL",
        country_code: "BRA",
        status: "created",
        status_detail: "created",
        total_paid_amount: "0.00",
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}`,
      },
      { status: 201 },
    );
  };
  const service = createPaymentService({
    catalog: [bulk, unit],
    policy,
    config,
    coupons,
    fetcher,
    now: () => 1800000000,
  });
  const jar = new Map();
  const request = (path, method = "GET", payload, extra = {}) =>
    new Request(config.origin + path, {
      method,
      headers: {
        ...(method === "POST"
          ? { Origin: config.origin, "Content-Type": "application/json" }
          : {}),
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...extra,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  const sessionResponse = await service.session(
    request("/api/checkout/session"),
  );
  for (const value of sessionResponse.headers.getSetCookie()) {
    const [name, ...rest] = value.split(";")[0].split("=");
    jar.set(name, rest.join("="));
  }
  const { csrfToken } = await sessionResponse.json();
  const headers = { "X-CSRF-Token": csrfToken };
  const preview = await service.couponPreview(
    request("/api/checkout/coupon", "POST", { code: "inaugura10" }, headers),
  );
  assert.equal(preview.status, 200);
  assert.deepEqual((await preview.json()).coupon, coupon);
  const invalid = await service.couponPreview(
    request("/api/checkout/coupon", "POST", { code: "NAOEXISTE" }, headers),
  );
  assert.equal(invalid.status, 404);
  const total = 800 * 2 + 1098;
  const response = await service.checkout(
    request(
      "/api/checkout",
      "POST",
      {
        items: [
          { id: "bulk", quantity: 1, weight: 200 },
          { id: "unit", quantity: 1 },
        ],
        name: "Maria Silva",
        email: "maria@example.com",
        fulfillment: "pickup",
        expectedTotalCents: total,
        couponCode: "INAUGURA10",
      },
      headers,
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(body.total_amount, "26.98");
  assert.deepEqual(
    body.items.map((i) => i.unit_price),
    ["16.00", "10.98"],
  );
  assert.equal(reserved.length, 1);
  assert.equal(reserved[0].coupon.discountCents, 889 * 2 + 1221 - total);
});
