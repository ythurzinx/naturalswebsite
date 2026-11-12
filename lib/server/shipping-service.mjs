import { randomUUID } from "node:crypto";
import { buildCheckout } from "./checkout-core.mjs";
import {
  deriveKey,
  seal,
  unseal,
  mac,
  equalSecret,
  digest,
} from "./crypto-state.mjs";
import {
  assertSameOrigin,
  readJson,
  readCookie,
  cookieValue,
  jsonResponse,
  safeFailure,
  RateLimiter,
} from "./http-security.mjs";
import { reject } from "./errors.mjs";

export const shippingDefaults = Object.freeze({
  enabled: false,
  originPostalCode: "",
  pricePerKmCents: 0,
  baseFeeCents: 0,
  minimumFeeCents: 0,
  maxDistanceMeters: 10000,
  freeAboveCents: null,
  revision: 0,
});
export function postalCode(value) {
  if (typeof value !== "string" || !/^\d{5}-?\d{3}$/.test(value))
    reject("INVALID_CEP", "Informe um CEP válido com 8 números.");
  return value.replace("-", "");
}
export function validateShippingSettings(body) {
  const keys = [
    "enabled",
    "originPostalCode",
    "pricePerKmCents",
    "baseFeeCents",
    "minimumFeeCents",
    "maxDistanceMeters",
    "freeAboveCents",
    "revision",
  ];
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !keys.includes(k)) ||
    typeof body.enabled !== "boolean" ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    !["pricePerKmCents", "baseFeeCents", "minimumFeeCents"].every(
      (k) => Number.isSafeInteger(body[k]) && body[k] >= 0 && body[k] <= 100000,
    ) ||
    !Number.isSafeInteger(body.maxDistanceMeters) ||
    body.maxDistanceMeters < 100 ||
    body.maxDistanceMeters > 100000 ||
    (body.freeAboveCents !== null &&
      (!Number.isSafeInteger(body.freeAboveCents) ||
        body.freeAboveCents < 100 ||
        body.freeAboveCents > 10000000))
  )
    reject(
      "INVALID_SHIPPING",
      "Revise os valores, o limite de distância e o CEP de origem.",
    );
  const cep =
    body.originPostalCode === "" && !body.enabled
      ? ""
      : postalCode(body.originPostalCode);
  if (
    body.enabled &&
    !body.pricePerKmCents &&
    !body.baseFeeCents &&
    !body.minimumFeeCents
  )
    reject(
      "INVALID_SHIPPING",
      "Defina uma tarifa ou taxa mínima antes de habilitar a entrega.",
    );
  return { ...body, originPostalCode: cep };
}
export function distanceMeters(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return Math.round(
    6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))),
  );
}
export function shippingFee(settings, meters, subtotalCents) {
  if (!settings.enabled)
    reject(
      "DELIVERY_DISABLED",
      "A entrega online ainda não está disponível. Consulte a equipe.",
      409,
    );
  if (
    !Number.isSafeInteger(meters) ||
    meters < 0 ||
    meters > settings.maxDistanceMeters
  )
    reject(
      "OUTSIDE_DELIVERY_AREA",
      "Este CEP fica fora da área de entrega online. Consulte a equipe.",
      409,
    );
  if (
    settings.freeAboveCents !== null &&
    subtotalCents >= settings.freeAboveCents
  )
    return 0;
  return Math.max(
    settings.minimumFeeCents,
    settings.baseFeeCents +
      Math.round((settings.pricePerKmCents * meters) / 1000),
  );
}
export function cartFingerprint(items) {
  return digest(
    JSON.stringify(
      items
        .filter((i) => i.id !== "__shipping__")
        .map((i) => ({
          key: i.key,
          quantity: i.quantity,
          unitCents: i.unitCents,
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    ),
  );
}
export function shippingConfiguration(env) {
  try {
    const url = new URL(env.APP_URL || env.NEXT_PUBLIC_SITE_URL || "");
    const local =
      env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.protocol === "http:";
    if (
      (!local && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !/^[A-Za-z0-9_-]{43,200}$/.test(env.ADMIN_SESSION_SECRET || "")
    )
      return null;
    return {
      origin: url.origin,
      secret: env.ADMIN_SESSION_SECRET,
      secure: url.protocol === "https:",
    };
  } catch {
    return null;
  }
}
export function createShippingService({
  repository,
  catalogProvider,
  policy,
  config,
  fetcher = fetch,
  now = () => Math.floor(Date.now() / 1000),
  limiter = new RateLimiter(),
}) {
  const key = config
    ? deriveKey(`shipping:${config.secret}`, config.origin)
    : null;
  const cookieName = `${config?.secure ? "__Host-" : ""}mn-shipping`;
  const cache = new Map();
  const safe =
    (fn) =>
    async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return safeFailure(error);
      }
    };
  function configured() {
    if (!config || !repository)
      reject(
        "SHIPPING_UNAVAILABLE",
        "O cálculo de entrega está indisponível. Consulte a equipe.",
        503,
      );
  }
  async function settings() {
    return repository
      ? { ...shippingDefaults, ...(await repository.shippingSettings()) }
      : { ...shippingDefaults };
  }
  async function publicSettings() {
    const value = await settings();
    return Object.fromEntries(
      Object.keys(shippingDefaults).map((k) => [
        k,
        k === "enabled" ? !!config && value.enabled : value[k],
      ]),
    );
  }
  async function locate(cep) {
    const cached = cache.get(cep);
    if (cached && cached.expires > now()) return cached.value;
    if (
      !(await repository.loginLimit("shipping-lookup-minute", 120, 60000)) ||
      !(await repository.loginLimit("shipping-lookup-day", 4000, 86400000))
    )
      reject(
        "RATE_LIMIT",
        "Muitas consultas de CEP. Tente novamente em instantes.",
        429,
      );
    let data;
    try {
      const response = await fetcher(
        `https://brasilapi.com.br/api/cep/v2/${cep}`,
        {
          redirect: "error",
          signal: AbortSignal.timeout(6000),
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!response.ok || !response.body) throw Error();
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 16000) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      reject(
        "CEP_UNAVAILABLE",
        "Não foi possível consultar esse CEP. Tente novamente ou fale com a equipe.",
        503,
      );
    }
    const coordinates = data.location?.coordinates;
    const latitude = Number(coordinates?.latitude),
      longitude = Number(coordinates?.longitude);
    const clean = (v, max) =>
      typeof v === "string" &&
      v.trim().length > 0 &&
      v.length <= max &&
      !/[\x00-\x1f\x7f<>]/.test(v);
    if (
      data.cep !== cep ||
      !coordinates ||
      !clean(String(coordinates.latitude ?? ""), 30) ||
      !clean(String(coordinates.longitude ?? ""), 30) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -34 ||
      latitude > 6 ||
      longitude < -74 ||
      longitude > -34 ||
      !clean(data.street, 160) ||
      !clean(data.neighborhood, 100) ||
      !clean(data.city, 100) ||
      !/^[A-Z]{2}$/.test(data.state)
    )
      reject(
        "CEP_MANUAL_QUOTE",
        "Esse CEP precisa de confirmação de endereço. Fale com a equipe para combinar a entrega.",
        409,
      );
    const value = {
      postalCode: cep,
      street: data.street.trim(),
      neighborhood: data.neighborhood.trim(),
      city: data.city.trim(),
      state: data.state,
      latitude,
      longitude,
    };
    cache.delete(cep);
    cache.set(cep, { value, expires: now() + 21600 });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return value;
  }
  async function saveSettings(body) {
    configured();
    const value = validateShippingSettings(body);
    const origin = value.originPostalCode
      ? await locate(value.originPostalCode)
      : null;
    await repository.saveShippingSettings({ ...value, origin });
    return publicSettings();
  }
  async function estimate(body) {
    configured();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (k) => !["postalCode", "subtotalCents"].includes(k),
      ) ||
      !Number.isSafeInteger(body.subtotalCents) ||
      body.subtotalCents < 100 ||
      body.subtotalCents > policy.maxOrderCents
    )
      reject(
        "INVALID_SHIPPING",
        "Revise o CEP de destino e o valor da compra.",
      );
    const value = await settings();
    if (!value.origin)
      reject(
        "ORIGIN_REQUIRED",
        "Salve o CEP de origem da loja antes de testar um destino.",
        409,
      );
    const destination = await locate(postalCode(body.postalCode));
    const meters = distanceMeters(value.origin, destination);
    const withinArea = meters <= value.maxDistanceMeters;
    const { latitude, longitude, ...address } = destination;
    return {
      address,
      distanceMeters: meters,
      withinArea,
      enabled: value.enabled,
      feeCents:
        withinArea && value.enabled
          ? shippingFee(value, meters, body.subtotalCents)
          : null,
      revision: value.revision,
    };
  }
  const session = safe(async (request) => {
    configured();
    assertSameOrigin(request, config.origin, false);
    limiter.take("shipping-sessions", 200, 60, now());
    const prior = unseal(
      key,
      "shipping-session",
      readCookie(request, cookieName),
      now(),
    );
    const value = prior || { jti: randomUUID() };
    const response = jsonResponse({
      csrfToken: mac(key, "shipping-csrf", value.jti),
    });
    if (!prior)
      response.headers.append(
        "Set-Cookie",
        cookieValue(
          cookieName,
          seal(key, "shipping-session", value, now(), 3600),
          config.secure,
          3600,
        ),
      );
    return response;
  });
  const quote = safe(async (request) => {
    configured();
    assertSameOrigin(request, config.origin);
    const context = unseal(
      key,
      "shipping-session",
      readCookie(request, cookieName),
      now(),
    );
    if (
      !context ||
      !equalSecret(
        request.headers.get("x-csrf-token"),
        mac(key, "shipping-csrf", context.jti),
      )
    )
      reject(
        "SHIPPING_SESSION_EXPIRED",
        "Atualize a página para calcular o frete.",
        403,
      );
    limiter.take(`shipping:${context.jti}`, 30, 600, now());
    limiter.take("shipping-quotes", 150, 60, now());
    const body = await readJson(request);
    if (
      !body ||
      Object.keys(body).some(
        (k) => !["items", "expectedSubtotalCents", "postalCode"].includes(k),
      )
    )
      reject("INVALID_QUOTE", "Revise seu carrinho e CEP.");
    const cep = postalCode(body.postalCode),
      value = await settings();
    if (!value.enabled || !value.origin)
      reject(
        "DELIVERY_DISABLED",
        "A entrega online ainda não está disponível. Consulte a equipe.",
        409,
      );
    const selection = buildCheckout(
      {
        items: body.items,
        name: "Cotação",
        email: "quote@example.invalid",
        fulfillment: "pickup",
        expectedTotalCents: body.expectedSubtotalCents,
      },
      await catalogProvider(),
      policy,
    );
    const destination = await locate(cep),
      meters = distanceMeters(value.origin, destination),
      feeCents = shippingFee(value, meters, selection.totalCents);
    const { latitude, longitude, ...address } = destination;
    const payload = {
      revision: value.revision,
      subtotalCents: selection.totalCents,
      fingerprint: cartFingerprint(selection.items),
      feeCents,
      distanceMeters: meters,
      address,
    };
    return jsonResponse({
      ...payload,
      quoteToken: seal(key, "shipping-quote", payload, now(), 600),
      expiresAt: (now() + 600) * 1000,
    });
  });
  async function resolveDelivery(input) {
    configured();
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (k) => !["quoteToken", "number", "complement"].includes(k),
      )
    )
      reject("INVALID_DELIVERY", "Calcule o frete e confira seu endereço.");
    const value = unseal(key, "shipping-quote", input.quoteToken, now()),
      current = await settings();
    if (!value || !current.enabled || value.revision !== current.revision)
      reject(
        "SHIPPING_QUOTE_EXPIRED",
        "O frete expirou ou foi atualizado. Calcule novamente antes de pagar.",
        409,
      );
    const valid = (v, min, max) =>
      typeof v === "string" &&
      v.trim().length >= min &&
      v.length <= max &&
      !/[\x00-\x1f\x7f<>]/.test(v);
    if (
      !valid(input.number, 1, 20) ||
      !valid(input.complement === undefined ? "" : input.complement, 0, 120)
    )
      reject(
        "INVALID_ADDRESS",
        "Informe o número do endereço (ou s/n) e revise o complemento.",
      );
    return {
      revision: value.revision,
      subtotalCents: value.subtotalCents,
      fingerprint: value.fingerprint,
      feeCents: value.feeCents,
      distanceMeters: value.distanceMeters,
      address: {
        ...value.address,
        number: input.number.trim(),
        complement: (input.complement || "").trim(),
      },
    };
  }
  return {
    publicSettings,
    saveSettings,
    session,
    quote,
    resolveDelivery,
    estimate,
  };
}
