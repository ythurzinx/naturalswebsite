import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hydrateCart,
  serializeCart,
  cartTotal,
  lineTotal,
  itemKey,
  normalizeQuantity,
} from "../lib/commerce.mjs";
const product = { id: "oats", valor_unitario: 15, isGranel: true };
const packaged = { id: "peanut", valor_unitario: 19.99, isGranel: false };
const now = 1800000000000;
test("bulk totals multiply the chosen weight by the quantity", () => {
  const item = { product, quantity: 3, selectedWeight: 250 };
  assert.equal(lineTotal(item), 11.25);
  assert.equal(cartTotal([item, { product: packaged, quantity: 2 }]), 51.23);
});
test("different weights of one product have different cart keys", () => {
  assert.notEqual(
    itemKey({ product, selectedWeight: 100 }),
    itemKey({ product, selectedWeight: 500 }),
  );
});
test("rehydration uses current catalog prices and never a stored product object", () => {
  const raw = JSON.stringify({
    version: 2,
    savedAt: now,
    items: [
      {
        id: "oats",
        quantity: 2,
        weight: 500,
        product: { ...product, valor_unitario: 0.01 },
      },
    ],
  });
  const items = hydrateCart(raw, [product], now);
  assert.equal(items[0].product, product);
  assert.equal(cartTotal(items), 15);
});
test("corrupt, oversized, expired and future cart data fail safely", () => {
  for (const value of [
    "invalid",
    "x".repeat(30001),
    JSON.stringify({ version: 2, savedAt: now - 31 * 86400000, items: [] }),
    JSON.stringify({ version: 2, savedAt: now + 1, items: [] }),
    "null",
  ])
    assert.deepEqual(hydrateCart(value, [product], now), []);
});
test("unknown products and unsafe quantities cannot enter a recovered cart", () => {
  const items = [
    { id: "unknown", quantity: 1 },
    { id: "oats", quantity: -1 },
    { id: "oats", quantity: Infinity },
    { id: "oats", quantity: 999999 },
    { id: "oats", quantity: 1.4 },
    { id: "oats", quantity: "2" },
  ];
  assert.deepEqual(
    hydrateCart(
      JSON.stringify({ version: 2, savedAt: now, items }),
      [product],
      now,
    ),
    [],
  );
  assert.equal(normalizeQuantity(NaN), 1);
});
test("round trip keeps only ids, quantities and supported weights", () => {
  const original = [
    { product, quantity: 2, selectedWeight: 100 },
    { product: packaged, quantity: 3 },
  ];
  const serialized = serializeCart(original, now);
  assert.equal(serialized.includes("valor_unitario"), false);
  const restored = hydrateCart(serialized, [product, packaged], now);
  assert.equal(cartTotal(restored), 62.97);
});
test("duplicate rows are merged, capped, and unsupported weights normalized", () => {
  const items = hydrateCart(
    JSON.stringify({
      version: 2,
      savedAt: now,
      items: [
        { id: "oats", quantity: 90, weight: 500 },
        { id: "oats", quantity: 90, weight: 500 },
        { id: "oats", quantity: 1, weight: -500 },
      ],
    }),
    [product],
    now,
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].quantity, 99);
  assert.equal(items[1].selectedWeight, 250);
});
