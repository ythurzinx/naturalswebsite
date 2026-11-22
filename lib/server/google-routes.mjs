import { reject } from "./errors.mjs";

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
// Address matches precise enough to charge by distance. A match on the whole
// city or neighborhood would price every customer as if they lived downtown.
const PRECISE = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "intersection",
  "postal_code",
  "establishment",
  "point_of_interest",
  "plus_code",
]);
export function routeAddress(place, streetLine = "") {
  const cep = `${place.postalCode.slice(0, 5)}-${place.postalCode.slice(5)}`;
  const street = streetLine.trim() || place.street;
  return `${street}, ${place.neighborhood}, ${place.city} - ${place.state}, ${cep}, Brasil`;
}
function precise(result) {
  return (
    !result ||
    !Array.isArray(result.type) ||
    result.type.some((type) => PRECISE.has(type))
  );
}
// Server-side only: the key never reaches the browser, logs or responses.
export function googleRoutesClient(apiKey, fetcher = fetch) {
  if (typeof apiKey !== "string" || !/^[A-Za-z0-9_-]{30,100}$/.test(apiKey))
    return null;
  async function distance(origin, destination) {
    let data;
    try {
      const response = await fetcher(ENDPOINT, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,geocodingResults",
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
          languageCode: "pt-BR",
          regionCode: "br",
          units: "METRIC",
        }),
      });
      if (!response.ok || !response.body) {
        console.error(
          `[shipping] Google Routes respondeu com status ${response.status}`,
        );
        throw Error();
      }
      const reader = response.body.getReader(),
        chunks = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 64000) {
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
        "ROUTE_UNAVAILABLE",
        "Não foi possível calcular a distância agora. Tente novamente ou fale com a equipe.",
        503,
      );
    }
    if (!precise(data?.geocodingResults?.origin))
      reject(
        "ORIGIN_IMPRECISE",
        "O Google Maps não encontrou com precisão o endereço de saída da loja. Revise a rua e o número no painel.",
        409,
      );
    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    // Routes omits distanceMeters when the distance is zero.
    const meters = route ? (route.distanceMeters ?? 0) : null;
    if (
      !route ||
      !precise(data?.geocodingResults?.destination) ||
      !Number.isSafeInteger(meters) ||
      meters < 0 ||
      meters > 1000000
    )
      reject(
        "CEP_MANUAL_QUOTE",
        "Esse CEP precisa de confirmação de endereço. Fale com a equipe para combinar a entrega.",
        409,
      );
    return meters;
  }
  return { distance };
}
