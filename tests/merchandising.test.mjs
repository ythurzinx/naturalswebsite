import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { allocateCombo, applyMerchandising } from "../lib/merchandising.mjs";
import { validateMerchandising } from "../lib/server/merchandising-validation.mjs";
import { buildCheckout } from "../lib/server/checkout-core.mjs";
import {
  defaultProductVisible,
  editedProductVisible,
} from "../lib/catalog-visibility.mjs";
import { referencePriceCents } from "../lib/pricing.mjs";
const catalog = [
  {
    id: "prod-1",
    nome_produto: "Caju",
    valor_unitario: 119.99,
    isGranel: true,
    active: true,
  },
  {
    id: "prod-2",
    nome_produto: "Nozes",
    valor_unitario: 137.5,
    isGranel: true,
    active: true,
  },
  {
    id: "prod-3",
    nome_produto: "Frasco",
    valor_unitario: 30,
    isGranel: false,
    active: false,
  },
];
const settings = () => ({
  revision: 0,
  offers: [],
  combos: [
    {
      id: "combo-castanhas",
      name: "Combo de castanhas",
      description: "Porções separadas",
      active: true,
      discountPercent: 7,
      components: [
        { productId: "prod-1", weight: 300 },
        { productId: "prod-2", weight: 100 },
      ],
    },
  ],
});
const policy = {
  pricesConfirmedByMerchant: true,
  onlinePickupEnabled: true,
  maxOrderCents: 1000000,
  maxDistinctLines: 20,
  maxQuantityPerLine: 20,
  disabledProductIds: [],
};
const checkout = (
  products,
  total,
  items = [{ id: "combo-castanhas", quantity: 3 }],
) =>
  buildCheckout(
    {
      name: "Cliente Teste",
      email: "cliente@example.invalid",
      fulfillment: "pickup",
      items,
      expectedTotalCents: total,
    },
    products,
    policy,
  );

