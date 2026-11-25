import { test } from "node:test";
import assert from "node:assert/strict";
import { openRouteClient } from "../lib/server/openroute.mjs";

const key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgi" + "A".repeat(20);
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
function geo(layer, coordinates, locality = "Taboão da Serra") {
  return {
    type: "FeatureCollection",
    features: [
      {
        geometry: { type: "Point", coordinates },
        properties: { layer, locality },
      },
    ],
  };
}
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

test("the free client needs a plausible server key and charges the driving distance", async () => {
  for (const value of [undefined, "", "short", "key with spaces " + "a".repeat(30), "a\r\nX: y" + "a".repeat(20)])
    assert.equal(openRouteClient(value), null);
  const { calls, fetcher } = fake([
    { body: geo("address", [-46.79, -23.62]) },
    { body: geo("street", [-46.78, -23.6]) },
    { body: { routes: [{ summary: { distance: 3120.4, duration: 420 } }] } },
  ]);
  const client = openRouteClient(key, fetcher);
  assert.equal(client.provider, "openrouteservice");
  const meters = await client.distance(
    { place: store, streetLine: "Rua José Duarte Souza, 21" },
    { place: customer },
  );
  assert.equal(meters, 3120);
  const [origin, destination, route] = calls;
  assert.ok(
    origin.url.startsWith("https://api.heigit.org/pelias/v1/search/structured?"),
  );
  const params = new URL(origin.url).searchParams;
  assert.equal(params.get("address"), "Rua José Duarte Souza, 21");
  assert.equal(params.get("locality"), "Taboão da Serra");
  assert.equal(params.get("postalcode"), "06787-525");
  assert.equal(params.get("country"), "BRA");
  assert.equal(new URL(destination.url).searchParams.get("address"), "Rua das Magnólias");
  for (const call of calls) {
    assert.equal(call.options.headers.Authorization, key);
    assert.equal(call.options.redirect, "error");
  }
  assert.equal(
    route.url,
    "https://api.heigit.org/openrouteservice/v2/directions/driving-car",
  );
  assert.deepEqual(JSON.parse(route.options.body).coordinates, [
    [-46.79, -23.62],
    [-46.78, -23.6],
  ]);
  // Customer data beyond the street never leaves the server.
  assert.ok(calls.every((c) => !/Maria|@|9999/.test(c.url + (c.options.body || ""))));
});

test("city-level matches, other cities, provider errors and huge answers never produce a fee", async () => {
  const fail = async (responses, code) => {
    const { fetcher } = fake(responses);
    await assert.rejects(
      openRouteClient(key, fetcher).distance({ place: store }, { place: customer }),
      { code },
    );
  };
  await fail([{ body: geo("locality", [-46.79, -23.62]) }], "ORIGIN_IMPRECISE");
  await fail(
    [
      { body: geo("address", [-46.79, -23.62]) },
      { body: geo("locality", [-46.79, -23.62]) },
    ],
    "CEP_MANUAL_QUOTE",
  );
  await fail(
    [
      { body: geo("address", [-46.79, -23.62]) },
      { body: geo("street", [-46.6, -23.5], "São Paulo") },
    ],
    "CEP_MANUAL_QUOTE",
  );
  await fail(
    [
      { body: geo("address", [-46.79, -23.62]) },
      { body: geo("street", [-46.78, -23.6]) },
      { body: { routes: [] } },
    ],
    "CEP_MANUAL_QUOTE",
  );
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await fail([{ status: 403, body: { error: "Access to this API has been disallowed" } }], "ROUTE_UNAVAILABLE");
  } finally {
    console.error = original;
  }
  assert.ok(logged.length && logged.every((line) => !line.includes(key)));
  await fail([() => new Response("x".repeat(300000))], "ROUTE_UNAVAILABLE");
  await fail([() => Promise.reject(new Error("offline"))], "ROUTE_UNAVAILABLE");
});

test("the store address is looked up once and reused for later customers", async () => {
  const { calls, fetcher } = fake([
    { body: geo("address", [-46.79, -23.62]) },
    { body: geo("street", [-46.78, -23.6]) },
    { body: { routes: [{ summary: { distance: 1000 } }] } },
    { body: geo("street", [-46.77, -23.61]) },
    { body: { routes: [{ summary: {} }] } },
  ]);
  const client = openRouteClient(key, fetcher);
  await client.distance({ place: store }, { place: customer });
  const zero = await client.distance(
    { place: store },
    { place: { ...customer, postalCode: "06763020", street: "Rua B" } },
  );
  assert.equal(zero, 0);
  assert.equal(
    calls.filter((c) => c.url.includes("pelias")).length,
    3,
  );
});
