import { test } from "node:test";
import assert from "node:assert/strict";
import { previewCostImport, parseCostCsv, costCents, createCostImportService } from "../lib/server/cost-import.mjs";
const products = [
  { id: "prod-1", nome_produto: "Castanha do Pará", isGranel: true, costCents: null, priceCents: 16000 },
  { id: "prod-2", nome_produto: "Óleo de coco 200 ml", isGranel: false, costCents: null, priceCents: 2000 },
];
const file = (text) => Buffer.from(text).toString("base64");

test("cost imports read the cost column, retain zero, and keep sale prices separate", () => {
  const csv = 'ID;Produto;Preço de custo;Venda\nprod-1;Castanha do Pará;"R$ 80,45";160,00\nprod-2;Óleo de coco 200 ml;0;20,00';
  const preview = previewCostImport(file(csv), products);
  assert.deepEqual(preview.entries.map((e) => [e.id, e.costCents]), [["prod-1", 8045], ["prod-2", 0]]);
  assert.equal(preview.issues.length, 0);
  assert.equal(products[0].priceCents, 16000);
  assert.ok(!preview.entries.some((e) => e.costCents === 16000));
  assert.equal(preview.options.bulkCostUnit, "kg");
});
test("the selected bulk unit converts 100 g to canonical kg without converting packaged units", () => {
  const preview = previewCostImport(file("ID;Custo\nprod-1;8,05\nprod-2;12,34"), products, { bulkCostUnit: "100g" });
  assert.deepEqual(preview.entries.map((e) => e.costCents), [8050, 1234]);
});
test("costs are not inferred from a selling price and only missing costs change by default", () => {
  const selling = previewCostImport(file("ID;Venda\nprod-1;160,00"), products);
  assert.equal(selling.entries.length, 0);
  assert.equal(selling.fingerprint, null);
  const existing = products.map((p) => ({ ...p, costCents: 8000 }));
  const csv = file("ID;Custo\nprod-1;85,00");
  assert.equal(previewCostImport(csv, existing).alreadyKnown, 1);
  assert.equal(previewCostImport(csv, existing).entries.length, 0);
  assert.equal(previewCostImport(csv, existing, { mode: "replace" }).entries[0].costCents, 8500);
});
test("cost CSVs support quoted separators, UTF-8 and legacy Excel text encodings", () => {
  const csv = 'Produto;Custo\n"Castanha do Pará";"80,45"';
  const variants = [Buffer.from('\ufeff' + csv), Buffer.from(csv, "latin1"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, "utf16le")])];
  for (const bytes of variants) {
    const preview = previewCostImport(bytes.toString("base64"), products);
    assert.equal(preview.entries[0].costCents, 8045);
  }
  const parsed = parseCostCsv('ID,Produto,Custo\nprod-1,"Castanha, tipo ""Premium""","80,45"');
  assert.equal(parsed.rows[0].fields[1], 'Castanha, tipo "Premium"');
  assert.equal(costCents("1.234,56"), 123456);
  assert.equal(costCents("1234.56"), 123456);
  assert.equal(costCents(0), 0);
  const commaName = "Castanha, nozes, amêndoa, amendoim, passas";
  const semicolon = previewCostImport(file(`Produto;Custo\n${commaName};80,45`), [{ ...products[0], nome_produto: commaName }]);
  assert.equal(semicolon.entries[0].costCents, 8045);
  for (const value of ["", "-1", "1,234", "=10*2", "R$ abc", "1e3", "Infinity"]) assert.equal(costCents(value), null);
});
test("matching uses stable IDs or recorded PDV codes, skips unknown IDs and rejects conflicting duplicates", () => {
  const preview = previewCostImport(file("Código;Descrição;Custo\n405;Descrição do PDV diferente;80,45"), products, {}, [
    { id: "prod-1", pdvCodigo: 405, pdvCodigoBarras: "2000405" },
  ]);
  assert.equal(preview.entries[0].id, "prod-1");
  const conflict = previewCostImport(file("ID;Produto;Custo\nprod-1;Castanha do Pará;80,45\nprod-1;Castanha do Pará;81,00\nprod-999;Castanha do Pará;70,00"), products);
  assert.equal(conflict.entries.length, 0);
  assert.equal(conflict.issues.length, 2);
  const ambiguous = previewCostImport(file("Produto;Custo\nCastanha do Pará;80,45"), [...products, { ...products[0], id: "prod-3" }]);
  assert.equal(ambiguous.entries.length, 0);
  assert.match(ambiguous.issues[0].reason, /Nome repetido/);
});
test("a cost import must match the current preview and cannot apply a changed file or cost snapshot", async () => {
  let current = structuredClone(products), writes = 0;
  const service = createCostImportService({ repository: {
    catalog: async () => current,
    importCosts: async () => { writes++; },
  } });
  const body = { fileBase64: file("ID;Custo\nprod-1;80,45"), options: { mode: "replace" } };
  const initial = await service.preview(body);
  current[0].costCents = 7900;
  await assert.rejects(service.apply({ ...body, fingerprint: initial.fingerprint }), { code: "COST_IMPORT_CHANGED" });
  current = structuredClone(products);
  await assert.rejects(service.apply({ ...body, fileBase64: file("ID;Custo\nprod-1;81,00"), fingerprint: initial.fingerprint }), { code: "COST_IMPORT_CHANGED" });
  assert.equal(writes, 0);
  await service.apply({ ...body, fingerprint: initial.fingerprint });
  assert.equal(writes, 1);
});
test("binary, oversized and unfinished CSV files and invalid option fields are rejected", () => {
  for (const input of ["", "abc", file("Nome;Custo\n\x00;1"), file("Nome;Custo\n" + "x".repeat(1100000)), file('Nome;Custo\n"Nunca fecha;1')])
    assert.throws(() => previewCostImport(input, products), { code: "INVALID_CSV" });
  assert.throws(() => previewCostImport(file("ID;Custo\nprod-1;10"), products, { costColumn: 80 }), { code: "INVALID_CSV_OPTIONS" });
  assert.throws(() => previewCostImport(file("ID;Custo\nprod-1;10"), products, { priceCents: 1 }), { code: "INVALID_CSV_OPTIONS" });
});