test("combo cents are allocated exactly even with unequal portions and rounding", () => {
  const products = applyMerchandising(catalog, settings());
  const combo = products.find((p) => p.combo);
  assert.equal(combo.originalPriceCents, 4975);
  assert.equal(referencePriceCents(combo), 4627);
  assert.equal(
    combo.combo.reduce((s, c) => s + c.unitCents, 0),
    4627,
  );
  const selection = checkout(products, 13881);
  assert.equal(selection.items.length, 2);
  assert.equal(
    selection.items.reduce((s, i) => s + i.quantity * i.unitCents, 0),
    13881,
  );
  assert.ok(
    selection.items.every((i) => i.key.startsWith("combo-castanhas|prod-")),
  );
  assert.throws(() => checkout(products, 100), { code: "PRICE_CHANGED" });
  assert.throws(
    () =>
      checkout(products, 13881, [
        {
          id: combo.id,
          quantity: 3,
          components: [{ productId: "prod-1", weight: 5000 }],
        },
      ]),
    { code: "INVALID_CART" },
  );
  for (let discount = 0; discount <= 80; discount++) {
    const value = allocateCombo(
      [{ regularCents: 799 }, { regularCents: 1237 }, { regularCents: 2951 }],
      discount,
    );
    assert.equal(
      value.components.reduce((s, c) => s + c.unitCents, 0),
      value.totalCents,
    );
  }
});
test("offers expire, never stack on combos, and unavailable ingredients hide the entire bundle", () => {
  const config = settings();
  config.offers = [
    {
      productId: "prod-1",
      active: true,
      discountPercent: 10,
      startsAt: 1000,
      endsAt: 3000,
    },
  ];
  let products = applyMerchandising(catalog, config, 2000);
  assert.equal(referencePriceCents(products[0]), 1080);
  assert.equal(products[0].originalPriceCents, 1200);
  assert.equal(referencePriceCents(products.find((p) => p.combo)), 4627);
  assert.equal(
    referencePriceCents(applyMerchandising(catalog, config, 3000)[0]),
    1200,
  );
  assert.ok(!applyMerchandising(catalog.slice(1), config).some((p) => p.combo));
  assert.throws(
    () => checkout(applyMerchandising(catalog.slice(1), config), 4627),
    { code: "PRODUCT_UNAVAILABLE" },
  );
  const changed = applyMerchandising(
    catalog.map((p) => ({ ...p, valor_unitario: p.valor_unitario + 10 })),
    config,
  );
  assert.throws(() => checkout(changed, 13881), { code: "PRICE_CHANGED" });
});
test("merchandising rejects nested combos, duplicate ingredients, invalid discounts, periods and arbitrary fields", () => {
  assert.deepEqual(validateMerchandising(settings(), catalog), settings());
  const cases = [
    { ...settings(), revision: -1 },
    { ...settings(), token: "secret" },
    {
      ...settings(),
      offers: [
        {
          productId: "prod-1",
          active: true,
          discountPercent: 101,
          startsAt: null,
          endsAt: null,
        },
      ],
    },
    {
      ...settings(),
      offers: [
        {
          productId: "prod-1",
          active: true,
          discountPercent: 10,
          startsAt: 3000,
          endsAt: 1000,
        },
      ],
    },
    {
      ...settings(),
      offers: [
        {
          productId: "prod-1",
          active: true,
          discountPercent: 10,
          startsAt: null,
          endsAt: null,
          priceCents: 1,
        },
      ],
    },
  ];
  for (const change of [
    { id: "../../file" },
    { discountPercent: -1 },
    { active: "yes" },
    { name: "<script>" },
    {
      components: [
        { productId: "combo-castanhas", weight: 100 },
        { productId: "prod-1", weight: 100 },
      ],
    },
    {
      components: [
        { productId: "prod-1", weight: 100 },
        { productId: "prod-1", weight: 200 },
      ],
    },
    {
      components: [
        { productId: "prod-1", weight: 250 },
        { productId: "prod-2", weight: 100 },
      ],
    },
    {
      components: [
        { productId: "prod-1", weight: 100 },
        { productId: "prod-3", weight: 100 },
      ],
    },
  ])
    cases.push({
      ...settings(),
      combos: [{ ...settings().combos[0], ...change }],
    });
  for (const value of cases)
    assert.throws(() => validateMerchandising(value, catalog));
});
test("expanded combo cart stays below the provider's item limit and rejects hidden packaged items", () => {
  const base = Array.from({ length: 8 }, (_, i) => ({
    ...catalog[0],
    id: `prod-${i + 10}`,
  }));
  const config = {
    offers: [],
    combos: Array.from({ length: 7 }, (_, i) => ({
      ...settings().combos[0],
      id: `combo-${i}`,
      discountPercent: 0,
      components: base.map((p) => ({ productId: p.id, weight: 100 })),
    })),
  };
  const products = applyMerchandising(base, config);
  assert.throws(
    () =>
      checkout(
        products,
        1000,
        config.combos.map((c) => ({ id: c.id, quantity: 1 })),
      ),
    { code: "CART_LIMIT" },
  );
});
test("bulk-only reset preserves admin inventory and requires a new deliberate activation for legacy units", async () => {
  const actual = JSON.parse(
    await readFile(new URL("../lib/catalog.json", import.meta.url)),
  );
  const actualPolicy = JSON.parse(
    await readFile(new URL("../lib/sales-policy.json", import.meta.url)),
  );
  const publicProducts = actual.filter((p) =>
    defaultProductVisible(p, actualPolicy),
  );
  assert.equal(publicProducts.length, 308);
  assert.ok(publicProducts.every((p) => p.isGranel));
  assert.ok(publicProducts.some((p) => p.id === "prod-209"));
  assert.ok(!publicProducts.some((p) => p.id === "prod-614"));
  const base = actual.find((p) => p.id === "prod-1");
  assert.equal(
    editedProductVisible(
      {
        id: base.id,
        active: 1,
        updated_at: actualPolicy.legacyActivationAfter - 1,
      },
      actualPolicy,
    ),
    false,
  );
  assert.equal(
    editedProductVisible(
      {
        id: base.id,
        active: 1,
        updated_at: actualPolicy.legacyActivationAfter + 1,
      },
      actualPolicy,
    ),
    true,
  );
  // Visibility follows the current database classification, including products
  // converted from units to bulk (or back) before the catalog reset.
  assert.equal(
    editedProductVisible(
      { id: "prod-1", is_bulk: 1, active: 1, updated_at: 0 },
      actualPolicy,
    ),
    true,
  );
  assert.equal(
    editedProductVisible(
      { id: "prod-270", is_bulk: 0, active: 1, updated_at: 0 },
      actualPolicy,
    ),
    false,
  );
  assert.equal(
    editedProductVisible(
      { id: "custom-old", is_bulk: 0, active: 1, updated_at: 0 },
      actualPolicy,
    ),
    false,
  );
  assert.equal(
    editedProductVisible(
      {
        id: "custom-test",
        active: 1,
        updated_at: actualPolicy.legacyActivationAfter + 1,
      },
      actualPolicy,
    ),
    true,
  );
  assert.throws(
    () => checkout(publicProducts, 7799, [{ id: "prod-1", quantity: 1 }]),
    { code: "PRODUCT_UNAVAILABLE" },
  );
});
