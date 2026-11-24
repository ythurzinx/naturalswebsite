import { reject } from "./errors.mjs";
import { schema } from "./schema.mjs";
import {
  COUPON_CODE_PATTERN,
  MAX_COUPON_PERCENT,
  couponIsCurrent,
  normalizeCouponCode,
} from "../coupons.mjs";

const TABLE = schema.find((statement) =>
  statement.includes("mn_coupon_redemptions"),
);
const KEY = "coupons";
const MAX_COUPONS = 100;
// A redemption counts while its payment can still be approved: Mercado Pago
// orders expire after one day, and a checkout that never reached the provider
// releases its use after a short grace period.
export const PENDING_ORDER_WINDOW_MS = 24 * 3600000;
export const UNLINKED_RESERVATION_WINDOW_MS = 30 * 60000;
const fields = [
  "code",
  "percent",
  "active",
  "startsAt",
  "endsAt",
  "minSubtotalCents",
  "maxUses",
  "onePerCustomer",
  "note",
];
function optionalTime(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isSafeInteger(value) || value < 1)
    reject("INVALID_COUPON", "Revise as datas do cupom.");
  return value;
}
export function validateCouponInput(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.includes(key))
  )
    reject("INVALID_COUPON", "Revise os dados do cupom.");
  const code = normalizeCouponCode(input.code);
  if (!COUPON_CODE_PATTERN.test(code))
    reject(
      "INVALID_COUPON",
      "Use de 3 a 24 letras sem acento, números, hífen ou sublinhado no código.",
    );
  if (
    !Number.isInteger(input.percent) ||
    input.percent < 1 ||
    input.percent > MAX_COUPON_PERCENT
  )
    reject(
      "INVALID_COUPON",
      `O desconto deve ser um número inteiro entre 1% e ${MAX_COUPON_PERCENT}%.`,
    );
  const startsAt = optionalTime(input.startsAt),
    endsAt = optionalTime(input.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt)
    reject("INVALID_COUPON", "O fim da validade deve ser depois do início.");
  const minSubtotalCents = input.minSubtotalCents ?? 0;
  if (
    !Number.isSafeInteger(minSubtotalCents) ||
    minSubtotalCents < 0 ||
    minSubtotalCents > 100000000
  )
    reject("INVALID_COUPON", "Revise o valor mínimo da compra.");
  const maxUses = input.maxUses ?? null;
  if (
    maxUses !== null &&
    (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)
  )
    reject("INVALID_COUPON", "O limite de usos deve ficar entre 1 e 100.000.");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (
    (input.note !== undefined && typeof input.note !== "string") ||
    note.length > 80 ||
    /[\x00-\x1f\x7f<>]/.test(note)
  )
    reject("INVALID_COUPON", "A anotação deve ter até 80 caracteres.");
  for (const flag of ["active", "onePerCustomer"])
    if (input[flag] !== undefined && typeof input[flag] !== "boolean")
      reject("INVALID_COUPON", "Revise as opções do cupom.");
  return {
    code,
    percent: input.percent,
    active: input.active !== false,
    startsAt,
    endsAt,
    minSubtotalCents,
    maxUses,
    onePerCustomer: input.onePerCustomer === true,
    note,
  };
}
function publicCoupon(coupon) {
  return {
    code: coupon.code,
    percent: coupon.percent,
    minSubtotalCents: coupon.minSubtotalCents,
    endsAt: coupon.endsAt,
  };
}
export class CouponStore {
  constructor(pool, now = () => Date.now()) {
    this.pool = pool;
    this.now = now;
    this.ready = false;
  }
  // The table is also part of the migration and of the phpMyAdmin SQL. Creating
  // it on first use spares the store an extra import when it already has the
  // privilege; CREATE TABLE IF NOT EXISTS never touches existing data.
  async ensure() {
    if (this.ready) return;
    await this.pool.query(TABLE);
    this.ready = true;
  }
  async available() {
    try {
      await this.ensure();
      return true;
    } catch {
      return false;
    }
  }
  async settings(connection = this.pool, lock = false) {
    const [rows] = await connection.execute(
      `SELECT value_json,version FROM mn_settings WHERE setting_key='${KEY}'${lock ? " FOR UPDATE" : ""}`,
    );
    if (!rows.length) return { coupons: [], revision: 0 };
    const value = JSON.parse(rows[0].value_json);
    return {
      coupons: Array.isArray(value.coupons) ? value.coupons : [],
      revision: Number(rows[0].version),
    };
  }
  async list() {
    const { coupons, revision } = await this.settings();
    const usage = new Map();
    const storage = await this.available();
    if (storage) {
      const [rows] = await this.pool.execute(
        "SELECT r.code, SUM(o.state='paid') paid_uses, COALESCE(SUM(IF(o.state='paid', r.discount_cents, 0)),0) paid_discount, SUM(o.state='pending' AND r.created_at>?) pending_uses FROM mn_coupon_redemptions r LEFT JOIN mn_orders o ON o.reference=r.reference GROUP BY r.code",
        [this.now() - PENDING_ORDER_WINDOW_MS],
      );
      for (const row of rows)
        usage.set(row.code, {
          paidUses: Number(row.paid_uses || 0),
          paidDiscountCents: Number(row.paid_discount || 0),
          pendingUses: Number(row.pending_uses || 0),
        });
    }
    return {
      revision,
      storage,
      coupons: coupons.map((coupon) => ({
        ...coupon,
        current: couponIsCurrent(coupon, this.now()),
        usage: usage.get(coupon.code) || {
          paidUses: 0,
          paidDiscountCents: 0,
          pendingUses: 0,
        },
      })),
    };
  }
  async mutate(event, code, change) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('${KEY}','{"coupons":[]}',0,?) ON DUPLICATE KEY UPDATE version=version`,
        [this.now()],
      );
      const { coupons } = await this.settings(connection, true);
      const next = change(coupons);
      const json = JSON.stringify({ coupons: next });
      if (next.length > MAX_COUPONS || Buffer.byteLength(json) > 60000)
        reject("INVALID_COUPON", "Remova cupons antigos antes de criar outro.");
      await connection.execute(
        `UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key='${KEY}'`,
        [json, this.now()],
      );
      await connection.execute(
        "INSERT INTO mn_audit(event,entity_id,details,created_at) VALUES(?,?,?,?)",
        [
          event,
          code,
          JSON.stringify(next.find((c) => c.code === code) || { removed: true }),
          this.now(),
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.list();
  }
  async create(input) {
    const coupon = validateCouponInput(input);
    return this.mutate("coupon.create", coupon.code, (coupons) => {
      if (coupons.some((c) => c.code === coupon.code))
        reject(
          "COUPON_EXISTS",
          "Já existe um cupom com este código. Escolha outro código.",
          409,
        );
      return [...coupons, { ...coupon, createdAt: this.now() }];
    });
  }
  async setActive(rawCode, active) {
    const code = normalizeCouponCode(rawCode);
    if (typeof active !== "boolean")
      reject("INVALID_COUPON", "Revise a situação do cupom.");
    return this.mutate("coupon.update", code, (coupons) => {
      if (!coupons.some((c) => c.code === code))
        reject("COUPON_NOT_FOUND", "Cupom não encontrado.", 404);
      return coupons.map((c) => (c.code === code ? { ...c, active } : c));
    });
  }
  async remove(rawCode) {
    const code = normalizeCouponCode(rawCode);
    return this.mutate("coupon.delete", code, (coupons) => {
      if (!coupons.some((c) => c.code === code))
        reject("COUPON_NOT_FOUND", "Cupom não encontrado.", 404);
      return coupons.filter((c) => c.code !== code);
    });
  }
  async resolve(rawCode) {
    const code = normalizeCouponCode(rawCode);
    if (!COUPON_CODE_PATTERN.test(code))
      reject("COUPON_INVALID", "Cupom inválido ou fora da validade.", 404);
    const { coupons } = await this.settings();
    const coupon = coupons.find((c) => c.code === code);
    if (!couponIsCurrent(coupon, this.now()))
      reject("COUPON_INVALID", "Cupom inválido ou fora da validade.", 404);
    return { ...publicCoupon(coupon), maxUses: coupon.maxUses, onePerCustomer: coupon.onePerCustomer };
  }
  async countUses(connection, code, email = null) {
    const now = this.now();
    const [rows] = await connection.execute(
      `SELECT COUNT(*) uses FROM mn_coupon_redemptions r LEFT JOIN mn_orders o ON o.reference=r.reference WHERE r.code=?${email ? " AND r.email=?" : ""} AND (o.state='paid' OR (o.state='pending' AND r.created_at>?) OR (o.id IS NULL AND r.created_at>?))`,
      [
        code,
        ...(email ? [email] : []),
        now - PENDING_ORDER_WINDOW_MS,
        now - UNLINKED_RESERVATION_WINDOW_MS,
      ],
    );
    return Number(rows[0].uses);
  }
  // Reserves one use before the payment is created. The coupon settings row is
  // locked so concurrent checkouts cannot exceed the limits.
  async reserve(reference, selection) {
    const coupon = selection.coupon;
    if (!coupon) return;
    await this.ensure();
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const { coupons } = await this.settings(connection, true);
      const current = coupons.find((c) => c.code === coupon.code);
      if (!couponIsCurrent(current, this.now()) || current.percent !== coupon.percent)
        reject(
          "COUPON_INVALID",
          "Este cupom mudou ou saiu da validade. Atualize a página e confira o total.",
          409,
        );
      const [existing] = await connection.execute(
        "SELECT code,email,discount_cents FROM mn_coupon_redemptions WHERE reference=? FOR UPDATE",
        [reference],
      );
      if (existing.length) {
        if (
          existing[0].code !== coupon.code ||
          existing[0].email !== selection.email ||
          Number(existing[0].discount_cents) !== coupon.discountCents
        )
          reject(
            "CHECKOUT_CONFLICT",
            "Esta tentativa já foi usada com outros dados. Atualize a página.",
            409,
          );
        await connection.commit();
        return;
      }
      if (
        current.maxUses &&
        (await this.countUses(connection, coupon.code)) >= current.maxUses
      )
        reject(
          "COUPON_EXHAUSTED",
          "Este cupom atingiu o limite de usos. Remova o cupom para continuar.",
          409,
        );
      if (
        current.onePerCustomer &&
        (await this.countUses(connection, coupon.code, selection.email)) > 0
      )
        reject(
          "COUPON_ALREADY_USED",
          "Este cupom já foi usado com este e-mail. Remova o cupom para continuar.",
          409,
        );
      await connection.execute(
        "INSERT INTO mn_coupon_redemptions(reference,code,email,percent,discount_cents,created_at) VALUES(?,?,?,?,?,?)",
        [
          reference,
          coupon.code,
          selection.email,
          coupon.percent,
          coupon.discountCents,
          this.now(),
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
