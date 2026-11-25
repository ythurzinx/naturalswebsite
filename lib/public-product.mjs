const fields = [
  "id", "nome_produto", "peso_produto", "valor_unitario", "categoria", "isGranel",
  "imagem", "imagemLegenda", "originalPriceCents", "promotionEndsAt", "description",
  "isFeatured",
];
const componentFields = [
  "productId", "name", "weight", "regularCents", "unitCents", "imagem",
];
const pick = (value, keys) => Object.fromEntries(
  keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]),
);
/** Customer-facing data is an allowlist, never a spread of an admin record.
 * @returns {import("./types").Product}
 */
export function publicProduct(product) {
  const value = pick(product, fields);
  if (Array.isArray(product.combo))
    value.combo = product.combo.map((component) => pick(component, componentFields));
  return /** @type {import("./types").Product} */ (value);
}
