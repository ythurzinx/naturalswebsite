export function defaultProductVisible(product, policy) {
  return (
    !policy.disabledProductIds.includes(product.id) &&
    (!policy.bulkCatalogOnly || product.isGranel) &&
    !(policy.hiddenBaseProductIds || []).includes(product.id)
  );
}

export function editedProductVisible(row, policy) {
  if (!row.active || policy.disabledProductIds.includes(row.id)) return false;
  // Imported packaged goods stay in the admin. A deliberate edit after this
  // catalog reset can publish them again, without deleting products or orders.
  return (
    defaultProductVisible({ id: row.id, isGranel: !!row.is_bulk }, policy) ||
    Number(row.updated_at) >= (policy.legacyActivationAfter || 0)
  );
}
