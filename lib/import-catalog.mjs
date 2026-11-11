import { displayProductName, excludedProduct } from "./catalog-names.mjs";
// Scale codes with fractional balances in the reviewed POS export.
const knownBulkCodes = new Set(
  "2000200 2000300 2000400 2000500 2000600 2000700 2000800 2000900 2001000 2001100 2001200 2001300 2001400 2001500 2001600 2001700 2001800 2001900 2002100 2002200 2002300 2002400 2002500 2002600 2002700 2002800 2002900 2003000 2003100 2003200 2003300 2003400 2003500 2003600 2003700 2003800 2003900 2004000 2004100 2004200 2004300 2004400 2004500 2004600 2004700 2004800 2004900 2005000 2005100 2005200 2005300 2005400 2005500 2005600 2005700 2005800 2005900 2006000 2006100 2006200 2006300 2006400 2006500 2006600 2006700 2007100 2007200 2007300 2007400 2007500 2007600 2007700 2007800 2007900 2008000 2008100 2008200 2008300 2008400 2008500 2008600 2008700 2008800 2008900 2009000 2009100 2009200 2009300 2009400 2009500 2009600 2009700 2009800 2009900 2010000 2010100 2010200 2010300 2010400 2010500 2010600 2010700 2010800 2010900 2011000 2011200 2011300 2011400 2011500 2011600 2011700 2011800 2011900 2012000 2012100 2012200 2012300 2012400 2012500 2012600 2012700 2012800 2012900 2013000 2013100 2013200 2013300 2013400 2013500 2013600 2013700 2013800 2013900 2014000 2014100 2014200 2014300 2014400 2014500 2014600 2014700 2014800 2014900 2015000 2015100 2015200 2015300 2015400 2015500 2015600 2015700 2015800 2015900 2016000 2016100 2016200 2016300 2016400 2016500 2016600 2016700 2016800 2016900 2017000 2017100 2017200 2017300 2017400 2017500 2017600 2017700 2017800 2017900 2018000 2018100 2018200 2018300 2018400 2018500 2018600 2018700 2018800 2018900 2019000 2019100 2019200 2019300 2019400 2019500 2019600 2019700 2019800 2019900 2020000 2020100 2020200 2020300 2020400 2020500 2020600 2020700 2020800 2020900 2021000 2021100 2021200 2021300 2021400 2021500 2021600 2021800 2021900 2022100 2022200 2022300 2022400 2022500 2022600 2022700 2022800 2022900 2023000 2023100 2023400 2023500 2023600 2023700 2023800 2023900 2024200 2024400 2024500 2024600 2024700 2024800 2025400 2025600 2025800 2025900 2026000 2026100 2026200 2026300 2026400 2026500 2026600 2026700 2026800 2026900 2027000 2027100 2027200 2027300 2027400 2027500 2027700 2027800 2027900 2028000 2028100 2028200 2028300 2028500 2028800 2028900 2029000 2029100 2029300 2029400 2029500 2029600 2029700 2029800 2029900 2030100 2030200 2030300 2030400 2030500 2030600 2030800 2030900 2031000 2031100 2031200 2031300 2031400 2031600 2032600 2032700 2032800 2033000 2035000 2036000 2039700 2039800 2039900 2041000 2041500 2042000 2042600 2042800 2042900 2043000 2043100 2043200 2043700 2044100 2044200 2044300 2044400 2044500 2044600 2044700 2044800 2044900 2045000 2045800 2045900 2046000 2046100 2046600 2046700 2046800 2047000 2047100 2047200 2047300 2048100 2048200 2048300 2048500 2048600 2048700 2048800 2048900 2049100 2049600 2055200 2055400 2055500 2055800 2055900 2056600 2056800 2056900 2057000 2057100 2057200 2057300 2057400 2057600 2057700 2057900 2058000 2058100 2058300 2058400 2058800 2058900 2059100 2059600 2059700 2060000 2060300 2060400 2060500 2060600 2066300 2066500 2066700 2066800 2066900 2069600 2069700 2069800 2070100 2070300 2070400 2070500 2070600 2070800 2070900 2071500 2072900 2073100 2073400 2075300 2075400 2077000 2077100 2078000 2078200 2078400 2078500 2078600 2078800 2080100 2080300 2082100 2083000 2085800 2087100 2087300 2087400 2087500 2087600 2087700 2087800 2087900 2088000 2088100 2088200 2088300 2088500 2088600 2088700 2088800 2088900 2089000 2089100 2089200 2089300 2089400 2089500 2089600 2089700 2089900 2092200 2093100 2095400 2096300 2096400 2096500 2096700 2096800 2096900 2097000 2097500 2097600 2097800 2097900 2098000 2098100 2098200 2098300 2098400 2098500 2098600 2098700 2098800 2099000 2099100 2099200 2099300 2099500 2099600 2099800 2100100 2100200 2100300 2100400 2100500 2100600 2100700 2100800 2100900 2101600 2101700 2101800 2101900 2106100 2106200 2106300 2106400 2106500 2106600 2106700 2106800 2106900 2107000 2107100 2107200 2107300 2109100 2109200 2109400 2109500 2109600".split(
    " ",
  ),
);

