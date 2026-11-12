import { reject } from "./errors.mjs";
import {
  isBulkWeight,
  portionPriceCents,
  referencePriceCents,
} from "../pricing.mjs";
import { allocateCombo } from "../merchandising.mjs";
const productId = /^(prod-\d+|custom-[a-f0-9-]{36})$/;
const object = (v, keys) =>
  v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).every((k) => keys.includes(k));
const text = (v, min, max) =>
  typeof v === "string" &&
  v.trim().length >= min &&
  v.trim().length <= max &&
  !/[\x00-\x1f\x7f<>]/.test(v);
const discount = (v) => Number.isInteger(v) && v >= 0 && v <= 80;
const date = (v) =>
  v === null || (Number.isSafeInteger(v) && v >= 0 && v <= 4102444800000);

export function validateMerchandising(body, catalog) {
  const fail = () =>
    reject(
      "INVALID_MERCHANDISING",
      "Revise os descontos, os ingredientes e os períodos das ofertas.",
    );
  if (
    !object(body, ["revision", "offers", "combos"]) ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    !Array.isArray(body.offers) ||
    body.offers.length > 24 ||
    !Array.isArray(body.combos) ||
    body.combos.length > 12
  )
    fail();
  const lookup = new Map(catalog.map((p) => [p.id, p]));
  const offerIds = new Set(),
    comboIds = new Set();
  const offers = body.offers.map((o) => {
    if (
      !object(o, [
        "productId",
        "active",
        "discountPercent",
        "startsAt",
        "endsAt",
      ]) ||
      !productId.test(o.productId) ||
      !lookup.has(o.productId) ||
      offerIds.has(o.productId) ||
      typeof o.active !== "boolean" ||
      !discount(o.discountPercent) ||
      (o.active && o.discountPercent < 1) ||
      !date(o.startsAt) ||
      !date(o.endsAt) ||
      (o.startsAt !== null && o.endsAt !== null && o.endsAt <= o.startsAt)
    )
      fail();
    const price = referencePriceCents(lookup.get(o.productId));
    const sale = Math.round((price * (100 - o.discountPercent)) / 100);
    if (o.active && (sale < 1 || sale >= price))
      reject(
        "INVALID_DISCOUNT",
        "Esse desconto não altera o preço ou deixa a porção abaixo de R$ 0,01.",
      );
    offerIds.add(o.productId);
    return { ...o };
  });
  const combos = body.combos.map((c) => {
    if (
      !object(c, [
        "id",
        "name",
        "description",
        "active",
        "discountPercent",
        "components",
      ]) ||
      !/^combo-[a-z0-9][a-z0-9-]{0,39}$/.test(c.id) ||
      comboIds.has(c.id) ||
      !text(c.name, 3, 100) ||
      !text(c.description, 0, 400) ||
      typeof c.active !== "boolean" ||
      !discount(c.discountPercent) ||
      !Array.isArray(c.components) ||
      c.components.length < 2 ||
      c.components.length > 8
    )
      fail();
    const ingredientIds = new Set();
    let weight = 0;
    const components = c.components.map((i) => {
      const p = lookup.get(i?.productId);
      if (
        !object(i, ["productId", "weight"]) ||
        !productId.test(i.productId) ||
        !p?.isGranel ||
        !isBulkWeight(i.weight) ||
        ingredientIds.has(i.productId)
      )
        fail();
      ingredientIds.add(i.productId);
      weight += i.weight;
      return { productId: i.productId, weight: i.weight };
    });
    if (weight > 20000) fail();
    try {
      allocateCombo(
        components.map((i) => ({
          regularCents: portionPriceCents(lookup.get(i.productId), i.weight),
        })),
        c.discountPercent,
      );
    } catch {
      fail();
    }
    comboIds.add(c.id);
    return {
      ...c,
      name: c.name.trim(),
      description: c.description.trim(),
      components,
    };
  });
  return { revision: body.revision, offers, combos };
}
