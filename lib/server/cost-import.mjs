import { createHash } from "node:crypto";
import pdv from "../../data/pdv-price-update-2026-11-06.json" with { type: "json" };
import { reject } from "./errors.mjs";

const maxBytes = 1024 * 1024;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const code = (value) => /^[\d .-]+$/.test(String(value || "")) ? String(value).replace(/\D/g, "").replace(/^0+(?=\d)/, "") : "";
const aliases = {
  costColumn: ["CUSTO", "PRECODECUSTO", "CUSTOUNITARIO", "VALORDECUSTO", "PRECOCUSTO", "PRECODECOMPRA", "VALORCOMPRA", "CUSTOMEDIO", "CUSTOMEDIOUNITARIO"],
  nameColumn: ["PRODUTO", "NOMEPRODUTO", "NOMEDOPRODUTO", "DESCRICAO", "DESCRICAODOPRODUTO", "NOME"],
  idColumn: ["IDSITE", "IDMUNDONATURAL", "ID"],
  codeColumn: ["CODIGOPDV", "CODIGO", "COD", "SKU", "CODIGOPRODUTO", "CODIGODEBARRAS", "EAN"],
};
export function decodeCostFile(base64) {
  if (typeof base64 !== "string" || base64.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4)
    reject("INVALID_CSV", "Escolha um arquivo CSV de até 1 MB.");
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > maxBytes || bytes.toString("base64") !== base64)
    reject("INVALID_CSV", "O arquivo CSV está vazio, inválido ou é muito grande.");
  let text;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder("utf-16le", { fatal: true }).decode(bytes);
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder("utf-16be", { fatal: true }).decode(bytes);
    else {
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder("windows-1252").decode(bytes); }
    }
  } catch { reject("INVALID_CSV", "A codificação do arquivo está incompleta. Exporte novamente como CSV."); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]/.test(text))
    reject("INVALID_CSV", "O arquivo contém dados inválidos. Exporte novamente como CSV.");
  return { text: text.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n"), sourceSha: hash(bytes) };
}
export function parseCostCsv(text) {
  // Pick the separator outside quoted fields from the first useful lines.
  const first = text.split("\n").filter((line) => line.trim()).slice(0, 20);
  const separators = [";", ",", "\t"];
  const countsPerLine = first.map((line) => separators.map((delimiter) => {
    let quoted = false, count = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (quoted && line[i + 1] === '"') i++; else quoted = !quoted; }
      else if (!quoted && line[i] === delimiter) count++;
    }
    return count;
  }));
  // Product names and Brazilian decimals may contain other separators. Prefer
  // the header to prevent a long product name from changing the delimiter.
  const knownHeaders = Object.values(aliases).flat();
  let headerCandidate = first.findIndex((line, index) => countsPerLine[index].some(Boolean) && knownHeaders.some((name) => normalize(line).includes(name)));
  if (headerCandidate < 0) headerCandidate = countsPerLine.findIndex((counts) => counts.some(Boolean));
  const counts = countsPerLine[headerCandidate] || [0, 0, 0];
  const delimiter = separators[counts.indexOf(Math.max(...counts))];
  if (!Math.max(...counts)) reject("INVALID_CSV", "Não encontrei as colunas do CSV. Use ponto e vírgula, vírgula ou tabulação.");
  const records = [];
  let row = [], cell = "", quoted = false, closed = false, line = 1, start = 1;
  function finishCell() {
    row.push(cell.trim()); cell = ""; closed = false;
    if (row.length > 80) reject("INVALID_CSV", "O CSV possui colunas demais.");
  }
  function finishRow() {
    finishCell();
    if (row.some(Boolean)) records.push({ line: start, fields: row });
    row = []; start = line + 1;
    if (records.length > 5020) reject("INVALID_CSV", "Importe até 5.000 linhas por arquivo.");
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += ch;
    } else if (ch === '"' && !cell.trim() && !closed) quoted = true;
    else if (ch === delimiter) finishCell();
    else if (ch === "\n") finishRow();
    else if (closed && !/\s/.test(ch)) reject("INVALID_CSV", "Há aspas ou separadores inválidos no CSV.");
    else cell += ch;
    if (ch === "\n") line++;
    if (cell.length > 1000) reject("INVALID_CSV", "O CSV possui um campo muito extenso.");
  }
  if (quoted) reject("INVALID_CSV", "Uma coluna do CSV ficou com aspas abertas.");
  if (cell || row.length) finishRow();
  const detect = (fields, list) => list.map((name) => fields.findIndex((v) => normalize(v) === name)).find((index) => index >= 0) ?? null;
  const index = records.slice(0, 20).findIndex((r) => detect(r.fields, aliases.costColumn) !== null && [aliases.nameColumn, aliases.idColumn, aliases.codeColumn].some((list) => detect(r.fields, list) !== null));
  const header = Math.max(0, index), columns = records[header]?.fields || [];
  if (columns.length < 2) reject("INVALID_CSV", "O arquivo não possui cabeçalho e colunas suficientes.");
  if (records.length - header - 1 > 5000) reject("INVALID_CSV", "Importe até 5.000 linhas por arquivo.");
  return {
    columns: columns.map((label, index) => ({ index, label: label || `Coluna ${index + 1}` })),
    rows: records.slice(header + 1),
    suggested: Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, detect(columns, values)])),
  };
}
export function costCents(value) {
  const text = String(value ?? "").trim().replace(/^R\$\s*/i, "").replace(/[\s\u00a0\u202f]/g, "");
  let canonical;
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) canonical = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(?:\.\d{1,2})?$/.test(text)) canonical = text;
  else return null;
  const [whole, fraction = ""] = canonical.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100000000 ? cents : null;
}
function optionsFor(value, parsed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => ![...Object.keys(aliases), "bulkCostUnit", "mode"].includes(key)))
    reject("INVALID_CSV_OPTIONS", "Revise as colunas e a unidade do custo.");
  const options = { ...parsed.suggested, bulkCostUnit: "kg", mode: "missing", ...value };
  if (!["kg", "100g"].includes(options.bulkCostUnit) || !["missing", "replace"].includes(options.mode))
    reject("INVALID_CSV_OPTIONS", "Escolha a unidade e a forma de atualizar os custos.");
  for (const key of Object.keys(aliases))
    if (options[key] !== null && (!Number.isInteger(options[key]) || options[key] < 0 || options[key] >= parsed.columns.length))
      reject("INVALID_CSV_OPTIONS", "Uma coluna selecionada não existe no arquivo.");
  if (options.costColumn !== null && [options.nameColumn, options.idColumn, options.codeColumn].includes(options.costColumn))
    reject("INVALID_CSV_OPTIONS", "A coluna de custo precisa ser diferente das colunas de identificação.");
  return options;
}
export function previewCostImport(base64, products, requested = {}, pdvRows = pdv.atualizados) {
  const { text, sourceSha } = decodeCostFile(base64), parsed = parseCostCsv(text), options = optionsFor(requested, parsed);
  const byId = new Map(products.map((p) => [p.id, p])), byName = new Map(), byCode = new Map();
  function add(map, key, id) { if (!key) return; if (!map.has(key)) map.set(key, new Set()); map.get(key).add(id); }
  for (const product of products) add(byName, normalize(product.nome_produto), product.id);
  for (const row of pdvRows) if (byId.has(row.id)) {
    add(byCode, code(row.pdvCodigo), row.id); add(byCode, code(row.pdvCodigoBarras), row.id);
  }
  const issues = [], candidates = new Map();
  let alreadyKnown = 0, sameCost = 0;
  if (options.costColumn === null || [options.nameColumn, options.idColumn, options.codeColumn].every((v) => v === null))
    return { columns: parsed.columns, options, sourceSha, rows: parsed.rows.length, entries: [], issues: [{ line: 0, name: "Cabeçalho", reason: "Escolha a coluna de custo e uma coluna de identificação do produto." }], alreadyKnown, sameCost, fingerprint: null };
  for (const row of parsed.rows) {
    const get = (key) => options[key] === null ? "" : (row.fields[options[key]] || ""),
      name = get("nameColumn") || get("idColumn") || get("codeColumn"),
      id = get("idColumn"), amount = costCents(get("costColumn"));
    if (/^(?:prod-|custom-)/.test(id) && !byId.has(id)) {
      issues.push({ line: row.line, name, reason: "O ID do site não existe. Revise a identificação desta linha." }); continue;
    }
    let ids = id && byId.has(id) ? [id] : [];
    if (!ids.length && get("codeColumn")) ids = [...(byCode.get(code(get("codeColumn"))) || [])];
    if (!ids.length && get("nameColumn")) {
      const matches = [...(byName.get(normalize(get("nameColumn"))) || [])];
      if (matches.length > 1) { issues.push({ line: row.line, name, reason: "Nome repetido no catálogo. Use o ID do site ou o código do PDV." }); continue; }
      ids = matches;
    }
    if (!ids.length) { issues.push({ line: row.line, name, reason: "Produto sem correspondência segura no catálogo." }); continue; }
    if (amount === null) { issues.push({ line: row.line, name, reason: "Custo vazio ou inválido. Use um valor positivo ou zero explícito, com até duas casas decimais." }); continue; }
    for (const productId of ids) {
      const product = byId.get(productId), value = amount * (product.isGranel && options.bulkCostUnit === "100g" ? 10 : 1);
      if (value > 100000000) { issues.push({ line: row.line, name, reason: "Custo acima do limite após a conversão da unidade." }); continue; }
      if (!candidates.has(productId)) candidates.set(productId, []);
      candidates.get(productId).push({ costCents: value, line: row.line });
    }
  }
  const entries = [];
  for (const [id, rows] of candidates) {
    const product = byId.get(id), values = new Set(rows.map((r) => r.costCents));
    if (values.size > 1) { issues.push({ line: rows[0].line, name: product.nome_produto, reason: "Este produto aparece com custos diferentes. Revise as linhas repetidas no CSV." }); continue; }
    if (options.mode === "missing" && product.costCents !== null && product.costCents !== undefined) { alreadyKnown++; continue; }
    const value = rows[0].costCents;
    if (product.costCents === value) { sameCost++; continue; }
    entries.push({ id, name: product.nome_produto, isBulk: !!product.isGranel, beforeCostCents: product.costCents ?? null, costCents: value, line: rows[0].line });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const fingerprint = hash(JSON.stringify({ sourceSha, options, entries: entries.map(({ id, isBulk, beforeCostCents, costCents }) => ({ id, isBulk, beforeCostCents, costCents })) }));
  return { columns: parsed.columns, options, sourceSha, rows: parsed.rows.length, entries, issues, alreadyKnown, sameCost, fingerprint };
}
export function createCostImportService({ repository }) {
  async function preview(body) {
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((k) => !["fileBase64", "options", "fingerprint"].includes(k)))
      reject("INVALID_CSV", "Revise o arquivo e as opções de importação.");
    if (!repository) reject("DATABASE_REQUIRED", "Configure o banco de dados da loja.", 503);
    return previewCostImport(body.fileBase64, await repository.catalog(true), body.options || {});
  }
  async function apply(body) {
    const value = await preview(body);
    if (typeof body.fingerprint !== "string" || !value.fingerprint || body.fingerprint !== value.fingerprint)
      reject("COST_IMPORT_CHANGED", "Os custos ou o arquivo mudaram. Confira uma nova prévia antes de aplicar.", 409);
    if (!value.entries.length) reject("EMPTY_COST_IMPORT", "Não há custos novos para aplicar nesta prévia.");
    await repository.importCosts(value.entries, value.sourceSha, value.options.mode);
    return { updated: value.entries.length, skipped: value.issues.length, sourceSha: value.sourceSha };
  }
  return { preview, apply };
}
