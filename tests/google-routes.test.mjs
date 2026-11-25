import { test } from "node:test";
import assert from "node:assert/strict";
import {
  googleRoutesClient,
  routeAddress,
} from "../lib/server/google-routes.mjs";
import {
  createShippingService,
  shippingDefaults,
  validateShippingSettings,
} from "../lib/server/shipping-service.mjs";

const key = "AIzaSy" + "A".repeat(33);
const store = {
  postalCode: "06787525",
  street: "Rua do CEP",
  neighborhood: "Jardim das Margaridas",
  city: "Taboão da Serra",
  state: "SP",
  latitude: null,
  longitude: null,
};
function routesResponse(body, status = 200) {
  return async (url, options) => {
    routesResponse.last = { url, options };
    return Response.json(body, { status });
  };
}

test("the Google client needs a plausible server key and sends only addresses", async () => {
  for (const value of [undefined, "", "short", "key with spaces " + "a".repeat(30)])
    assert.equal(googleRoutesClient(value), null);
  const client = googleRoutesClient(
    key,
    routesResponse({
      routes: [{ distanceMeters: 4235 }],
      geocodingResults: {
        origin: { type: ["street_address"] },
        destination: { type: ["route"] },
      },
    }),
  );
  const from = routeAddress(store, "Rua José Duarte Souza, 21"),
    to = routeAddress({ ...store, postalCode: "06754100", street: "Rua A" });
  assert.equal(
    from,
    "Rua José Duarte Souza, 21, Jardim das Margaridas, Taboão da Serra - SP, 06787-525, Brasil",
  );
  assert.equal(
    await client.distance(
      { place: store, streetLine: "Rua José Duarte Souza, 21" },
      { place: { ...store, postalCode: "06754100", street: "Rua A" } },
    ),
    4235,
  );
  const { url, options } = routesResponse.last;
  assert.equal(
    url,
    "https://routes.googleapis.com/directions/v2:computeRoutes",
  );
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.equal(options.headers["X-Goog-Api-Key"], key);
  assert.equal(
    options.headers["X-Goog-FieldMask"],
    "routes.distanceMeters,geocodingResults",
  );
  const body = JSON.parse(options.body);
  assert.deepEqual(body.origin, { address: from });
  assert.deepEqual(body.destination, { address: to });
  assert.equal(body.travelMode, "DRIVE");
  // Google omits distanceMeters for a zero-length route.
  const same = googleRoutesClient(key, routesResponse({ routes: [{}] }));
  assert.equal(await same.distance({ place: store }, { place: store }), 0);
});

test("imprecise addresses, provider errors and oversized answers never produce a fee", async () => {
  const city = { type: ["locality", "political"] };
  await assert.rejects(
    googleRoutesClient(
      key,
      routesResponse({
        routes: [{ distanceMeters: 100 }],
        geocodingResults: { destination: city },
      }),
    ).distance({ place: store }, { place: store }),
    { code: "CEP_MANUAL_QUOTE" },
  );
  await assert.rejects(
    googleRoutesClient(
      key,
      routesResponse({
        routes: [{ distanceMeters: 100 }],
        geocodingResults: { origin: city },
      }),
    ).distance({ place: store }, { place: store }),
    { code: "ORIGIN_IMPRECISE" },
  );
  await assert.rejects(
    googleRoutesClient(key, routesResponse({ routes: [] })).distance({ place: store }, { place: store }),
    { code: "CEP_MANUAL_QUOTE" },
  );
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await assert.rejects(
      googleRoutesClient(
        key,
        routesResponse({ error: { message: "API key invalid" } }, 403),
      ).distance({ place: store }, { place: store }),
      { code: "ROUTE_UNAVAILABLE", status: 503 },
    );
  } finally {
    console.error = original;
  }
  assert.ok(logged.every((line) => !line.includes(key)));
  await assert.rejects(
    googleRoutesClient(
      key,
      async () => new Response("x".repeat(70000), { status: 200 }),
    ).distance({ place: store }, { place: store }),
    { code: "ROUTE_UNAVAILABLE" },
  );
});

test("shipping charges the driving distance from the saved origin address and caches it", async () => {
  const value = {
    ...shippingDefaults,
    enabled: true,
    originPostalCode: store.postalCode,
    originAddress: "Rua José Duarte Souza, 21",
    pricePerKmCents: 300,
    baseFeeCents: 200,
    minimumFeeCents: 800,
    revision: 4,
    origin: store,
  };
  const calls = [];
  const routes = {
    provider: "google",
    async distance(from, to) {
      calls.push({
        from: routeAddress(from.place, from.streetLine),
        to: routeAddress(to.place),
      });
      return 4200;
    },
  };
  const service = createShippingService({
    repository: {
      shippingSettings: async () => value,
      loginLimit: async () => true,
    },
    catalogProvider: async () => [],
    policy: { maxOrderCents: 1000000 },
    config: {
      origin: "https://loja.example",
      secret: "f".repeat(64),
      secure: true,
    },
    // BrasilAPI often has no coordinates for a CEP; the route does not need them.
    fetcher: async (url) =>
      Response.json({
        cep: url.split("/").at(-1),
        state: "SP",
        city: "Taboão da Serra",
        street: "Rua de destino",
        neighborhood: "Centro",
      }),
    routes,
  });
  const first = await service.estimate({
    postalCode: "06754-100",
    subtotalCents: 5000,
  });
  assert.equal(first.distanceMeters, 4200);
  assert.equal(first.distanceMethod, "route");
  // 200 + 4,2 km × 300 = 1460 cents.
  assert.equal(first.feeCents, 1460);
  assert.equal("latitude" in first.address, false);
  assert.deepEqual(calls[0], {
    from: "Rua José Duarte Souza, 21, Jardim das Margaridas, Taboão da Serra - SP, 06787-525, Brasil",
    to: "Rua de destino, Centro, Taboão da Serra - SP, 06754-100, Brasil",
  });
  await service.estimate({ postalCode: "06754100", subtotalCents: 9000 });
  assert.equal(calls.length, 1);
  assert.equal((await service.publicSettings()).distanceMethod, "route");
});

test("the origin address is optional, trimmed and free of markup", () => {
  const base = {
    enabled: false,
    originPostalCode: "",
    pricePerKmCents: 0,
    baseFeeCents: 0,
    minimumFeeCents: 0,
    maxDistanceMeters: 10000,
    freeAboveCents: null,
    revision: 0,
  };
  assert.equal(validateShippingSettings(base).originAddress, "");
  assert.equal(
    validateShippingSettings({ ...base, originAddress: "  Rua A, 21 " })
      .originAddress,
    "Rua A, 21",
  );
  for (const originAddress of ["<script>", "a".repeat(121), 21])
    assert.throws(() => validateShippingSettings({ ...base, originAddress }), {
      code: "INVALID_SHIPPING",
    });
});
