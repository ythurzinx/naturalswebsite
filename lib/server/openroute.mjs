import { reject } from "./errors.mjs";

const BASE = "https://api.heigit.org";
// Matches precise enough to charge by distance. A city or region match would
// price every customer as if they lived downtown.
const PRECISE_LAYERS = new Set([
  "address",
  "street",
  "venue",
  "postalcode",
  "neighbourhood",
]);
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
async function readLimited(response, limit = 256000) {
  if (!response.body) throw Error();
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
// openrouteservice (HeiGIT): free key, server-side only. The key travels in the
// Authorization header and never reaches the browser, logs or responses.
export function openRouteClient(apiKey, fetcher = fetch) {
  if (typeof apiKey !== "string" || !/^[A-Za-z0-9_=.+/-]{20,1000}$/.test(apiKey))
    return null;
  async function call(path, init = {}) {
    let response;
    try {
      response = await fetcher(`${BASE}${path}`, {
        ...init,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: "application/json",
          Authorization: apiKey,
          ...(init.headers || {}),
        },
      });
    } catch {
      response = null;
    }
    if (!response?.ok) {
      if (response)
        console.error(
          `[shipping] openrouteservice respondeu com status ${response.status}`,
        );
      reject(
        "ROUTE_UNAVAILABLE",
        "Não foi possível calcular a distância agora. Tente novamente ou fale com a equipe.",
        503,
      );
    }
    try {
      return await readLimited(response);
    } catch {
      reject(
        "ROUTE_UNAVAILABLE",
        "Não foi possível calcular a distância agora. Tente novamente ou fale com a equipe.",
        503,
      );
    }
  }
  const located = new Map();
  async function locate({ place, streetLine = "" }, code) {
    const cep = `${place.postalCode.slice(0, 5)}-${place.postalCode.slice(5)}`;
    const query = new URLSearchParams({
      address: streetLine.trim() || place.street,
      neighbourhood: place.neighborhood,
      locality: place.city,
      region: place.state,
      postalcode: cep,
      country: "BRA",
      size: "1",
    });
    const key = `${code}|${query}`,
      cached = located.get(key);
    if (cached && cached.expires > Date.now()) return cached.point;
    const data = await call(`/pelias/v1/search/structured?${query}`);
    const feature = Array.isArray(data?.features) ? data.features[0] : null;
    const [longitude, latitude] = feature?.geometry?.coordinates || [];
    const props = feature?.properties || {};
    const sameCity = [props.locality, props.localadmin, props.county].some(
      (name) => normalize(name) === normalize(place.city),
    );
    if (
      !feature ||
      !PRECISE_LAYERS.has(props.layer) ||
      !sameCity ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -34 ||
      latitude > 6 ||
      longitude < -74 ||
      longitude > -34
    )
      reject(
        code,
        code === "ORIGIN_IMPRECISE"
          ? "O mapa não encontrou com precisão o endereço de saída da loja. Revise a rua e o número no painel."
          : "Esse CEP precisa de confirmação de endereço. Fale com a equipe para combinar a entrega.",
        409,
      );
    located.delete(key);
    located.set(key, {
      point: [longitude, latitude],
      expires: Date.now() + 21600000,
    });
    if (located.size > 500) located.delete(located.keys().next().value);
    return [longitude, latitude];
  }
  async function distance(origin, destination) {
    const from = await locate(origin, "ORIGIN_IMPRECISE"),
      to = await locate(destination, "CEP_MANUAL_QUOTE");
    const data = await call("/openrouteservice/v2/directions/driving-car", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [from, to],
        instructions: false,
        units: "m",
      }),
    });
    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    // The summary omits distance for a zero-length route.
    const meters = route ? Math.round(route.summary?.distance ?? 0) : null;
    if (!route || !Number.isSafeInteger(meters) || meters < 0 || meters > 1000000)
      reject(
        "CEP_MANUAL_QUOTE",
        "Esse CEP precisa de confirmação de endereço. Fale com a equipe para combinar a entrega.",
        409,
      );
    return meters;
  }
  return { distance, provider: "openrouteservice" };
}
