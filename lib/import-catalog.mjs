const categories = [
  ["Chás e ervas", /^(CHA\b|CAMOMILA|ERVA DOCE|HORTELA|HIBISCO|CAPIM CIDREIRA|CAVALINHA|ALFAZEMA)/],
  ["Mel e derivados", /^(MEL\b|EXTRATO DE PROPOLIS|PROPOLIS|GELEIA REAL|BALA COM (MEL|EUCALIPTO))/],
  ["Castanhas e sementes", /^(CASTANHA|AMENDOA|NOZES|AMENDOIM|PISTACHE|MACADAMIA|LINHACA|CHIA|SEMENTE|MIX DE CASTANHA)/],
  ["Grãos e cereais", /^(GRANOLA|AVEIA|QUINOA|ARROZ|FEIJAO|LENTILHA|GRAO DE BICO|CEREAL|FARINHA|TAPIOCA)/],
  ["Temperos", /^(TEMPERO|PAPRIKA|PIMENTA\b|OREGANO|ALECRIM|CURCUMA|ACAFRAO|COMINHO|CANELA EM|MANJERICAO)/],
  ["Lanches e naturais", /^(NUTS BAR|BARRA (DE CEREA|AMENDOIM|PROTE)|TRIO BARRA|BISC.*INTEGRAL|UVA PASSA|DAMASCO|TAMARA|BANANA PASSA)/],
  ["Suplementos", /\b(WHEY|CREATINA|COLAGENO|PROTEINA|CAPSULA|CAPSULAS|CPS|CAPS)\b/],
]
const size = /(?<![0-9.,])(\d+(?:[.,]\d+)?)\s*(KG|MG|GR|G|ML|LITROS?|L|CPS|CAPSULAS?|CAPS|SACHES?|UND|UN)\b/
const units = {"GR": "g", "LITRO": "L", "LITROS": "L", "CPS": "cápsulas", "CAPS": "cápsulas", "CAPSULA": "cápsulas", "CAPSULAS": "cápsulas", "UN": "un", "UND": "un", "SACHE": "sachê", "SACHES": "sachês", "ML": "ml", "L": "L"}

// Quoted report headers span multiple lines. Never split a report by newlines.
function* csvRows(input) {
  let row = [], field = "", quoted = false, closed = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch !== '"') field += ch
      else if (input[i + 1] === '"') { field += '"'; i++ }
      else { quoted = false; closed = true }
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(field)
      field = ""
      closed = false
      if (ch !== ',') {
        if (ch === '\r' && input[i + 1] === '\n') i++
        if (row.length !== 1 || row[0] !== '') yield row
        row = []
      }
    } else if (!field && !closed && ch === '"') quoted = true
    else if (closed || ch === '"') throw Error("Aspas inválidas no CSV.")
    else field += ch
  }
  if (quoted) throw Error("Campo entre aspas incompleto.")
  if (row.length || field || closed) yield [...row, field]
}

function number(value) {
  const str = value.trim()
  if (!/^[-+]?[\d.,]+$/.test(str)) return NaN
  return Number(str.includes(",") ? str.replaceAll(".", "").replace(",", ".") : str)
}

export function parseCatalogCsv(input) {
  const products = [], seen = new Set()
  for (const row of csvRows(input.replace(/^\uFEFF/, ""))) {
    if (row.length !== 20 || row[5].trim() !== "Descrição" || row[9].trim() !== "Venda")
      throw Error("Utilize o relatório de preços da Mundo Natural.")
    const id = row[10].replaceAll(".", "")
    if (!/^\d{1,20}$/.test(id) || seen.has(id)) throw Error("Código inválido ou duplicado.")
    seen.add(id)
    const name = row[12].trim().replace(/\s+/g, " ") || ("Produto " + id)
    if (name.length > 256) throw Error("Nome de produto muito longo.")
    const plain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    const category = categories.find(([, pattern]) => pattern.test(plain))?.[0] || "Outros"
    const match = plain.match(size)
    const weight = match ? match[1].replace(".", ",") + " " + (units[match[2]] || match[2].toLowerCase()) : ""
    const reportedStock = number(row[14]), cents = Math.round(number(row[16]) * 100)
    const stock = Number.isSafeInteger(reportedStock) && reportedStock > 0 ? reportedStock : 0
    const price = Number.isSafeInteger(cents) && cents > 0 ? cents : 0
    const packaged = weight && !/\b(GRANEL|FRACIONADO|POR KG|ALCOOL|VINHO|CERVEJA|TABACO|CIGARRO)\b/.test(plain)
    const active = Boolean(category !== "Outros" && stock && price && packaged)
    products.push([id, name, category, weight, price, stock, active])
  }
  if (!products.length) throw Error("Relatório vazio.")
  return products
}
