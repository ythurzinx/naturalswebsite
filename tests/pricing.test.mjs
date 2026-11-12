import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BULK_WEIGHTS,
  isBulkWeight,
  referencePriceCents,
  portionPriceCents,
} from "../lib/pricing.mjs";
import { lineTotal, serializeCart, hydrateCart } from "../lib/commerce.mjs";
import { buildCheckout } from "../lib/server/checkout-core.mjs";

const bulk = {
  id: "bulk",
  nome_produto: "Castanha",
  isGranel: true,
  valor_unitario: 129.95,
};
const policy = {
  pricesConfirmedByMerchant: true,
  onlinePickupEnabled: true,
  maxOrderCents: 1000000,
  maxDistinctLines: 20,
  maxQuantityPerLine: 20,
  disabledProductIds: [],
};
function checkout(weight, expectedTotalCents) {
  return buildCheckout(
    {
      name: "Maria Silva",
      email: "maria@example.com",
      fulfillment: "pickup",
      items: [{ id: bulk.id, weight, quantity: 3 }],
      expectedTotalCents,
    },
    [bulk],
    policy,
  );
}

test("100 g is the rounded sale unit, so three 100 g blocks have the advertised price", () => {
  assert.equal(referencePriceCents(bulk), 1300);
  assert.equal(portionPriceCents(bulk, 300), 3900);
  assert.equal(
    lineTotal({ product: bulk, selectedWeight: 300, quantity: 3 }),
    117,
  );
  assert.equal(checkout(300, 11700).items[0].unitCents, 3900);
  assert.throws(() => checkout(300, 11697), { code: "PRICE_CHANGED" });
  assert.equal(referencePriceCents({ ...bulk, isGranel: false }), 12995);
});

test("each 100 g increment survives storage and matches the authoritative checkout", () => {
  for (const weight of BULK_WEIGHTS) {
    const item = { product: bulk, selectedWeight: weight, quantity: 3 };
    const expected = 1300 * (weight / 100) * 3;
    assert.ok(isBulkWeight(weight));
    assert.equal(Math.round(lineTotal(item) * 100), expected);
    assert.equal(checkout(weight, expected).totalCents, expected);
    assert.equal(
      hydrateCart(serializeCart([item]), [bulk])[0].selectedWeight,
      weight,
    );
  }
  for (const weight of [
    0,
    1,
    99,
    150,
    250,
    5010,
    5100,
    -100,
    100.5,
    "100",
    NaN,
    Infinity,
  ]) {
    assert.equal(isBulkWeight(weight), false);
    assert.throws(() => checkout(weight, 3900), { code: "INVALID_WEIGHT" });
  }
});

test("all 308 bulk catalog products use the 100 g label and positive sale prices", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../lib/catalog.json", import.meta.url), "utf8"),
  );
  const items = catalog.filter((product) => product.isGranel);
  assert.equal(items.length, 308);
  for (const product of items) {
    assert.equal(product.peso_produto, "A granel · preço por 100 g");
    assert.ok(referencePriceCents(product) > 0);
  }
  assert.equal(
    referencePriceCents(
      items.find((p) => p.nome_produto === "Castanha de Caju Crua"),
    ),
    1200,
  );
  assert.equal(
    referencePriceCents(
      items.find((p) => p.nome_produto === "Aveia Flocos Finos"),
    ),
    150,
  );
  const packaged = catalog.find((p) => p.id === "prod-1");
  assert.equal(packaged.isGranel, false);
  assert.equal(referencePriceCents(packaged), 7799);
});
