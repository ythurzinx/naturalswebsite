import { reject } from "./errors.mjs";
import { normalize, readLimited } from "./route-http.mjs";

const BASE = "https://api.tomtom.com";
// Street-level matches only. A "Geography" result (city or neighborhood) would
// price every customer as if they lived at its center.
const PRECISE_TYPES = new Set([
  "Point Address",
  "Address Range",
  "Street",
  "Cross Street",
]);
const unavailable = () =>
  reject(
    "ROUTE_UNAVAILABLE",
    "Não foi possível calcular a distância agora. Tente novamente ou fale com a equipe.",
    503,
  );
// "Rua José Duarte Souza, 21" → street and number for the structured search.
export function splitStreetLine(line) {
  const match = /^(.*?)[,\s]+(?:n[º°o.]?\s*)?(\d+[A-Za-z]?)$/i.exec(line.trim());
  return match
    ? { streetName: match[1].trim(), streetNumber: match[2] }
    : { streetName: line.trim(), streetNumber: "" };
}
// TomTom free plan (no credit card, commercial use allowed). The key is a
// server-side secret: it goes in the query string as TomTom requires, and
// URLs are never logged or returned.
export function tomTomClient(apiKey, fetcher = fetch) {
  if (typeof apiKey !== "string" || !/^[A-Za-z0-9]{20,64}$/.test(apiKey))
    return null;
  async function call(path, params) {
    const query = new URLSearchParams({ ...params, key: apiKey });
    let response;
    try {
      response = await fetcher(`${BASE}${path}?${query}`, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
    } catch {
      response = null;
    }
    if (!response?.ok) {
      if (response)
        console.error(`[shipping] TomTom respondeu com status ${response.status}`);
      unavailable();
    }
    try {
      return await readLimited(response);
    } catch {
      unavailable();
    }
  }
  const located = new Map();
  async function locate({ place, streetLine = "" }, code) {
    const street = streetLine.trim()
      ? splitStreetLine(streetLine)
      : { streetName: place.street, streetNumber: "" };
    const params = {
      countryCode: "BR",
      streetName: street.streetName,
      ...(street.streetNumber ? { streetNumber: street.streetNumber } : {}),
      municipalitySubdivision: place.neighborhood,
      municipality: place.city,
      countrySubdivision: place.state,
      postalCode: `${place.postalCode.slice(0, 5)}-${place.postalCode.slice(5)}`,
      language: "pt-BR",
      limit: "1",
    };
    const cacheKey = `${code}|${JSON.stringify(params)}`,
      cached = located.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.point;
    const data = await call("/search/2/structuredGeocode.json", params);
    const result = Array.isArray(data?.results) ? data.results[0] : null;
    const lat = Number(result?.position?.lat),
      lon = Number(result?.position?.lon);
    const city = normalize(place.city);
    const sameCity = [
      result?.address?.municipality,
      result?.address?.localName,
    ].some((name) =>
      normalize(name)
        .split(",")
        .some((part) => part.trim() === city),
    );
    if (
      !result ||
      !PRECISE_TYPES.has(result.type) ||
      !sameCity ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -34 ||
      lat > 6 ||
      lon < -74 ||
      lon > -34
    )
      reject(
        code,
        code === "ORIGIN_IMPRECISE"
          ? "O mapa não encontrou com precisão o endereço de saída da loja. Revise a rua e o número no painel."
          : "Esse CEP precisa de confirmação de endereço. Fale com a equipe para combinar a entrega.",
        409,
      );
    const point = `${lat},${lon}`;
    located.delete(cacheKey);
    located.set(cacheKey, { point, expires: Date.now() + 21600000 });
    if (located.size > 500) located.delete(located.keys().next().value);
    return point;
  }
  async function distance(origin, destination) {
    const from = await locate(origin, "ORIGIN_IMPRECISE"),
      to = await locate(destination, "CEP_MANUAL_QUOTE");
    const data = await call(`/routing/1/calculateRoute/${from}:${to}/json`, {
      travelMode: "car",
      traffic: "false",
      routeType: "fastest",
    });
    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    const meters = route ? Math.round(route.summary?.lengthInMeters ?? 0) : null;
    if (!route || !Number.isSafeInteger(meters) || meters < 0 || meters > 1000000)
      reject(
        "CEP_MANUAL_QUOTE",
        "Esse CEP precisa de confirmação de endereço. Fale com a equipe para combinar a entrega.",
        409,
      );
    return meters;
  }
  return { distance, provider: "tomtom" };
}
