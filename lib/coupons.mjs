import {
  BULK_STEP_GRAMS,
  portionPriceCents,
  referencePriceCents,
} from "./pricing.mjs";

export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;
export const MAX_COUPON_PERCENT = 80;

export function normalizeCouponCode(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toUpperCase()
    : "";
}

// The discount is applied to each 100 g block (or each unit) and the result is
// rounded down to tens of cents, in the customer's favor. Prices raised by
// ceil(price / 0.9) and rounded up to tens of cents therefore return to a
// previous price that ended in tens of cents with a 10% coupon.
// Items that already have a larger promotion keep their lower price: the
// coupon never stacks on top of an offer or a combo discount.
export function couponPortionCents({
  unitCents,
  regularBlockCents,
  blocks,
  percent,
}) {
  if (
    !Number.isSafeInteger(unitCents) ||
    unitCents < 1 ||
    !Number.isSafeInteger(regularBlockCents) ||
    regularBlockCents < 1 ||
    !Number.isInteger(blocks) ||
    blocks < 1 ||
    !Number.isInteger(percent) ||
    percent < 1 ||
    percent > MAX_COUPON_PERCENT
  )
    throw new RangeError("Cupom inválido para esta seleção.");
  const scaled = regularBlockCents * (100 - percent),
    tens = Math.floor(scaled / 1000) * 10;
  const block = tens >= 10 ? tens : Math.max(1, Math.floor(scaled / 100));
  return Math.min(unitCents, block * blocks);
}

// Lines priced by the server (product rows and combo ingredient rows) and the
// browser cart use the same inputs, so both compute the same total.
export function productCouponInput(product, weight) {
  const blocks = product.isGranel ? weight / BULK_STEP_GRAMS : 1;
  return {
    blocks,
    regularBlockCents: Number.isSafeInteger(product.originalPriceCents)
      ? product.originalPriceCents
      : referencePriceCents(product),
  };
}

export function comboComponentCouponInput(component) {
  const blocks = component.weight / BULK_STEP_GRAMS;
  return {
    blocks,
    regularBlockCents: Number.isInteger(blocks)
      ? component.regularCents / blocks
      : NaN,
  };
}

export function cartCouponDiscountCents(items, percent) {
  let discount = 0;
  for (const item of items) {
    const product = item.product,
      quantity = item.quantity;
    if (Array.isArray(product.combo)) {
      for (const component of product.combo)
        discount +=
          (component.unitCents -
            couponPortionCents({
              unitCents: component.unitCents,
              ...comboComponentCouponInput(component),
              percent,
            })) *
          quantity;
      continue;
    }
    const weight = product.isGranel ? item.selectedWeight : 0,
      unitCents = portionPriceCents(product, weight);
    discount +=
      (unitCents -
        couponPortionCents({
          unitCents,
          ...productCouponInput(product, weight),
          percent,
        })) *
      quantity;
  }
  return discount;
}

export function couponIsCurrent(coupon, now = Date.now()) {
  return (
    !!coupon &&
    coupon.active === true &&
    (!coupon.startsAt || coupon.startsAt <= now) &&
    (!coupon.endsAt || coupon.endsAt > now)
  );
}
