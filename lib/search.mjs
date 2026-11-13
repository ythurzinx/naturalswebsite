export function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const aliases = [
  [/psyllium|psilium/, "psilium psillium psyllium fibra plantago"],
  [/quinu|quinoa/, "quinoa quinua"],
  [/acafrao|curcuma/, "acafrao curcuma turmeric"],
  [/hibisc|hibusc/, "hibisco hibiscus hibiscu"],
  [/ora.*nobis|orapronobis/, "ora pro nobis orapronobis"],
  [/castanha do para/, "castanha do brasil castanha para"],
  [/chimi.*churri/, "chimichurri chimi churri"],
  [/girasol|girassol/, "girassol girasol"],
  [/gergelim/, "sesamo gergelim"],
  [/levedo/, "levedura levedo cerveja"],
];
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let edits = 0,
    i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
export function findProducts(items, query, limit = 5000) {
  const q = normalizeSearch(query).slice(0, 120),
    terms = q.split(/\s+/).filter(Boolean);
  if (!q) return items.slice(0, limit);
  const prepared = items.map((product, index) => {
    const name = normalizeSearch(product.nome_produto),
      extra = aliases
        .filter(([pattern]) => pattern.test(name))
        .map(([, s]) => s)
        .join(" ");
    return {
      product,
      index,
      name,
      text: `${name} ${extra} ${normalizeSearch(product.categoria)}`,
    };
  });
  let matches = prepared
    .filter((p) => terms.every((t) => p.text.includes(t)))
    .map((p) => ({
      ...p,
      score:
        (p.name.startsWith(q) ? 30 : 0) +
        terms.reduce(
          (sum, t) =>
            sum +
            (p.name.split(" ").some((w) => w.startsWith(t))
              ? 10
              : p.name.includes(t)
                ? 5
                : 0),
          0,
        ),
    }));
  if (!matches.length && terms.every((t) => t.length >= 4 && t.length <= 24))
    matches = prepared
      .filter((p) =>
        terms.every((t) =>
          p.text
            .split(" ")
            .some(
              (w) =>
                w.startsWith(t) || near(t, w.slice(0, t.length)) || near(t, w),
            ),
        ),
      )
      .map((p) => ({ ...p, score: 1 }));
  return matches
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((p) => p.product);
}
