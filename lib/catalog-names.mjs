const fold = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

export function excludedProduct(name) {
  const text = fold(name.trim());
  return (
    /\b(BALAS?|VELAS?|DESCARTAVE(?:L|IS)|DESCART\b|COPAZA|PLASTFOOD)\b/.test(
      text,
    ) ||
    /^(?:DESC\b|COPOS?\b(?!.*(?:REQUEIJAO|IOGURTE))|PRATOS?\b|FORMINHAS?\b|GUARDANAPOS?\b|GARFOS?\b|BAL(?:AO|OES)\b|COLHER(?:ES)?\b|PALITOS? (?:DE )?(BAMBU|DENTE|MADEIRA)|CANUDOS?\b(?!.*(?:BISC|BIJU|WAFER|CHOCOLATE))|TOALHA(?:S)? DE PAPEL|SACO(?:S)? (?:PLASTICO|DE LIXO)|MARMITEX|LUVA.*DESC\b)/.test(
      text,
    )
  );
}

// These product families were matched to their EANs in the supplier report.
const commercialNames = {
  7898215153214: "Bebida proteica Piracanjuba Whey sabor banana",
  7898215153207: "Bebida proteica Piracanjuba Whey sabor frutas vermelhas",
  7898215153221: "Bebida proteica Piracanjuba Whey sabor cacau",
  7891095200870: "Farinha de milho em flocos pré-cozida Yoki Kimilho",
  7891000011294: "Cereal infantil Mucilon de milho Nestlé",
  7896023719035: "Cloreto de magnésio P.A. Catarinense",
  7896073711331: "Granola Croqui de banana e mel",
  7899489200222: "Granola Junco de banana e canela",
  7899489200277: "Granola tradicional Junco",
  7899468501623: "Mel silvestre Alpisnutri",
  7897404300040: "Mel silvestre com extrato de própolis e eucalipto",
  7897404300125: "Mel silvestre com extrato de própolis e romã",
};
const knownDescriptions = {
  "BARRA AMENDOIM 85G": "Barra de amendoim",
  "BISC NESFIT INTEGRAL NESTLE 21G MULTICEREAIS":
    "Biscoito integral Nesfit Multicereais Nestlé",
  "FEIJAO CAMIL1 KG": "Feijão Camil",
  "MEL COM PEDACOS DE FAVO 275ML": "Mel com pedaços de favo",
};
const words = Object.fromEntries(
  "abóbora açafrão açúcar demerara orgânico monossódico alho-poró amaranto amêndoa amêndoas amendoim grãos grão macadâmia grão-de-bico chá chás café páprica síria cúrcuma orégano manjericão crua pré-cozida pré-cozido açúcar sódio defumada tempero guaraná maçã avelã maracujá café limão feijão feijões proteína proteínas miúda miúdo fubá gérmen fécula pêssego caju castanhas açaí linhaça vinagrete açúcar moído moída caroço colágeno Paraíba glúten gaúcho Índia romã própolis magnésio cólica cápsulas sêmola manteiga amêndoas pedaços gergelim flocão pistache quinoa torrão pó kibe açúcares goji natural algodão mamão"
    .split(" ")
    .map((v) => [fold(v), v]),
);
export function displayProductName(raw, barcode) {
  const text = fold(raw.trim().replace(/\s+/g, " "));
  if (Object.hasOwn(commercialNames, barcode)) return commercialNames[barcode];
  if (Object.hasOwn(knownDescriptions, text)) return knownDescriptions[text];
  let clean = raw
    .trim()
    .replace(
      /\b([CSP])\/\s*/gi,
      (_, flag) => ({ C: "com ", S: "sem ", P: "para " })[flag.toUpperCase()],
    )
    .replace(/\bCOND ENSADO\b/gi, "condensado")
    .replace(/\bM ASCAVO\b/gi, "mascavo")
    .replace(/\bDOURA DO\b/gi, "dourado")
    .replace(/\bMONOSSODIC O\b/gi, "monossódico")
    .replace(/\bMAN DIOCA\b/gi, "mandioca")
    .replace(/\bCARAmel O\b/gi, "caramelo")
    .replace(/\bQUINUA\b/gi, "quinoa")
    .replace(/\bCHIMI CHURRI\b/gi, "chimichurri")
    .replace(/\bDESID\b/gi, "desidratado")
    .replace(/\bFAT\b/gi, "fatiado")
    .replace(/\bINTEGR\b/gi, "integral");
  clean = clean
    .toLocaleLowerCase("pt-BR")
    .replace(/[\p{L}]+/gu, (word) => words[fold(word)] || word);
  clean = clean
    .replace(/\balho poro\b/g, "alho-poró")
    .replace(/\bgrão de bico\b/g, "grão-de-bico")
    .replace(/\bnoz moscada\b/g, "noz-moscada")
    .replace(/\bbatata doce\b/g, "batata-doce")
    .replace(/\buva passa\b/g, "uva-passa")
    .replace(/\bslw1\b/gi, "SLW1")
    .replace(/\bw1\b/gi, "W1")
    .replace(/\bhps\b/gi, "HPS")
    .replace(/\bchile\b/gi, "Chile")
    .replace(/\bparaíba\b/gi, "Paraíba")
    .replace(/\bíndia\b/gi, "Índia")
    .replace(/\bhimalaia\b/gi, "Himalaia")
    .replace(/\bedu guedes\b/gi, "Edu Guedes")
    .replace(/\bana maria\b/gi, "Ana Maria")
    .replace(/\bkibe\b/g, "quibe");
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}