const categories = [
  [
    "Chás e ervas",
    /^(CHA\b|CAMOMILA|ERVA DOCE|HORTELA|HIBISCO|CAPIM CIDREIRA|CAVALINHA|ALFAZEMA|HIBISCUS|BOLDO DO CHILE|TANCHAGEM)/,
  ],
  [
    "Mel e derivados",
    /^(MEL\b|EXTRATO DE PROPOLIS|PROPOLIS|GELEIA REAL|BALA COM (MEL|EUCALIPTO))/,
  ],
  [
    "Castanhas e sementes",
    /^(CASTANHA|AMENDOA|NOZES|AMENDOIM|PISTACHE|AVELA|GERGELIM|MACADAMIA|LINHACA|CHIA|SEMENTE|MIX DE CASTANHA)/,
  ],
  [
    "Grãos e cereais",
    /^(GRANOLA|AVEIA|QUINOA|ARROZ|FEIJAO|LENTILHA|GRAO DE BICO|CEREAL|FARINHA|TAPIOCA|AMARANTO|CANJICA|ERVILHA|FAVA|FECULA|FUBA|TRIGO|QUINUA|MILHO PARA PIPOCA|POLVILHO|GERME DE TRIGO)/,
  ],
  [
    "Temperos",
    /^(TEMPERO|PAPRIKA|PIMENTA\b|OREGANO|ALECRIM|CURCUMA|ACAFRAO|COMINHO|CANELA EM|MANJERICAO|ALHO|CEBOLA|ANIS ESTRELADO|COLORAU|COENTRO|CRAVO|CURRY|CHIMI CHURRI|ERVAS FINAS|LEMON PEPPER|LOURO|SAL DO HIMALAIA|SALSA|TOMILHO|VINAGRETE|NOZ MOSCADA|MOSTARDA EM PO)/,
  ],
  [
    "Lanches e naturais",
    /^(NUTS BAR|BARRA (DE CEREA|AMENDOIM|PROTE)|TRIO BARRA|BISC.*INTEGRAL|UVA PASSA|DAMASCO|TAMARA|BANANA PASSA|AMEIXA|FRUTAS CRISTALIZADAS|CRANBERRY|FIGO TURCO|LARANJA DESIDRATADA|LIMAO DESIDRATADO)/,
  ],
  [
    "Suplementos",
    /\b(WHEY|CREATINA|COLAGENO|PROTEINA|CAPSULA|CAPSULAS|CPS|CAPS)\b/,
  ],
];
const size =
  /(?<![0-9.,])(\d+(?:[.,]\d+)?)\s*(KG|MG|GR|G|ML|LITROS?|L|CPS|CAPSULAS?|CAPS|SACHES?|UND|UN)\b/;
const units = {
  GR: "g",
  LITRO: "L",
  LITROS: "L",
  CPS: "cápsulas",
  CAPS: "cápsulas",
  CAPSULA: "cápsulas",
  CAPSULAS: "cápsulas",
  UN: "un",
  UND: "un",
  SACHE: "sachê",
  SACHES: "sachês",
  ML: "ml",
  L: "L",
};

// Quoted report headers span multiple lines. Never split a report by newlines.
function* csvRows(input) {
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (ch !== ",") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        if (row.length !== 1 || row[0] !== "") yield row;
        row = [];
      }
    } else if (!field && !closed && ch === '"') quoted = true;
    else if (closed || ch === '"') throw Error("Aspas inválidas no CSV.");
    else field += ch;
  }
  if (quoted) throw Error("Campo entre aspas incompleto.");
  if (row.length || field || closed) yield [...row, field];
}

function number(value) {
  const str = value.trim();
  if (!/^[-+]?[\d.,]+$/.test(str)) return NaN;
  return Number(
    str.includes(",") ? str.replaceAll(".", "").replace(",", ".") : str,
  );
}

export function parseCatalogCsv(input) {
  const products = [],
    seen = new Set();
  for (const row of csvRows(input.replace(/^\uFEFF/, ""))) {
    if (
      row.length !== 20 ||
      row[5].trim() !== "Descrição" ||
      row[9].trim() !== "Venda"
    )
      throw Error("Utilize o relatório de preços da Mundo Natural.");
    const id = row[10].replaceAll(".", "");
    if (!/^\d{1,20}$/.test(id) || seen.has(id))
      throw Error("Código inválido ou duplicado.");
    seen.add(id);
    const name = row[12].trim().replace(/\s+/g, " ") || "Produto " + id;
    if (name.length > 256) throw Error("Nome de produto muito longo.");
    if (excludedProduct(name) || name === "0") continue;
    const plain = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    const category =
      categories.find(([, pattern]) => pattern.test(plain))?.[0] || "Outros";
    const match = plain.match(size);
    const weight = match
      ? match[1].replace(".", ",") +
        " " +
        (units[match[2]] || match[2].toLowerCase())
      : "";
    const reportedStock = number(row[14]),
      cents = Math.round(number(row[16]) * 100);
    const bulk =
      category !== "Outros" &&
      !match &&
      /^(?:2\d{4}00)$/.test(row[11]) &&
      (row[14].includes(",") ||
        /\bGRANEL\b/.test(plain) ||
        knownBulkCodes.has(row[11]));
    const stock = bulk
      ? Number.isFinite(reportedStock)
        ? Math.max(0, Math.round(reportedStock * 1000))
        : 0
      : Number.isSafeInteger(reportedStock) && reportedStock > 0
        ? reportedStock
        : 0;
    const price = Number.isSafeInteger(cents) && cents > 0 ? cents : 0;
    const packaged =
      weight &&
      !/\b(GRANEL|FRACIONADO|POR KG|ALCOOL|VINHO|CERVEJA|TABACO|CIGARRO)\b/.test(
        plain,
      );
    // The report says “glauco”; the ingredient could not be verified against this EAN.
    const needsLabelReview = row[11] === "7897404300057";
    const active = Boolean(
      !needsLabelReview &&
        category !== "Outros" &&
        stock &&
        price &&
        (packaged || bulk),
    );
    products.push([
      id,
      displayProductName(name, row[11]),
      category,
      bulk ? "a granel (kg)" : weight,
      price,
      stock,
      active,
    ]);
  }
  if (!products.length) throw Error("Relatório vazio.");
  return products;
}
