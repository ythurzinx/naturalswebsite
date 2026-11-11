import { CheckoutError, reject } from "./errors.mjs";
export function createMercadoPagoClient(accessToken, fetcher = fetch) {
  return async function request(
    path,
    { method = "GET", body, idempotencyKey } = {},
  ) {
    if (
      !/^\/v1\/orders(?:\/ORD[A-Z0-9]{8,64})?$/.test(path) &&
      !(method === "GET" && /^\/v1\/payments\/[0-9]{1,25}$/.test(path))
    )
      reject("INTERNAL_PATH", "Operação inválida.", 500);
    try {
      const response = await fetcher(`https://api.mercadopago.com${path}`, {
        method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        if (response.status === 429)
          reject(
            "PROVIDER_BUSY",
            "O serviço de pagamento está ocupado. Aguarde e tente novamente.",
            503,
          );
        if (response.status === 409)
          reject(
            "CHECKOUT_RETRY",
            "Esta tentativa está em processamento. Aguarde e tente novamente.",
            409,
          );
        // Provider errors may contain bearer tokens or customer data: never forward or log the body.
        reject(
          "PAYMENT_SERVICE_UNAVAILABLE",
          "Pagamento indisponível no momento. Tente novamente ou fale com a equipe.",
          502,
        );
      }
      const reader = response.body?.getReader();
      if (!reader)
        reject("PROVIDER_RESPONSE", "Resposta de pagamento inválida.", 502);
      const chunks = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 262144) {
            await reader.cancel();
            reject("PROVIDER_RESPONSE", "Resposta de pagamento inválida.", 502);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        reject("PROVIDER_RESPONSE", "Resposta de pagamento inválida.", 502);
      }
    } catch (error) {
      if (error instanceof CheckoutError) throw error;
      reject(
        "PAYMENT_NETWORK_ERROR",
        "Não foi possível consultar o pagamento. Aguarde e tente novamente.",
        502,
      );
    }
  };
}
