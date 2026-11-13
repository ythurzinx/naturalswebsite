import defaults from "../product-content.json" with { type: "json" };
import { reject } from "./errors.mjs";

const fields = [
  "kind",
  "description",
  "highlights",
  "usage",
  "storage",
  "allergens",
  "notes",
  "recipe",
  "sources",
];
const clean = (v, max, min = 0) =>
  typeof v === "string" &&
  v.trim().length >= min &&
  v.length <= max &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(v);
const lines = (v, max, length) =>
  Array.isArray(v) && v.length <= max && v.every((s) => clean(s, length, 1));
const keys = (obj, allowed) =>
  obj &&
  typeof obj === "object" &&
  !Array.isArray(obj) &&
  Object.keys(obj).every((key) => allowed.includes(key));
export function validateProductContent(body) {
  const c = body?.content,
    r = c?.recipe;
  if (
    !keys(body, ["revision", "content"]) ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    !keys(c, fields) ||
    fields.some((key) => !(key in c)) ||
    !["food", "herbal", "supplement", "external"].includes(c.kind) ||
    !clean(c.description, 1200, 20) ||
    !lines(c.highlights, 6, 220) ||
    !c.highlights.length ||
    !clean(c.usage, 1000, 5) ||
    !clean(c.storage, 600, 5) ||
    !clean(c.allergens, 600, 5) ||
    !lines(c.notes, 6, 300) ||
    (r !== null &&
      (!keys(r, ["title", "minutes", "servings", "ingredients", "steps"]) ||
        !clean(r.title, 120, 4) ||
        !Number.isInteger(r.minutes) ||
        r.minutes < 1 ||
        r.minutes > 1440 ||
        !clean(r.servings, 80, 1) ||
        !lines(r.ingredients, 16, 240) ||
        !r.ingredients.length ||
        !lines(r.steps, 12, 500) ||
        !r.steps.length)) ||
    !Array.isArray(c.sources) ||
    c.sources.length > 6 ||
    c.sources.some((s) => {
      if (
        !keys(s, ["title", "url"]) ||
        !clean(s.title, 120, 2) ||
        !clean(s.url, 1000, 10)
      )
        return true;
      try {
        const u = new URL(s.url);
        return (
          u.protocol !== "https:" ||
          !!u.username ||
          !!u.password ||
          !!u.port ||
          !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname) ||
          /(?:^|\.)(localhost|local|internal)$/i.test(u.hostname) ||
          /^\d+(?:\.\d+){3}$/.test(u.hostname)
        );
      } catch {
        return true;
      }
    })
  )
    reject(
      "INVALID_CONTENT",
      "Revise a descrição, os destaques, a receita e os links de referência.",
    );
  if (c.kind !== "food" && c.recipe !== null)
    reject(
      "INVALID_CONTENT",
      "Receitas são reservadas aos ingredientes de uso alimentar. Para os demais, edite as orientações de uso.",
    );
  const value = structuredClone(c);
  for (const key of ["description", "usage", "storage", "allergens"])
    value[key] = value[key].trim();
  return { revision: body.revision, content: value };
}
export function defaultProductContent(product) {
  if (defaults[product.id]) return structuredClone(defaults[product.id]);
  const combo = product.combo;
  const isNutCombo = combo?.every((p) =>
    /castanha|nozes|amendoa|amendoim|pistache/i.test(p.name),
  );
  const isSpiceCombo = product.id === "combo-temperos";
  const isFlourCombo = product.id === "combo-mix-natural";
  const comboRecipe = isNutCombo
    ? {
        title: "Tigela de iogurte com a seleção de castanhas",
        minutes: 5,
        servings: "2 porções",
        ingredients: [
          "2 potes de iogurte natural",
          "1 banana picada",
          ...combo.map(
            (p) =>
              `1 colher de sopa de ${p.name}, picado e pronto para consumo`,
          ),
        ],
        steps: [
          "Distribua o iogurte e a banana em duas tigelas.",
          "Finalize com as castanhas picadas, conferindo alergênicos e a preparação indicada no lote.",
        ],
      }
    : isSpiceCombo
      ? {
          title: "Legumes assados com a seleção de temperos",
          minutes: 45,
          servings: "2 porções",
          ingredients: [
            "400 g de legumes em cubos",
            "1 colher de sopa de azeite",
            ...combo.map((p) => `1 pequena pitada de ${p.name}`),
          ],
          steps: [
            "Misture os legumes com azeite e as pequenas pitadas dos temperos.",
            "Asse a 200 °C por cerca de 30 a 40 minutos, até amaciar. Ajuste sal só se necessário.",
          ],
        }
      : isFlourCombo
        ? {
            title: "Panqueca de banana com as farinhas do combo",
            minutes: 15,
            servings: "2 porções",
            ingredients: [
              "1 banana amassada",
              "1 ovo",
              "2 colheres de sopa de farinha de aveia",
              "3 colheres de sopa de água",
              ...combo.map(
                (p) =>
                  `1 colher de chá de ${p.name}, se rotulado para uso alimentar e respeitando o rótulo`,
              ),
            ],
            steps: [
              "Confirme que os três ingredientes são próprios para uso alimentar.",
              "Misture tudo e ajuste a água para uma massa espessa que escorra da colher.",
              "Cozinhe discos pequenos em frigideira untada em fogo baixo, dos dois lados até o centro ficar cozido.",
            ],
          }
        : null;
  if (combo?.length)
    return {
      kind: "food",
      description:
        product.description ||
        `${product.nome_produto} reúne ingredientes em porções separadas para combinar na sua rotina. Confira abaixo os produtos e os pesos de cada porção.`,
      highlights: [
        "Ingredientes embalados individualmente",
        "Porções indicadas na composição do combo",
        "Você escolhe como combinar os ingredientes",
      ],
      usage:
        "Use cada ingrediente conforme suas orientações individuais. Consulte as fichas dos produtos que compõem o combo.",
      storage:
        "Mantenha cada embalagem bem fechada, em local seco, fresco e protegido da luz. Confira a validade de cada ingrediente.",
      allergens:
        "O combo reúne os alergênicos dos seus ingredientes. Consulte cada ficha e confirme os rótulos com a loja.",
      notes: [
        "As receitas são sugestões culinárias; não representam alegações terapêuticas.",
      ],
      recipe: comboRecipe,
      sources: [
        {
          title: "Ministério da Saúde — Guia Alimentar",
          url: "https://www.gov.br/saude/pt-br/assuntos/saude-brasil/publicacoes-para-promocao-a-saude/guia_alimentar_populacao_brasileira_2ed.pdf/view",
        },
      ],
    };
  return {
    kind: "food",
    description: `${product.nome_produto} faz parte da seleção da Mundo Natural. Confira a apresentação, a composição e o modo de uso com nossa equipe antes da compra.`,
    highlights: [
      "Escolha a quantidade indicada no produto",
      "Atendimento para esclarecer ingredientes e preparo",
    ],
    usage: "Siga o modo de uso informado no rótulo ou pela loja.",
    storage: "Conserve conforme o rótulo, longe de calor e umidade.",
    allergens:
      "Composição e possíveis alergênicos devem ser confirmados no rótulo e com a loja.",
    notes: [],
    recipe: null,
    sources: [],
  };
}
export function createProductContentService({ repository }) {
  async function get(product) {
    if (!repository)
      return { content: defaultProductContent(product), revision: 0 };
    const [rows] = await repository.pool.execute(
      "SELECT value_json,version FROM mn_settings WHERE setting_key=?",
      [`product-content:${product.id}`],
    );
    return rows.length
      ? {
          content: JSON.parse(rows[0].value_json),
          revision: Number(rows[0].version),
        }
      : { content: defaultProductContent(product), revision: 0 };
  }
  async function save(id, body) {
    const value = validateProductContent(body);
    if (!repository)
      reject("DATABASE_REQUIRED", "Configure o banco da loja.", 503);
    if (
      ![
        ...(await repository.catalog(true)),
        ...(await repository.catalog(false)).filter((p) => p.combo),
      ].some((p) => p.id === id)
    )
      reject("NOT_FOUND", "Produto não encontrado.", 404);
    const connection = await repository.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES(?,'{}',0,?) ON DUPLICATE KEY UPDATE version=version",
        [`product-content:${id}`, Date.now()],
      );
      const [rows] = await connection.execute(
        "SELECT version FROM mn_settings WHERE setting_key=? FOR UPDATE",
        [`product-content:${id}`],
      );
      if (Number(rows[0].version) !== value.revision)
        reject(
          "CONTENT_CHANGED",
          "Este conteúdo mudou. Recarregue antes de salvar.",
          409,
        );
      await connection.execute(
        "UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key=?",
        [JSON.stringify(value.content), Date.now(), `product-content:${id}`],
      );
      await repository.audit(
        "product.content",
        id,
        { kind: value.content.kind, hasRecipe: !!value.content.recipe },
        connection,
      );
      await connection.commit();
      return { content: value.content, revision: value.revision + 1 };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return { get, save };
}
