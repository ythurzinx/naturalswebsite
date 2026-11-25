import { test } from "node:test";
import assert from "node:assert/strict";
import { tomTomClient, splitStreetLine } from "../lib/server/tomtom.mjs";

const key = "AbCdEf0123456789AbCdEf0123456789";
const store = {
  postalCode: "06787525",
  street: "Rua Frei Galvão",
  neighborhood: "Jardim Saint Moritz",
  city: "Taboão da Serra",
  state: "SP",
};
const customer = {
  postalCode: "06754100",
  street: "Rua das Magnólias",
  neighborhood: "Parque Assunção",
  city: "Taboão da Serra",
  state: "SP",
};
const found = (type, lat, lon, municipality = "Taboão da Serra") => ({
  results: [
    {
      type,
      matchConfidence: { score: 1 },
      address: { municipality, countrySubdivision: "SP" },
      position: { lat, lon },
    },
  ],
});
function fake(responses) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    return typeof next === "function"
      ? next()
      : Response.json(next.body, { status: next.status || 200 });
  };
  return { calls, fetcher };
}

test("street lines are split into street and number", () => {
  assert.deepEqual(splitStreetLine("Rua José Duarte Souza, 21"), {
    streetName: "Rua José Duarte Souza",
    streetNumber: "21",
  });
  assert.deepEqual(splitStreetLine("Av. Brasil nº 1500A"), {
    streetName: "Av. Brasil",
    streetNumber: "1500A",
  });
  assert.deepEqual(splitStreetLine("Rua Sem Número"), {
    streetName: "Rua Sem Número",
    streetNumber: "",
  });
});

test("the free TomTom client geocodes both ends and charges the car route", async () => {
  for (const value of [undefined, "", "short", "has-dash-" + "a".repeat(30), "a b" + "c".repeat(30)])
    assert.equal(tomTomClient(value), null);
  const { calls, fetcher } = fake([
    { body: found("Point Address", -23.6261, -46.7917) },
    { body: found("Street", -23.6105, -46.7783) },
    { body: { routes: [{ summary: { lengthInMeters: 3480, travelTimeInSeconds: 500 } }] } },
  ]);
  const client = tomTomClient(key, fetcher);
  assert.equal(client.provider, "tomtom");
  assert.equal(
    await client.distance(
      { place: store, streetLine: "Rua José Duarte Souza, 21" },
      { place: customer },
    ),
    3480,
  );
  const [origin, destination, route] = calls.map((c) => new URL(c.url));
  assert.equal(origin.origin + origin.pathname, "https://api.tomtom.com/search/2/structuredGeocode.json");
  assert.equal(origin.searchParams.get("streetName"), "Rua José Duarte Souza");
  assert.equal(origin.searchParams.get("streetNumber"), "21");
  assert.equal(origin.searchParams.get("municipality"), "Taboão da Serra");
  assert.equal(origin.searchParams.get("postalCode"), "06787-525");
  assert.equal(origin.searchParams.get("countryCode"), "BR");
  assert.equal(destination.searchParams.get("streetName"), "Rua das Magnólias");
  assert.equal(destination.searchParams.has("streetNumber"), false);
  assert.equal(
    route.pathname,
    "/routing/1/calculateRoute/-23.6261,-46.7917:-23.6105,-46.7783/json",
  );
  assert.equal(route.searchParams.get("travelMode"), "car");
  assert.equal(route.searchParams.get("traffic"), "false");
  for (const call of calls) {
    assert.equal(new URL(call.url).searchParams.get("key"), key);
    assert.equal(call.options.redirect, "error");
  }
});

test("city-level matches, other cities, errors and huge answers never produce a fee", async () => {
  const fail = async (responses, code) => {
    const { fetcher } = fake(responses);
    await assert.rejects(
      tomTomClient(key, fetcher).distance({ place: store }, { place: customer }),
      { code },
    );
  };
  await fail([{ body: found("Geography", -23.62, -46.79) }], "ORIGIN_IMPRECISE");
  await fail(
    [
      { body: found("Point Address", -23.62, -46.79) },
      { body: found("Geography", -23.62, -46.79) },
    ],
    "CEP_MANUAL_QUOTE",
  );
  await fail(
    [
      { body: found("Point Address", -23.62, -46.79) },
      { body: found("Street", -23.55, -46.63, "São Paulo") },
    ],
    "CEP_MANUAL_QUOTE",
  );
  await fail(
    [
      { body: found("Point Address", -23.62, -46.79) },
      { body: { results: [] } },
    ],
    "CEP_MANUAL_QUOTE",
  );
  await fail(
    [
      { body: found("Point Address", -23.62, -46.79) },
      { body: found("Street", -23.61, -46.78) },
      { body: { routes: [] } },
    ],
    "CEP_MANUAL_QUOTE",
  );
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await fail([{ status: 403, body: { detailedError: { code: "Forbidden" } } }], "ROUTE_UNAVAILABLE");
  } finally {
    console.error = original;
  }
  assert.ok(logged.length && logged.every((line) => !line.includes(key)));
  await fail([() => new Response("x".repeat(300000))], "ROUTE_UNAVAILABLE");
  await fail([() => Promise.reject(new Error("offline"))], "ROUTE_UNAVAILABLE");
});

test("the store address is looked up once and a zero-length route costs nothing", async () => {
  const { calls, fetcher } = fake([
    { body: found("Point Address", -23.62, -46.79) },
    { body: found("Street", -23.61, -46.78) },
    { body: { routes: [{ summary: { lengthInMeters: 900 } }] } },
    { body: found("Street", -23.62, -46.79) },
    { body: { routes: [{ summary: {} }] } },
  ]);
  const client = tomTomClient(key, fetcher);
  await client.distance({ place: store }, { place: customer });
  assert.equal(
    await client.distance(
      { place: store },
      { place: { ...customer, postalCode: "06763020", street: "Rua B" } },
    ),
    0,
  );
  assert.equal(calls.filter((c) => c.url.includes("structuredGeocode")).length, 3);
});
