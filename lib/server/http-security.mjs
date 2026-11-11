import { CheckoutError, reject } from "./errors.mjs";

export function jsonResponse(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      Vary: "Cookie, Origin",
      ...extraHeaders,
    },
  });
}
export function safeFailure(error) {
  if (error instanceof CheckoutError)
    return jsonResponse(
      { error: error.message, code: error.code },
      error.status,
      error.status === 429
        ? { "Retry-After": String(error.retryAfter || 60) }
        : {},
    );
  // Do not log request bodies, provider responses, names, email addresses or credentials.
  console.error("[checkout] unexpected internal failure");
  return jsonResponse(
    {
      error:
        "Não foi possível concluir esta etapa. Tente novamente em instantes.",
      code: "INTERNAL_ERROR",
    },
    500,
  );
}
export function assertSameOrigin(request, origin, requireOrigin = true) {
  const supplied = request.headers.get("origin"),
    site = request.headers.get("sec-fetch-site");
  if (
    (requireOrigin && supplied !== origin) ||
    (supplied && supplied !== origin) ||
    (site && site !== "same-origin" && site !== "none")
  )
    reject(
      "ORIGIN_REJECTED",
      "Atualize a página da loja e tente novamente.",
      403,
    );
}
export async function readJson(request, maxBytes = 16000) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    reject("CONTENT_TYPE", "Formato de requisição inválido.", 415);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    reject("BODY_TOO_LARGE", "A solicitação excede o tamanho permitido.", 413);
  if (!request.body) reject("INVALID_JSON", "Solicitação vazia.");
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        reject(
          "BODY_TOO_LARGE",
          "A solicitação excede o tamanho permitido.",
          413,
        );
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      reject("INVALID_JSON", "Solicitação inválida.");
    }
  } finally {
    reader.releaseLock();
  }
}
export function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  if (cookie.length > 16000) return null;
  const values = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}
export function cookieValue(name, value, secure, lifetime) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${lifetime}${secure ? "; Secure" : ""}`;
}
export class RateLimiter {
  constructor(maxEntries = 5000) {
    this.entries = new Map();
    this.maxEntries = maxEntries;
  }
  take(key, limit, duration, now) {
    let entry = this.entries.get(key);
    if (!entry || entry.until <= now) {
      entry = { count: 0, until: now + duration };
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    entry.count++;
    while (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value);
    if (entry.count > limit) {
      const error = new CheckoutError(
        "RATE_LIMIT",
        "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
        429,
      );
      error.retryAfter = Math.max(1, Math.ceil(entry.until - now));
      throw error;
    }
  }
}
