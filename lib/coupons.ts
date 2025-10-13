import type { Coupon } from "./types"

const STORAGE_KEY = "mundo-natural.admin.coupons"

function isBrowser() {
  return typeof window !== "undefined"
}

function readStoredCoupons(): Coupon[] {
  if (!isBrowser()) return []

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Coupon[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((coupon) => ({
      ...coupon,
      code: coupon.code.toUpperCase(),
      discountType: coupon.discountType === "fixed" ? "fixed" : "percentage",
      discount: Number(coupon.discount) || 0,
      minPurchase: coupon.minPurchase ?? undefined,
      expiryDate: coupon.expiryDate ?? undefined,
      usageLimit: coupon.usageLimit ?? undefined,
      usedCount: coupon.usedCount ?? 0,
      isActive: coupon.isActive ?? true,
    }))
  } catch (error) {
    console.warn("[coupons] Failed to parse stored coupons", error)
    return []
  }
}

function writeStoredCoupons(coupons: Coupon[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons))
}

export function getCoupons(): Coupon[] {
  return readStoredCoupons()
}

export function saveCoupon(coupon: Coupon) {
  if (!isBrowser()) return

  const coupons = readStoredCoupons()
  const normalized: Coupon = {
    ...coupon,
    code: coupon.code.toUpperCase(),
    discountType: coupon.discountType === "fixed" ? "fixed" : "percentage",
    discount: Number.isFinite(coupon.discount) ? coupon.discount : 0,
    minPurchase: coupon.minPurchase ?? undefined,
    expiryDate: coupon.expiryDate || undefined,
    usageLimit: coupon.usageLimit ?? undefined,
    usedCount: coupon.usedCount ?? 0,
    isActive: coupon.isActive,
  }

  const index = coupons.findIndex((item) => item.id === normalized.id)
  if (index >= 0) {
    coupons[index] = normalized
  } else {
    coupons.push(normalized)
  }

  writeStoredCoupons(coupons)
}

export function deleteCoupon(couponId: string) {
  if (!isBrowser()) return

  const coupons = readStoredCoupons()
  const filtered = coupons.filter((coupon) => coupon.id !== couponId)
  writeStoredCoupons(filtered)
}

export function createNewCoupon(): Coupon {
  return {
    id: `coupon-${Date.now()}`,
    code: "",
    discountType: "percentage",
    discount: 0,
    minPurchase: undefined,
    expiryDate: undefined,
    usageLimit: undefined,
    usedCount: 0,
    isActive: true,
  }
}

interface CouponValidation {
  valid: boolean
  message?: string
  coupon?: Coupon
}

export function validateCoupon(code: string, orderTotal: number): CouponValidation {
  if (!code.trim()) {
    return { valid: false, message: "Informe um código de cupom." }
  }

  const coupons = readStoredCoupons()
  const coupon = coupons.find((item) => item.code.toUpperCase() === code.toUpperCase())

  if (!coupon) {
    return { valid: false, message: "Cupom não encontrado." }
  }

  if (!coupon.isActive) {
    return { valid: false, message: "Este cupom está inativo." }
  }

  if (coupon.expiryDate) {
    const expiry = new Date(coupon.expiryDate)
    const today = new Date()
    if (!Number.isNaN(expiry.valueOf()) && expiry < today) {
      return { valid: false, message: "Este cupom está expirado." }
    }
  }

  if (coupon.minPurchase && orderTotal < coupon.minPurchase) {
    return {
      valid: false,
      message: `Valor mínimo de compra é ${coupon.minPurchase.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}.`,
    }
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "Este cupom atingiu o limite de usos." }
  }

  return { valid: true, coupon }
}

export function calculateDiscount(coupon: Coupon, orderTotal: number): number {
  if (coupon.discountType === "fixed") {
    return Math.min(coupon.discount, orderTotal)
  }

  const percentageDiscount = (orderTotal * coupon.discount) / 100
  return Math.min(percentageDiscount, orderTotal)
}

export function incrementCouponUsage(couponId: string) {
  if (!isBrowser()) return

  const coupons = readStoredCoupons()
  const index = coupons.findIndex((coupon) => coupon.id === couponId)
  if (index === -1) return

  const target = coupons[index]
  const updated: Coupon = {
    ...target,
    usedCount: (target.usedCount ?? 0) + 1,
  }

  coupons[index] = updated
  writeStoredCoupons(coupons)
}
