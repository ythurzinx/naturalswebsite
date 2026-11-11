export const BULK_STEP_GRAMS = 100;
export const MAX_BULK_WEIGHT_GRAMS = 5000;
export const BULK_WEIGHTS = Object.freeze(
  Array.from(
    { length: MAX_BULK_WEIGHT_GRAMS / BULK_STEP_GRAMS },
    (_, index) => (index + 1) * BULK_STEP_GRAMS,
  ),
);

export function isBulkWeight(weight) {
  return (
    Number.isInteger(weight) &&
    weight >= BULK_STEP_GRAMS &&
    weight <= MAX_BULK_WEIGHT_GRAMS &&
    weight % BULK_STEP_GRAMS === 0
  );
}

// The imported catalog and existing database keep their original per-kg basis.
// The sale price is rounded once per 100 g, then multiplied by the chosen blocks.
export function referencePriceCents(product) {
  const originalCents = Math.round(product.valor_unitario * 100);
  return product.isGranel ? Math.round(originalCents / 10) : originalCents;
}

export function portionPriceCents(product, weight = BULK_STEP_GRAMS) {
  if (product.isGranel && !isBulkWeight(weight))
    throw new RangeError("Escolha um peso de 100 em 100 g, até 5.000 g.");
  return (
    referencePriceCents(product) *
    (product.isGranel ? weight / BULK_STEP_GRAMS : 1)
  );
}
