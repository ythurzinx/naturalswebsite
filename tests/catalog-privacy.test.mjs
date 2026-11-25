import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../lib/catalog.json" with { type: "json" };
import { publicProduct } from "../lib/public-product.mjs";

test("the public catalog removes private finance and inventory fields, including nested combo metadata", () => {
  const input = {
    id: "prod-1", nome_produto: "Aveia", peso_produto: "kg", isGranel: true,
    categoria: "Grãos", valor_unitario: 17,
    costCents: 987654321, cost_cents: 987654321, custo: 987654321,
    quantidade: 127, total_unitario: 987654321, estoque_minimo: 30,
    active: true, notes: "private supplier contract",
    combo: [{productId: "prod-2", name: "Chia", weight: 100, regularCents: 1000, unitCents: 900, costUnitCents: 987654321}],
  };
  const output = publicProduct(input);
  assert.equal(output.valor_unitario, input.valor_unitario);
  assert.equal(output.combo[0].unitCents, 900);
  assert.deepEqual(Object.keys(output).sort(), ["categoria", "combo", "id", "isGranel", "nome_produto", "peso_produto", "valor_unitario"]);
  assert.doesNotMatch(JSON.stringify(output), /987654321|cost|custo|estoque|quantidade|supplier/);
});
test("the catalog bundled with the storefront contains only customer-facing fields", () => {
  assert.equal(catalog.length, 619);
  for (const product of catalog) {
    assert.equal(product.valor_unitario > 0, true, product.id);
    assert.deepEqual(product, publicProduct(product), product.id);
  }
});
