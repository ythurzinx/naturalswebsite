import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../lib/catalog.json" with { type: "json" };
import profiles from "../lib/product-content.json" with { type: "json" };
import { findProducts } from "../lib/search.mjs";
import {
  defaultProductContent,
  validateProductContent,
} from "../lib/server/product-content.mjs";
import { validateReview } from "../lib/server/review-service.mjs";
import { createPaymentService } from "../lib/server/payment-service.mjs";
import { deriveKey, seal, mac } from "../lib/server/crypto-state.mjs";

test("all 308 bulk products have valid sourced profiles, with recipes only for culinary ingredients", () => {
  const bulk = catalog.filter((p) => p.isGranel);
  assert.equal(bulk.length, 308);
  for (const p of bulk) {
    const c = profiles[p.id];
    assert.ok(c, p.id);
    validateProductContent({ revision: 0, content: c });
    assert.ok(c.sources.length, p.id);
    if (c.kind === "food") {
      assert.ok(c.recipe, p.id);
      assert.ok(c.recipe.ingredients.length);
      assert.ok(c.recipe.steps.length);
    } else assert.equal(c.recipe, null, p.id);
  }
  assert.equal(profiles["prod-391"].kind, "external");
  assert.match(profiles["prod-391"].usage, /Não ingerir/);
  assert.equal(profiles["prod-101"].kind, "supplement");
  assert.match(profiles["prod-365"].description, /flocos de milho/);
  assert.match(profiles["prod-366"].description, /não é açúcar mascavo puro/);
  assert.match(profiles["prod-125"].usage, /Nunca ingira o pó seco/);
});
test("search suggests Psyllium at three letters and handles accents, aliases and a typo", () => {
  const bulk = catalog.filter((p) => p.isGranel);
  assert.equal(findProducts(bulk, "psy", 7)[0].id, "prod-125");
  assert.equal(findProducts(bulk, "psilium", 7)[0].id, "prod-125");
  assert.equal(findProducts(bulk, "psylliun", 7)[0].id, "prod-125");
  assert.ok(findProducts(bulk, "curcuma").some((p) => p.id === "prod-200"));
  assert.deepEqual(
    findProducts(bulk, "CAMOMILA").map((p) => p.id),
    findProducts(bulk, "camomila").map((p) => p.id),
  );
  assert.equal(findProducts(bulk, "zzzzzzzzzzz").length, 0);
  assert.equal(findProducts(bulk, "", 7).length, 7);
});
test("product content rejects HTML, unexpected fields, oversized values and unsafe sources", () => {
  const base = profiles["prod-270"];
  for (const patch of [
    { description: "<script>hello</script>" },
    { description: "x".repeat(1201) },
    { kind: "external" },
    { sources: [{ title: "Unsafe source", url: "javascript:alert(1)" }] },
    { sources: [{ title: "Local", url: "https://localhost/path" }] },
    { sources: [{ title: "Local", url: "https://127.0.0.1/path" }] },
    {
      sources: [
        { title: "Credentials", url: "https://user:pass@example.com/" },
      ],
    },
    { recipe: { ...base.recipe, steps: ["<b>test</b>"] } },
    { unknown: true },
  ])
    assert.throws(
      () =>
        validateProductContent({ revision: 0, content: { ...base, ...patch } }),
      { code: "INVALID_CONTENT" },
    );
  assert.throws(() => validateProductContent({ revision: -1, content: base }), {
    code: "INVALID_CONTENT",
  });
});
test("default combo recipes follow their actual ingredients", () => {
  const nuts = defaultProductContent({
    id: "combo-castanhas",
    nome_produto: "Castanhas",
    combo: [{ name: "Castanha de caju" }, { name: "Nozes" }],
  });
  assert.match(nuts.recipe.title, /iogurte/);
  const spices = defaultProductContent({
    id: "combo-temperos",
    nome_produto: "Temperos",
    combo: [{ name: "Páprica" }, { name: "Cominho" }],
  });
  assert.match(spices.recipe.title, /Legumes/);
  assert.doesNotMatch(spices.recipe.ingredients.join(" "), /iogurte/);
});
test("reviews require bounded text, valid ratings and explicit publication consent", () => {
  const body = {
    orderId: "ORD01REVIEWFIXTURE",
    productId: "prod-270",
    rating: 4,
    text: "Gostei da textura e da embalagem.",
    publishConsent: true,
  };
  assert.equal(validateReview(body).rating, 4);
  for (const patch of [
    { rating: 0 },
    { rating: 6 },
    { rating: "5" },
    { text: "<img src=x>" },
    { text: "x".repeat(601) },
    { publishConsent: false },
    { publishConsent: "true" },
    { productId: "__shipping__" },
    { orderId: "unknown" },
    { published: true },
  ])
    assert.throws(() => validateReview({ ...body, ...patch }), {
      code: "INVALID_REVIEW",
    });
});
test("review ownership accepts only signed production order cookies with same-origin CSRF for writes", () => {
  const now = 1800000000,
    config = {
      origin: "https://loja.example",
      secure: true,
      accessToken: "APP_USR-" + "fixture".repeat(8),
      environment: "production",
    },
    key = deriveKey(config.accessToken, config.origin),
    jti = "review-session";
  const service = createPaymentService({
    catalog: [],
    policy: {},
    config,
    now: () => now,
  });
  const proof = {
    id: "ORD01REVIEWFIXTURE",
    ref: "verified-fixture-reference",
    totalCents: 1200,
    expires: now + 3600,
  };
  const orderCookie = seal(key, "orders", { orders: [proof] }, now, 3600),
    sessionCookie = seal(key, "session", { jti }, now, 3600);
  const request = (headers = {}) =>
    new Request(config.origin + "/api/reviews", {
      method: "POST",
      headers: {
        Origin: config.origin,
        Cookie: `__Host-mn-orders=${orderCookie}; __Host-mn-checkout=${sessionCookie}`,
        "X-CSRF-Token": mac(key, "csrf", jti),
        ...headers,
      },
    });
  assert.equal(service.reviewOrders(request(), true)[0].id, proof.id);
  assert.throws(
    () =>
      service.reviewOrders(request({ Origin: "https://evil.example" }), true),
    { code: "ORIGIN_REJECTED" },
  );
  assert.throws(
    () => service.reviewOrders(request({ "X-CSRF-Token": "invalid" }), true),
    { code: "CHECKOUT_SESSION_EXPIRED" },
  );
  assert.equal(
    service.reviewOrders(
      request({ Cookie: `__Host-mn-orders=${orderCookie}x` }),
      false,
    ).length,
    0,
  );
  const test = createPaymentService({
    catalog: [],
    policy: {},
    config: { ...config, environment: "test" },
    channel: "sandbox",
    now: () => now,
  });
  assert.throws(() => test.reviewOrders(request(), true), {
    code: "REVIEWS_UNAVAILABLE",
  });
});
