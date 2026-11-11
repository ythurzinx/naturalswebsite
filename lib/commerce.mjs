import {
  BULK_STEP_GRAMS,
  isBulkWeight,
  portionPriceCents,
} from "./pricing.mjs";

export const CART_KEY = "mundo-natural.cart.v2";
export const MAX_QUANTITY = 99;
export function normalizeQuantity(value) {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(MAX_QUANTITY, Math.floor(value)))
    : 1;
}
export function normalizeWeight(value) {
  return isBulkWeight(value) ? value : BULK_STEP_GRAMS;
}
export function itemKey(item) {
  return `${item.product.id}:${item.product.isGranel ? normalizeWeight(item.selectedWeight) : 0}`;
}
export function lineTotal(item) {
  const unitCents = portionPriceCents(
    item.product,
    normalizeWeight(item.selectedWeight),
  );
  return (unitCents * normalizeQuantity(item.quantity)) / 100;
}
export function cartTotal(items) {
  return (
    Math.round(items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) /
    100
  );
}
export function restoreCart(raw, catalog, now = Date.now()) {
  const restored = { items: [], needsWeightReview: false };
  try {
    if (typeof raw !== "string" || raw.length > 30000) return restored;
    const data = JSON.parse(raw);
    if (
      data.version !== 2 ||
      !Number.isFinite(data.savedAt) ||
      data.savedAt > now ||
      now - data.savedAt > 30 * 86400000 ||
      !Array.isArray(data.items)
    )
      return restored;
    const output = new Map();
    for (const item of data.items.slice(0, 100)) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_QUANTITY
      )
        continue;
      const product = catalog.find((p) => p.id === item.id);
      if (
        !product ||
        !Number.isFinite(product.valor_unitario) ||
        product.valor_unitario <= 0
      )
        continue;
      if (product.isGranel && !isBulkWeight(item.weight)) {
        restored.needsWeightReview = true;
        continue;
      }
      const entry = {
        product,
        quantity: item.quantity,
        selectedWeight: product.isGranel
          ? normalizeWeight(item.weight)
          : undefined,
      };
      const key = itemKey(entry),
        previous = output.get(key);
      output.set(
        key,
        previous
          ? {
              ...entry,
              quantity: normalizeQuantity(previous.quantity + entry.quantity),
            }
          : entry,
      );
    }
    restored.items = [...output.values()];
    return restored;
  } catch {
    return restored;
  }
}
export function hydrateCart(raw, catalog, now = Date.now()) {
  return restoreCart(raw, catalog, now).items;
}
export function serializeCart(items, now = Date.now()) {
  return JSON.stringify({
    version: 2,
    savedAt: now,
    items: items.map((item) => ({
      id: item.product.id,
      quantity: normalizeQuantity(item.quantity),
      weight: item.product.isGranel
        ? normalizeWeight(item.selectedWeight)
        : undefined,
    })),
  });
}
