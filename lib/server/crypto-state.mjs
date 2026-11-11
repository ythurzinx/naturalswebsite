import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export function deriveKey(accessToken, origin = "") {
  return Buffer.from(
    hkdfSync(
      "sha256",
      accessToken,
      "mundo-natural-v1",
      `checkout-state:${origin}`,
      32,
    ),
  );
}
export function mac(key, purpose, value) {
  return createHmac("sha256", key)
    .update(`${purpose}\0${value}`)
    .digest("base64url");
}
export function equalSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function seal(key, purpose, value, now, lifetimeSeconds) {
  const body = Buffer.from(
    JSON.stringify({
      ...value,
      v: 1,
      purpose,
      iat: now,
      exp: now + lifetimeSeconds,
    }),
  ).toString("base64url");
  return `${body}.${mac(key, "state", body)}`;
}
export function unseal(key, purpose, token, now) {
  try {
    if (typeof token !== "string" || token.length > 3800) return null;
    const parts = token.split(".");
    if (
      parts.length !== 2 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[1]) ||
      !equalSecret(parts[1], mac(key, "state", parts[0]))
    )
      return null;
    const value = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    );
    if (
      value.v !== 1 ||
      value.purpose !== purpose ||
      !Number.isInteger(value.iat) ||
      !Number.isInteger(value.exp) ||
      value.iat > now + 30 ||
      value.exp <= now ||
      value.exp - value.iat > 7 * 86400
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function externalReference(key, nonce, totalCents) {
  const unsigned = `MN1_${nonce}_${totalCents}`;
  return `${unsigned}_${mac(key, "reference", unsigned).slice(0, 22)}`;
}
export function verifyReference(key, value) {
  const match =
    typeof value === "string" &&
    value.match(
      /^MN1_([A-Za-z0-9_-]{22})_([1-9][0-9]{0,8})_([A-Za-z0-9_-]{22})$/,
    );
  if (
    !match ||
    !equalSecret(value, externalReference(key, match[1], Number(match[2])))
  )
    return null;
  return { nonce: match[1], totalCents: Number(match[2]) };
}
