import {
  isBulkWeight,
  referencePriceCents,
  portionPriceCents,
} from "./pricing.mjs";

// Integer-cent allocation keeps the bundle's displayed price equal to the sum
// charged for its real ingredients. A bundle never stacks product promotions.
export function allocateCombo(components, discountPercent = 0) {
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 80
  )
    throw new RangeError("Desconto inválido.");
  const originalCents = components.reduce((sum, c) => sum + c.regularCents, 0);
  if (
    !Number.isSafeInteger(originalCents) ||
    originalCents < 1 ||
    components.some(
      (c) => !Number.isSafeInteger(c.regularCents) || c.regularCents < 1,
    )
  )
    throw new RangeError("Revise os preços dos ingredientes.");
  const totalCents = Math.round(
    (originalCents * (100 - discountPercent)) / 100,
  );
  const rows = components.map((c, index) => ({
    ...c,
    index,
    unitCents: Math.floor((c.regularCents * totalCents) / originalCents),
    remainder: (c.regularCents * totalCents) % originalCents,
  }));
  let remaining = totalCents - rows.reduce((sum, r) => sum + r.unitCents, 0);
  for (const row of [...rows].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )) {
    if (remaining-- <= 0) break;
    row.unitCents++;
  }
  if (rows.some((r) => r.unitCents < 1))
    throw new RangeError("O desconto deixa uma porção abaixo de R$ 0,01.");
  return {
    originalCents,
    totalCents,
    components: rows.map(({ index, remainder, ...row }) => row),
  };
}

export function applyMerchandising(catalog, settings, now = Date.now()) {
  const lookup = new Map(catalog.map((p) => [p.id, p]));
  const offers = new Map(
    (settings.offers || [])
      .filter(
        (o) =>
          o.active &&
          (!o.startsAt || o.startsAt <= now) &&
          (!o.endsAt || o.endsAt > now),
      )
      .map((o) => [o.productId, o]),
  );
  const products = catalog.map((product) => {
    const offer = offers.get(product.id);
    if (
      !offer ||
      !Number.isInteger(offer.discountPercent) ||
      offer.discountPercent < 1 ||
      offer.discountPercent > 80
    )
      return product;
    const original = referencePriceCents(product);
    const sale = Math.round((original * (100 - offer.discountPercent)) / 100);
    if (sale < 1 || sale >= original) return product;
    return {
      ...product,
      originalPriceCents: original,
      valor_unitario: (sale * (product.isGranel ? 10 : 1)) / 100,
      promotionEndsAt: offer.endsAt || null,
    };
  });
  for (const combo of settings.combos || []) {
    if (!combo.active) continue;
    try {
      if (combo.components.length < 2 || combo.components.length > 8) continue;
      const components = combo.components.map((c) => {
        const product = lookup.get(c.productId);
        if (!product?.isGranel || !isBulkWeight(c.weight))
          throw new RangeError("Ingrediente indisponível.");
        return {
          productId: product.id,
          name: product.nome_produto,
          weight: c.weight,
          imagem: product.imagem,
          regularCents: portionPriceCents(product, c.weight),
        };
      });
      const allocation = allocateCombo(components, combo.discountPercent);
      products.push({
        id: combo.id,
        nome_produto: combo.name,
        description: combo.description,
        categoria: "Combos",
        isGranel: false,
        peso_produto: `${components.length} itens · ${components.reduce((s, c) => s + c.weight, 0)} g`,
        valor_unitario: allocation.totalCents / 100,
        originalPriceCents:
          allocation.originalCents > allocation.totalCents
            ? allocation.originalCents
            : undefined,
        quantidade: 0,
        total_unitario: 0,
        estoque_minimo: 0,
        status_estoque: "Sob consulta",
        combo: allocation.components,
      });
    } catch {
      /* An unavailable ingredient makes the entire bundle unavailable. */
    }
  }
  return products;
}
