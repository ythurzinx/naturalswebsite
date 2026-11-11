import { createHmac } from "node:crypto";
import { equalSecret } from "./crypto-state.mjs";
import { orderIdPattern } from "./checkout-core.mjs";
export function verifyWebhookSignature(request, secret, nowSeconds) {
  const url = new URL(request.url),
    ids = url.searchParams.getAll("data.id");
  const id = ids.length === 1 ? ids[0] : "";
  const signature = request.headers.get("x-signature") || "",
    requestId = request.headers.get("x-request-id") || "";
  if (
    !orderIdPattern.test(id.toUpperCase()) ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(requestId) ||
    signature.length > 200
  )
    return null;
  const parts = signature.split(",").map((p) => p.trim().split("="));
  if (
    parts.length !== 2 ||
    parts.some((p) => p.length !== 2) ||
    new Set(parts.map((p) => p[0])).size !== 2
  )
    return null;
  const fields = Object.fromEntries(parts);
  if (
    !/^\d{10}(?:\d{3})?$/.test(fields.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(fields.v1 || "")
  )
    return null;
  const epoch = Number(fields.ts) / (fields.ts.length === 13 ? 1000 : 1);
  if (Math.abs(nowSeconds - epoch) > 300) return null;
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return equalSecret(fields.v1.toLowerCase(), expected)
    ? id.toUpperCase()
    : null;
}
