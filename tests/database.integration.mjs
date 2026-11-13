import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../lib/server/database.mjs";
import { migrate } from "../lib/server/schema.mjs";
import { ShopRepository } from "../lib/server/shop-repository.mjs";
import {
  createAdminAuth,
  hashPassword,
  totpCode,
  base32,
} from "../lib/server/admin-auth.mjs";
import { createAdminService } from "../lib/server/admin-service.mjs";
import { createPaymentService } from "../lib/server/payment-service.mjs";
import { createPaymentTesting } from "../lib/server/payment-testing.mjs";
import { referencePriceCents } from "../lib/pricing.mjs";
import { validateMerchandising } from "../lib/server/merchandising-validation.mjs";
import { createCustomerNotifications } from "../lib/server/customer-notifications.mjs";
import { createProductContentService } from "../lib/server/product-content.mjs";
import { createReviewService } from "../lib/server/review-service.mjs";
import { deriveKey, seal, mac } from "../lib/server/crypto-state.mjs";
import contentDefaults from "../lib/product-content.json" with { type: "json" };
import { buildCheckout, money } from "../lib/server/checkout-core.mjs";
const target = process.env.INTEGRATION_DATABASE_URL;
if (!target)
  throw Error(
    "Set INTEGRATION_DATABASE_URL to the disposable local mn_test database.",
  );
const parsed = new URL(target);
if (
  !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
  parsed.pathname !== "/mn_test"
)
  throw Error(
    "Integration tests may only use a disposable loopback mn_test database.",
  );
const pool = createDatabase({ DATABASE_URL: target });
const catalog = [
  {
    id: "prod-1",
    nome_produto: "Castanha",
    categoria: "Naturais",
    peso_produto: "kg",
    isGranel: true,
    valor_unitario: 119.99,
  },
  {
    id: "prod-2",
    nome_produto: "Pasta",
    categoria: "Naturais",
    peso_produto: "500 g",
    isGranel: false,
    valor_unitario: 19.99,
  },
  {
    id: "prod-3",
    nome_produto: "Outro",
    categoria: "Naturais",
    peso_produto: "100 g",
    isGranel: false,
    valor_unitario: 14.99,
  },
];
const policy = {
  pricesConfirmedByMerchant: true,
  onlinePickupEnabled: true,
  maxOrderCents: 1000000,
  maxDistinctLines: 20,
  maxQuantityPerLine: 20,
  disabledProductIds: [],
};
const repo = new ShopRepository(pool, catalog, policy);
let passwordHash;
before(async () => {
  await migrate(pool);
  await migrate(pool);
  passwordHash = await hashPassword("correct-fixture-password");
});
beforeEach(async () => {
  for (const table of [
    "mn_order_packing",
    "mn_order_events",
    "mn_order_details",
    "mn_checkout_intents",
    "mn_settings",
    "mn_order_items",
    "mn_orders",
    "mn_products",
    "mn_images",
    "mn_expenses",
    "mn_admin_sessions",
    "mn_admin_limits",
    "mn_admin_totp",
    "mn_audit",
  ])
    await pool.query(`DELETE FROM ${table}`);
});
after(async () => {
  await pool.end();
});
test("authenticated sandbox checkout forwards both CSRF layers and never creates financial or packing records", async () => {
  const config = {
    origin: "https://loja.example",
    secure: true,
    username: "admin",
    passwordHash,
    sessionSecret: "s".repeat(43),
    totpSecret: "",
  };
  let order;
  const testing = createPaymentTesting(
    {
      APP_URL: config.origin,
      MERCADOPAGO_TEST_ACCESS_TOKEN: "APP_USR-" + "fixture".repeat(8),
    },
    {
      fetcher: async (_url, options) => {
        if (options.method === "POST") {
          const body = JSON.parse(options.body);
          assert.equal(body.total_amount, "1.00");
          order = {
            ...body,
            id: "ORDTST01ADMININTEGRATION",
            currency: "BRL",
            country_code: "BRA",
            status: "created",
            status_detail: "created",
            total_paid_amount: "0.00",
            checkout_url:
              "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORDTST01ADMININTEGRATION",
          };
        }
        return Response.json(order);
      },
    },
  );
  const admin = createAdminService({
    config,
    repository: repo,
    payments: null,
    paymentTesting: testing,
  });
  const jar = new Map();
  let adminCsrf = "";
  async function call(path, method = "GET", body) {
    const response = await admin.handle(
      new Request(config.origin + "/api/admin/" + path, {
        method,
        headers: {
          Origin: config.origin,
          "Content-Type": "application/json",
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(adminCsrf ? { "X-CSRF-Token": adminCsrf } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      path.split("/"),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const [key, value] = cookie.split(";")[0].split("=");
      jar.set(key, value);
    }
    return response;
  }
  let response = await call("login", "POST", {
    username: "admin",
    password: "correct-fixture-password",
  });
  assert.equal(response.status, 200);
  adminCsrf = (await response.json()).csrfToken;
  response = await call("payments/test/session");
  assert.equal(response.status, 200);
  const first = await response.json();
  assert.equal(first.testMode, true);
  response = await call("payments/test/reset", "POST", {
    csrfToken: first.csrfToken,
  });
  assert.equal(response.status, 200);
  const next = await response.json();
  response = await call("payments/test/checkout", "POST", {
    csrfToken: next.csrfToken,
    input: {
      name: "Teste Loja",
      email: "teste@example.invalid",
      fulfillment: "pickup",
      items: [{ id: "sandbox-checkout", quantity: 1 }],
      expectedTotalCents: 100,
    },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.ok(jar.has("__Host-mn-sandbox-orders"));
  assert.ok(!jar.has("__Host-mn-orders"));
  order.status = "processed";
  order.status_detail = "accredited";
  order.total_paid_amount = "1.00";
  response = await call("payments/test/status");
  assert.equal((await response.json()).state, "paid");
  for (const table of [
    "mn_orders",
    "mn_order_items",
    "mn_order_events",
    "mn_order_packing",
    "mn_checkout_intents",
  ]) {
    const [rows] = await pool.execute(`SELECT COUNT(*) n FROM ${table}`);
    assert.equal(rows[0].n, 0);
  }
  assert.equal((await repo.dashboard()).orders, 0);
});
const product = (id = "prod-1") => ({
  id,
  name: id === "prod-1" ? "Castanha" : "Pasta",
  category: "Produtos naturais",
  weightLabel: id === "prod-1" ? "kg" : "500 g",
  isBulk: id === "prod-1",
  priceCents: id === "prod-1" ? 11999 : 1999,
  costCents: id === "prod-1" ? 8000 : 1000,
  active: true,
  imageSha: null,
});
test("versioned offers survive reloads and combos retain ingredient weights, costs and immutable order prices", async () => {
  await repo.saveProduct(product());
  await repo.saveProduct({
    ...product("prod-2"),
    isBulk: true,
    priceCents: 19990,
    costCents: 10000,
  });
  const settings = {
    revision: 0,
    offers: [],
    combos: [
      {
        id: "combo-integration",
        name: "Combo castanhas",
        description: "Porções separadas",
        active: true,
        discountPercent: 10,
        components: [
          { productId: "prod-1", weight: 100 },
          { productId: "prod-2", weight: 300 },
        ],
      },
    ],
  };
  await repo.saveMerchandising(
    validateMerchandising(settings, await repo.catalog(true)),
  );
  const second = new ShopRepository(pool, catalog, policy);
  assert.equal((await second.merchandisingSettings()).revision, 1);
  await assert.rejects(repo.saveMerchandising(settings), {
    code: "SETTINGS_CHANGED",
  });
  const products = await second.catalog(false),
    combo = products.find((p) => p.combo);
  assert.ok(
    !/costCents|cost_cents|imageSha|priceCents|active/.test(
      JSON.stringify(products),
    ),
  );
  const total = referencePriceCents(combo) * 2;
  const selection = buildCheckout(
    {
      name: "Cliente Teste",
      email: "cliente@example.invalid",
      fulfillment: "pickup",
      items: [{ id: combo.id, quantity: 2 }],
      expectedTotalCents: total,
    },
    products,
    policy,
  );
  const order = {
    id: "ORD01COMBOSDBFIXTURE",
    external_reference: "fixture-combo-reference",
    total_amount: money(total),
    total_paid_amount: money(total),
    status: "processed",
    status_detail: "accredited",
    created_date: new Date().toISOString(),
  };
  await repo.recordOrder(order, selection);
  let saved = await repo.order(order.id);
  assert.deepEqual(
    saved.items.map((i) => i.product_id),
    ["prod-1", "prod-2"],
  );
  assert.deepEqual(
    saved.items.map((i) => i.weight_grams),
    [100, 300],
  );
  assert.equal(saved.cost_total_cents, 7600);
  assert.ok(
    saved.items.every((i) => i.line_key.startsWith("combo-integration|")),
  );
  const prices = saved.items.map((i) => i.unit_cents);
  await repo.saveProduct({ ...product(), priceCents: 15000, costCents: 10000 });
  await repo.recordOrder(order);
  saved = await repo.order(order.id);
  assert.deepEqual(
    saved.items.map((i) => i.unit_cents),
    prices,
  );
  assert.equal(saved.cost_total_cents, 7600);
  assert.notEqual(
    referencePriceCents((await repo.catalog(false)).find((p) => p.combo)) * 2,
    total,
  );
  await repo.saveProduct({ ...product(), active: false });
  assert.ok(!(await repo.catalog(false)).some((p) => p.combo));
});
test("MySQL persists product edits without leaking costs in the public catalog", async () => {
  await repo.saveProduct(product());
  let items = await repo.catalog(false);
  assert.equal(items.find((p) => p.id === "prod-1").valor_unitario, 119.99);
  assert.equal(JSON.stringify(items).includes("costCents"), false);
  assert.equal(JSON.stringify(items).includes("cost_cents"), false);
  const newId = await repo.saveProduct({
    ...product("new"),
    id: undefined,
    name: "Novo produto",
    priceCents: 1299,
  });
  assert.ok(newId.startsWith("custom-"));
  assert.ok((await repo.catalog(false)).some((p) => p.id === newId));
  await repo.saveProduct({ ...product(), active: false });
  assert.ok(!(await repo.catalog(false)).some((p) => p.id === "prod-1"));
  assert.equal(
    (await repo.catalog(true)).find((p) => p.id === "prod-1").active,
    false,
  );
});
test("images are content addressed and survive another repository instance", async () => {
  const bytes = Buffer.from("fixture-image-data"),
    id = await repo.saveImage(bytes);
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(await repo.saveImage(bytes), id);
  const second = new ShopRepository(pool, catalog, policy);
  assert.deepEqual((await second.image(id)).data, bytes);
});
test("availability batches are atomic and preserve prices, costs and photos", async () => {
  const sha = await repo.saveImage(Buffer.from("fixture-photo"));
  await repo.saveProduct({ ...product("prod-1"), imageSha: sha });
  await repo.setAvailability(["prod-1", "prod-2"], false);
  assert.deepEqual(
    (await repo.catalog(false)).map((p) => p.id),
    ["prod-3"],
  );
  await assert.rejects(repo.setAvailability(["prod-1", "prod-99999"], true), {
    code: "PRODUCT_NOT_FOUND",
  });
  let saved = (await repo.catalog(true)).find((p) => p.id === "prod-1");
  assert.equal(saved.active, false);
  assert.equal(saved.priceCents, 11999);
  assert.equal(saved.costCents, 8000);
  assert.equal(saved.imageSha, sha);
  await repo.setAvailability(["prod-1", "prod-2"], true);
  saved = (await repo.catalog(true)).find((p) => p.id === "prod-1");
  assert.equal(saved.active, true);
  assert.equal((await repo.catalog(false)).length, 3);
  const [events] = await pool.execute(
    "SELECT * FROM mn_audit WHERE event='products.availability'",
  );
  assert.equal(events.length, 2);
});
function paymentFixture() {
  const config = {
    accessToken: "APP_USR-" + "fixture".repeat(8),
    origin: "https://loja.example",
    secure: true,
    environment: "production",
    webhookSecret: "fixture-webhook-secret-value",
  };
  let current;
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      current = {
        ...body,
        id: "ORD01MNDBFIXTUREABCDEFGH",
        currency: "BRL",
        country_code: "BRA",
        user_id: "12345",
        created_date: new Date().toISOString(),
        last_updated_date: new Date().toISOString(),
        status: "created",
        status_detail: "created",
        total_paid_amount: "0.00",
        checkout_url:
          "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD01MNDBFIXTUREABCDEFGH",
      };
      return Response.json(current, { status: 201 });
    }
    if (url.includes("/v1/payments/"))
      return Response.json({
        id: 123,
        currency_id: "BRL",
        external_reference: current.external_reference,
        collector_id: 12345,
        transaction_amount: Number(current.total_amount),
        transaction_amount_refunded: 0,
        fee_details: [{ fee_payer: "collector", amount: 3.99 }],
      });
    return Response.json(current);
  };
  const service = createPaymentService({
    catalog,
    policy,
    config,
    repository: repo,
    catalogProvider: () => repo.catalog(false),
    fetcher,
  });
  return { service, calls, getOrder: () => current };
}
test("orders, costs and fees persist; retries and sync do not duplicate revenue", async () => {
  await repo.saveProduct(product("prod-1"));
  await repo.saveProduct(product("prod-2"));
  const f = paymentFixture();
  const session = await f.service.session(
      new Request("https://loja.example/api/checkout/session"),
    ),
    sessionCookie = session.headers.getSetCookie()[0].split(";")[0],
    csrf = (await session.json()).csrfToken;
  const body = {
    items: [
      { id: "prod-1", quantity: 3, weight: 300 },
      { id: "prod-2", quantity: 2 },
    ],
    name: "Maria Fixture",
    email: "maria@example.com",
    fulfillment: "pickup",
    expectedTotalCents: 14798,
  };
  const request = () =>
    new Request("https://loja.example/api/checkout", {
      method: "POST",
      headers: {
        Origin: "https://loja.example",
        "Content-Type": "application/json",
        Cookie: sessionCookie,
        "X-CSRF-Token": csrf,
      },
      body: JSON.stringify(body),
    });
  await repo.saveProduct({ ...product("prod-1"), priceCents: 15999 });
  const stale = await f.service.checkout(request());
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "PRICE_CHANGED");
  assert.equal(
    f.calls.length,
    0,
    "stale prices must be rejected before contacting the payment provider",
  );
  await repo.saveProduct(product("prod-1"));
  const response = await f.service.checkout(request());
  assert.equal(response.status, 200, await response.clone().text());
  let stats = await repo.dashboard();
  assert.equal(stats.grossCents, 0);
  assert.equal(stats.costsCents, 0);
  assert.equal(stats.profitCents, 0);
  const order = f.getOrder();
  order.status = "processed";
  order.status_detail = "accredited";
  order.total_paid_amount = order.total_amount;
  order.last_updated_date = new Date(Date.now() + 1000).toISOString();
  order.transactions = { payments: [{ reference: { id: "123" } }] };
  await f.service.reconcile(order.id);
  await f.service.reconcile(order.id);
  stats = await repo.dashboard();
  assert.equal(stats.orders, 1);
  assert.equal(stats.grossCents, 14798);
  assert.equal(stats.costsCents, 9200);
  assert.equal(stats.feesCents, 399);
  assert.equal(stats.profitCents, 5199);
  assert.equal(stats.catalogHealth.active, 3);
  assert.equal(stats.catalogHealth.missingCosts, 1);
  assert.equal(stats.topProducts[0].id, "prod-1");
  assert.equal(stats.topProducts[0].grams, 900);
  assert.equal(stats.topProducts[0].grossCents, 10800);
  await repo.saveExpense({
    description: "Embalagens",
    amountCents: 500,
    incurredAt: Date.now(),
  });
  assert.equal((await repo.dashboard()).profitCents, 4699);
  await repo.saveProduct({ ...product("prod-1"), costCents: 50000 });
  assert.equal(
    (await repo.order(order.id)).cost_total_cents,
    9200,
    "original cost snapshot must not change",
  );
  assert.ok(!JSON.stringify(await repo.order(order.id)).includes("APP_USR"));
  await repo.recordOrder({
    ...order,
    status: "refunded",
    status_detail: "refunded",
    total_paid_amount: "0.00",
    last_updated_date: new Date(
      Date.parse(order.last_updated_date) + 1000,
    ).toISOString(),
  });
  // An older callback must not undo a newer refund during fee reconciliation.
  await f.service.reconcile(order.id);
  const latest = await repo.order(order.id);
  assert.equal(latest.state, "refunded");
  assert.equal(latest.paid_cents, 14798);
  assert.equal(latest.refunded_cents, 14798);
});
test("missing costs keep estimated profit unavailable until explicitly filled", async () => {
  const f = paymentFixture(),
    s = await f.service.session(
      new Request("https://loja.example/api/checkout/session"),
    ),
    cookie = s.headers.getSetCookie()[0].split(";")[0],
    csrf = (await s.json()).csrfToken;
  const r = await f.service.checkout(
    new Request("https://loja.example/api/checkout", {
      method: "POST",
      headers: {
        Origin: "https://loja.example",
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrf,
      },
      body: JSON.stringify({
        items: [{ id: "prod-3", quantity: 1 }],
        name: "Maria Fixture",
        email: "maria@example.com",
        fulfillment: "pickup",
        expectedTotalCents: 1499,
      }),
    }),
  );
  assert.equal(r.status, 200);
  const order = f.getOrder();
  order.status = "processed";
  order.status_detail = "accredited";
  order.total_paid_amount = order.total_amount;
  order.last_updated_date = new Date(Date.now() + 1000).toISOString();
  order.transactions = { payments: [{ reference: { id: "123" } }] };
  await f.service.reconcile(order.id);
  assert.equal((await repo.dashboard()).profitCents, null);
  await repo.saveProduct({
    ...product("prod-3"),
    name: "Outro",
    priceCents: 1499,
    costCents: 500,
  });
  await repo.backfillCosts();
  assert.equal((await repo.order(order.id)).cost_total_cents, 500);
  assert.equal((await repo.dashboard()).profitCents, 600);
});
test("concurrent database limits permit only the configured number of attempts", async () => {
  const attempts = await Promise.all(
    Array.from({ length: 10 }, () => repo.loginLimit("fixture", 3, 60000)),
  );
  assert.equal(attempts.filter(Boolean).length, 3);
});
test("admin authentication, MFA replay protection, CSRF and logout use MySQL", async () => {
  const secret = base32(Buffer.from("12345678901234567890")),
    clock = Date.now(),
    config = {
      origin: "https://loja.example",
      secure: true,
      username: "admin",
      passwordHash,
      sessionSecret: "s".repeat(43),
      totpSecret: secret,
    };
  const auth = createAdminAuth({ config, repository: repo, now: () => clock });
  const otp = totpCode(secret, Math.floor(clock / 30000));
  const login = () =>
    new Request("https://loja.example/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://loja.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "admin",
        password: "correct-fixture-password",
        otp,
      }),
    });
  const response = await auth.login(login()),
    cookie = response.headers.getSetCookie()[0].split(";")[0],
    session = await response.json();
  assert.ok(response.headers.get("set-cookie").includes("SameSite=Strict"));
  const request = (headers = {}) =>
    new Request("https://loja.example/api/admin/products", {
      headers: { Cookie: cookie, ...headers },
    });
  assert.equal((await auth.authenticate(request())).username, "admin");
  await assert.rejects(
    auth.authenticate(
      request({
        Origin: "https://attacker.example",
        "X-CSRF-Token": session.csrfToken,
      }),
      true,
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    auth.authenticate(
      request({ Origin: config.origin, "X-CSRF-Token": "fake" }),
      true,
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(auth.login(login()), (error) => error.status === 401);
  const other = createAdminAuth({
    config: { ...config, sessionSecret: "x".repeat(43) },
    repository: repo,
    now: () => clock,
  });
  await assert.rejects(
    other.authenticate(request()),
    (error) => error.status === 401,
  );
  await auth.logout(
    new Request(config.origin + "/api/admin/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: config.origin,
        "X-CSRF-Token": session.csrfToken,
      },
    }),
  );
  await assert.rejects(
    auth.authenticate(request()),
    (error) => error.status === 401,
  );
});
test("admin HTTP routing rejects anonymous reads and writes even when the database exists", async () => {
  const config = {
    origin: "https://loja.example",
    secure: true,
    username: "admin",
    passwordHash,
    sessionSecret: "s".repeat(43),
    totpSecret: "",
  };
  const service = createAdminService({
    config,
    repository: repo,
    payments: null,
  });
  for (const method of ["GET", "POST", "PATCH"]) {
    const response = await service.handle(
      new Request(config.origin + "/api/admin/products", {
        method,
        headers: { Origin: config.origin },
      }),
      ["products"],
    );
    assert.equal(response.status, 401);
  }
});

test("expense retries do not double count and mismatched reuse is rejected", async () => {
  const value = {
    id: "12345678-1234-1234-1234-123456789012",
    description: "Despesa fixture",
    amountCents: 500,
    incurredAt: Date.now(),
  };
  assert.equal(await repo.saveExpense(value), value.id);
  assert.equal(await repo.saveExpense(value), value.id);
  assert.equal((await repo.expenses()).length, 1);
  assert.equal((await repo.dashboard()).expensesCents, 500);
  await assert.rejects(repo.saveExpense({ ...value, amountCents: 1000 }));
});
test("authenticated admin HTTP edits and assigns a normalized photo to its own product", async () => {
  const config = {
    origin: "https://loja.example",
    secure: true,
    username: "admin",
    passwordHash,
    sessionSecret: "s".repeat(43),
    totpSecret: "",
  };
  const synced = [];
  const service = createAdminService({
    config,
    repository: repo,
    payments: {
      reconcile: async (id) => {
        synced.push(id);
      },
    },
  });
  const response = await service.handle(
    new Request(config.origin + "/api/admin/login", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "correct-fixture-password",
      }),
    }),
    ["login"],
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie()[0].split(";")[0],
    csrf = (await response.json()).csrfToken;
  const headers = {
    Cookie: cookie,
    Origin: config.origin,
    "X-CSRF-Token": csrf,
  };
  const sharp = (await import("sharp")).default,
    png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#ffccaa" },
    })
      .png()
      .toBuffer();
  const uploaded = await service.handle(
    new Request(config.origin + "/api/admin/images", {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/png" },
      body: png,
    }),
    ["images"],
  );
  assert.equal(uploaded.status, 201);
  const image = (await uploaded.json()).imageSha;
  const payload = {
    name: "Produto fotografado",
    category: "Naturais",
    weightLabel: "100 g",
    isBulk: false,
    priceCents: 1299,
    costCents: 700,
    active: true,
    imageSha: image,
  };
  const saved = await service.handle(
    new Request(config.origin + "/api/admin/products", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    ["products"],
  );
  assert.equal(saved.status, 201);
  const id = (await saved.json()).id;
  const publicProduct = (await repo.catalog(false)).find((p) => p.id === id);
  assert.equal(publicProduct.imagem, `/api/product-images/${image}`);
  assert.equal(publicProduct.costCents, undefined);
  assert.equal(
    (await sharp((await repo.image(image)).data).metadata()).format,
    "webp",
  );
  const updated = await service.handle(
    new Request(config.origin + `/api/admin/products/${id}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        isBulk: true,
        priceUnit: "100g",
        priceCents: 1200,
        costCents: 800,
      }),
    }),
    ["products", id],
  );
  assert.equal(updated.status, 200, await updated.clone().text());
  const edited = (await repo.catalog(true)).find((p) => p.id === id);
  assert.equal(edited.priceCents, 12000);
  assert.equal(edited.costCents, 8000);
  assert.equal(edited.peso_produto, "A granel · preço por 100 g");
  assert.equal(referencePriceCents(edited), 1200);
  assert.equal(edited.imagem, `/api/product-images/${image}`);
  const availability = (extra = {}, active = false) =>
    service.handle(
      new Request(config.origin + "/api/admin/products/availability", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", ...extra },
        body: JSON.stringify({ ids: [id], active }),
      }),
      ["products", "availability"],
    );
  assert.equal((await availability({ "X-CSRF-Token": "forged" })).status, 403);
  assert.equal(
    (await availability({ Origin: "https://attacker.example" })).status,
    403,
  );
  assert.ok((await repo.catalog(false)).some((p) => p.id === id));
  assert.equal((await availability()).status, 200);
  assert.equal(
    (await repo.catalog(false)).some((p) => p.id === id),
    false,
  );
  assert.equal((await availability({}, true)).status, 200);

  const orderId = "ORD01ADMINFIXTUREABCDEFG";
  await repo.recordOrder({
    id: orderId,
    external_reference: "fixture-reference",
    total_amount: "36.00",
    total_paid_amount: "36.00",
    status: "processed",
    status_detail: "accredited",
    created_date: new Date().toISOString(),
    items: [
      {
        external_code: `${id}:300`,
        title: "Produto fotografado 300 g",
        quantity: 1,
        unit_price: "36.00",
      },
    ],
  });
  const sync = (extra = {}) =>
    service.handle(
      new Request(config.origin + `/api/admin/orders/${orderId}/sync`, {
        method: "POST",
        headers: { ...headers, ...extra },
      }),
      ["orders", orderId, "sync"],
    );
  assert.equal((await sync({ "X-CSRF-Token": "forged" })).status, 403);
  assert.equal(synced.length, 0);
  assert.equal((await sync()).status, 200);
  assert.deepEqual(synced, [orderId]);
  for (let i = 1; i < 15; i++) assert.equal((await sync()).status, 200);
  assert.equal((await sync()).status, 429);
  assert.equal(synced.length, 15);
});

function deliveryOrderFixture() {
  const selection = {
    name: "Cliente entrega",
    email: "entrega@example.invalid",
    phone: "11999999999",
    notes: "Entregar na portaria",
    fulfillment: "delivery",
    totalCents: 4400,
    shippingCents: 800,
    delivery: {
      distanceMeters: 1500,
      address: {
        postalCode: "06754100",
        street: "Rua de teste",
        number: "22",
        complement: "Apto 2",
        neighborhood: "Centro",
        city: "Taboão da Serra",
        state: "SP",
      },
    },
    items: [
      {
        id: "prod-1",
        key: "prod-1:300",
        title: "Castanha · 300 g",
        quantity: 1,
        unitCents: 3600,
      },
      {
        id: "__shipping__",
        key: "__shipping__:0",
        title: "Entrega",
        quantity: 1,
        unitCents: 800,
      },
    ],
  };
  const order = {
    id: "ORD01MNDELIVERYDBFIXTURE",
    external_reference: "fixture-delivery-reference",
    total_amount: "44.00",
    total_paid_amount: "0.00",
    status: "created",
    status_detail: "created",
    created_date: new Date().toISOString(),
    last_updated_date: new Date().toISOString(),
    items: selection.items.map((i) => ({
      external_code: i.key,
      title: i.title,
      quantity: i.quantity,
      unit_price: (i.unitCents / 100).toFixed(2),
    })),
  };
  return { selection, order };
}
test("delivery address survives a lost checkout response and event retries do not duplicate alerts", async () => {
  await repo.saveProduct(product());
  const { selection, order } = deliveryOrderFixture();
  const baseline = await repo.orderAlerts();
  assert.deepEqual(baseline.events, []);
  await repo.recordCheckoutIntent(order.external_reference, selection);
  await repo.recordCheckoutIntent(order.external_reference, selection);
  await assert.rejects(
    repo.recordCheckoutIntent(order.external_reference, {
      ...selection,
      phone: "11988888888",
    }),
    { code: "CHECKOUT_CONFLICT" },
  );
  await Promise.all(Array.from({ length: 5 }, () => repo.recordOrder(order)));
  const created = await repo.order(order.id);
  assert.equal(created.address.number, "22");
  assert.equal(created.customer_phone, "11999999999");
  assert.equal(created.fulfillment_mode, "delivery");
  assert.equal(
    created.items.find((i) => i.product_id === "__shipping__").cost_unit_cents,
    0,
  );
  const paid = {
    ...order,
    status: "processed",
    status_detail: "accredited",
    total_paid_amount: "44.00",
    last_updated_date: new Date(Date.now() + 1000).toISOString(),
  };
  await Promise.all(Array.from({ length: 5 }, () => repo.recordOrder(paid)));
  const feed = await repo.orderAlerts(baseline.cursor);
  assert.deepEqual(
    feed.events.map((e) => e.kind),
    ["created", "paid"],
  );
  assert.equal(Number(feed.counts.toPack), 1);
  assert.equal((await repo.orderAlerts(feed.cursor)).events.length, 0);
  assert.deepEqual(
    (await repo.orderAlerts()).events,
    [],
    "login baselines do not replay old alerts",
  );
  await repo.saveOrderOperations(order.id, {
    staffNote: "Conferir embalagem\nBancada 2",
    courierName: "Entregador teste",
    deliveryCostCents: 600,
  });
  await repo.recordOrder(paid);
  assert.equal(
    (await repo.order(order.id)).staff_note,
    "Conferir embalagem\nBancada 2",
  );
  assert.equal((await repo.order(order.id)).delivery_cost_cents, 600);
  const [audit] = await pool.execute(
    "SELECT details FROM mn_audit WHERE entity_id=?",
    [order.id],
  );
  assert.equal(JSON.stringify(audit).includes("Bancada"), false);
  assert.equal(JSON.stringify(audit).includes("Rua de teste"), false);
});
test("packing is payment-gated, validates item ownership and requires every product before release", async () => {
  const { selection, order } = deliveryOrderFixture();
  await repo.recordOrder(order, selection);
  await assert.rejects(repo.setPacked(order.id, "prod-1:300", true), {
    code: "PAYMENT_REQUIRED",
  });
  await assert.rejects(repo.setFulfillment(order.id, "packing"), {
    code: "PAYMENT_REQUIRED",
  });
  await repo.recordOrder({
    ...order,
    status: "processed",
    status_detail: "accredited",
    total_paid_amount: "44.00",
    last_updated_date: new Date(Date.now() + 1000).toISOString(),
  });
  await repo.setFulfillment(order.id, "packing");
  await assert.rejects(repo.setFulfillment(order.id, "ready"), {
    code: "PACKING_INCOMPLETE",
  });
  await assert.rejects(repo.setPacked(order.id, "prod-9999:300", true), {
    code: "INVALID_ITEM",
  });
  await assert.rejects(repo.setPacked(order.id, "__shipping__:0", true), {
    code: "INVALID_ITEM",
  });
  await repo.setPacked(order.id, "prod-1:300", true);
  await repo.setFulfillment(order.id, "ready");
  await repo.setPacked(order.id, "prod-1:300", false);
  assert.equal((await repo.order(order.id)).fulfillment_status, "packing");
  await repo.setPacked(order.id, "prod-1:300", true);
  await assert.rejects(repo.setFulfillment(order.id, "out_for_delivery"), {
    code: "ETA_REQUIRED",
  });
  await repo.saveOrderOperations(order.id, {
    staffNote: "",
    courierName: "Teste",
    deliveryCostCents: null,
    estimatedMinutes: 30,
  });
  await repo.setFulfillment(order.id, "out_for_delivery");
  await assert.rejects(repo.setPacked(order.id, "prod-1:300", false), {
    code: "ORDER_LOCKED",
  });
  await repo.setFulfillment(order.id, "completed");
  assert.equal((await repo.order(order.id)).fulfillment_status, "completed");
  const pickup = { ...order, id: "ORD01MNPICKUPDBFIXTURE" };
  await repo.recordOrder(
    {
      ...pickup,
      status: "processed",
      status_detail: "accredited",
      total_paid_amount: "44.00",
    },
    { ...selection, fulfillment: "pickup", delivery: undefined },
  );
  await assert.rejects(repo.setFulfillment(pickup.id, "out_for_delivery"), {
    code: "INVALID_STATE",
  });
});
test("delivery costs are required for profit, counted once and shipping is excluded from popular products", async () => {
  await repo.saveProduct(product());
  const { selection, order } = deliveryOrderFixture();
  const paid = {
    ...order,
    status: "processed",
    status_detail: "accredited",
    total_paid_amount: "44.00",
  };
  await repo.recordOrder(paid, selection);
  await repo.settlement(order.id, {
    feeCents: 200,
    refundedCents: 0,
    providerUpdatedAt: Date.parse(paid.last_updated_date),
  });
  let stats = await repo.dashboard();
  assert.equal(stats.costsCents, 2400);
  assert.equal(stats.missingDeliveryCosts, 1);
  assert.equal(stats.profitCents, null);
  assert.equal(stats.topProducts.length, 1);
  assert.equal(stats.topProducts[0].id, "prod-1");
  await repo.saveOrderOperations(order.id, {
    staffNote: "",
    courierName: "Teste",
    deliveryCostCents: 600,
  });
  stats = await repo.dashboard();
  assert.equal(stats.deliveryCostsCents, 600);
  assert.equal(stats.missingDeliveryCosts, 0);
  assert.equal(stats.profitCents, 1200);
  await repo.recordOrder(paid);
  assert.equal((await repo.dashboard()).profitCents, 1200);
});
test("shipping settings use optimistic versions and do not rewrite historical delivery fees", async () => {
  const { selection, order } = deliveryOrderFixture();
  await repo.recordOrder(order, selection);
  await repo.saveShippingSettings({
    enabled: true,
    originPostalCode: "06754000",
    pricePerKmCents: 300,
    revision: 0,
  });
  assert.equal((await repo.shippingSettings()).revision, 1);
  await assert.rejects(
    repo.saveShippingSettings({ enabled: false, revision: 0 }),
    { code: "SETTINGS_CHANGED" },
  );
  await repo.saveShippingSettings({
    enabled: true,
    originPostalCode: "06754000",
    pricePerKmCents: 900,
    revision: 1,
  });
  assert.equal((await repo.shippingSettings()).pricePerKmCents, 900);
  assert.equal((await repo.order(order.id)).shipping_cents, 800);
});
test("alerts, freight settings, packing and operations require authentication and CSRF", async () => {
  const config = {
    origin: "https://loja.example",
    secure: true,
    username: "admin",
    passwordHash,
    sessionSecret: "s".repeat(43),
    totpSecret: "",
  };
  const service = createAdminService({
    config,
    repository: repo,
    payments: null,
  });
  for (const [method, path] of [
    ["GET", ["order-alerts"]],
    ["GET", ["shipping"]],
    ["PUT", ["shipping"]],
    ["GET", ["merchandising"]],
    ["PUT", ["merchandising"]],
    ["GET", ["payments", "diagnostics"]],
    ["GET", ["payments", "test", "session"]],
    ["POST", ["payments", "test", "checkout"]],
    ["GET", ["payments", "test", "status"]],
    ["POST", ["shipping", "estimate"]],
    ["PUT", ["orders", "ORD01MNDELIVERYDBFIXTURE", "packing"]],
    ["PUT", ["orders", "ORD01MNDELIVERYDBFIXTURE", "operations"]],
    ["GET", ["notifications"]],
    ["GET", ["content-products"]],
    ["GET", ["product-content", "prod-1"]],
    ["PUT", ["product-content", "prod-1"]],
    ["GET", ["reviews"]],
    ["PUT", ["reviews", "a".repeat(64)]],
    ["PUT", ["notifications"]],
    ["POST", ["notifications", "drain"]],
  ]) {
    const response = await service.handle(
      new Request(config.origin + "/api/admin/" + path.join("/"), {
        method,
        headers: { Origin: config.origin, "Content-Type": "application/json" },
        ...(method !== "GET" ? { body: "{}" } : {}),
      }),
      path,
    );
    assert.equal(response.status, 401);
  }
  const login = await service.handle(
    new Request(config.origin + "/api/admin/login", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "correct-fixture-password",
      }),
    }),
    ["login"],
  );
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  const csrf = (await login.json()).csrfToken;
  for (const [method, path] of [
    ["PUT", ["orders", "ORD01MNDELIVERYDBFIXTURE", "operations"]],
    ["PUT", ["notifications"]],
    ["PUT", ["product-content", "prod-1"]],
    ["PUT", ["reviews", "a".repeat(64)]],
    ["POST", ["notifications", "drain"]],
    ["PUT", ["merchandising"]],
    ["POST", ["shipping", "estimate"]],
  ])
    for (const headers of [
      { Origin: config.origin },
      { Origin: "https://evil.example", "X-CSRF-Token": csrf },
    ]) {
      const response = await service.handle(
        new Request(config.origin + "/api/admin/" + path.join("/"), {
          method,
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
            ...headers,
          },
          body: "{}",
        }),
        path,
      );
      assert.equal(response.status, 403);
    }
  const response = await service.handle(
    new Request(config.origin + "/api/admin/order-alerts?after=-1", {
      headers: { Cookie: cookie },
    }),
    ["order-alerts"],
  );
  assert.equal(response.status, 400);
});

test("customer contact, consent, ETA and durable notification outbox survive duplicate provider events", async () => {
  const calls = [];
  const notifications = createCustomerNotifications({
    repository: repo,
    env: {
      BREVO_API_KEY: "xkeysib-local-integration-fixture",
      BREVO_SENDER_EMAIL: "loja@example.invalid",
      BREVO_WHATSAPP_SENDER: "551151993525",
    },
    fetcher: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response("{}", { status: 201 });
    },
  });
  await notifications.saveSettings({
    revision: 0,
    emailEnabled: true,
    whatsappEnabled: true,
    whatsappTemplates: { paid: 1, ready: 2, out_for_delivery: 3 },
  });
  const { order, selection } = deliveryOrderFixture();
  selection.whatsappOptIn = true;
  await repo.recordOrder(order, selection);
  assert.equal((await repo.order(order.id)).whatsapp_opt_in, true);
  assert.equal((await repo.order(order.id)).notifications.length, 0);
  const paid = {
    ...order,
    status: "processed",
    status_detail: "accredited",
    total_paid_amount: "44.00",
    last_updated_date: new Date(Date.now() + 1000).toISOString(),
  };
  await repo.recordOrder(paid);
  await repo.recordOrder(paid, { ...selection, whatsappOptIn: false });
  const detail = await repo.order(order.id);
  assert.equal(detail.customer_phone, "11999999999");
  assert.equal(detail.customer_email, "entrega@example.invalid");
  assert.equal(detail.whatsapp_opt_in, true);
  assert.equal(detail.notifications.length, 2);
  await Promise.all([notifications.drain(), notifications.drain()]);
  assert.equal(calls.length, 2);
  assert.equal(
    (await repo.order(order.id)).notifications.filter(
      (n) => n.status === "accepted",
    ).length,
    2,
  );
  await repo.setPacked(order.id, "prod-1:300", true);
  await repo.setFulfillment(order.id, "ready");
  await repo.setFulfillment(order.id, "ready");
  await notifications.drain();
  assert.equal(calls.length, 4);
  await assert.rejects(repo.setFulfillment(order.id, "out_for_delivery"), {
    code: "ETA_REQUIRED",
  });
  await repo.saveOrderOperations(order.id, {
    staffNote: "Privado",
    courierName: "Teste",
    deliveryCostCents: 100,
    estimatedMinutes: 25,
  });
  assert.equal((await repo.order(order.id)).estimated_minutes, 25);
  await repo.setFulfillment(order.id, "out_for_delivery");
  await notifications.drain();
  assert.equal(calls.length, 6);
  const whatsapp = calls.filter((call) =>
    call.url.endsWith("whatsapp/sendMessage"),
  );
  assert.equal(whatsapp.at(-1).body.params.previsao_minutos, 25);
  assert.equal(whatsapp.at(-1).body.senderNumber, "551151993525");
  assert.doesNotMatch(JSON.stringify(calls), /Privado|Rua de teste|Apto 2/);
  await repo.recordOrder(paid);
  await notifications.drain();
  assert.equal(calls.length, 6);
});

test("enabling messages never replays old purchases or invents WhatsApp consent", async () => {
  const { order, selection } = deliveryOrderFixture();
  const paid = {
    ...order,
    status: "processed",
    status_detail: "accredited",
    total_paid_amount: "44.00",
  };
  await repo.recordOrder(paid, selection);
  const notifications = createCustomerNotifications({
    repository: repo,
    env: {
      BREVO_API_KEY: "xkeysib-local-integration-fixture",
      BREVO_SENDER_EMAIL: "loja@example.invalid",
      BREVO_WHATSAPP_SENDER: "551151993525",
    },
    fetcher: async () => new Response("{}", { status: 201 }),
  });
  await notifications.saveSettings({
    revision: 0,
    emailEnabled: true,
    whatsappEnabled: true,
    whatsappTemplates: { paid: 1, ready: 2, out_for_delivery: 3 },
  });
  await repo.recordOrder(paid);
  assert.equal((await repo.order(order.id)).notifications.length, 0);
  await repo.setPacked(order.id, "prod-1:300", true);
  await repo.setFulfillment(order.id, "ready");
  const detail = await repo.order(order.id);
  assert.equal(detail.whatsapp_opt_in, false);
  assert.equal(detail.notifications.length, 1);
  assert.equal(detail.notifications[0].channel, "email");
  await assert.rejects(
    repo.saveOrderOperations(order.id, {
      staffNote: "",
      courierName: "",
      deliveryCostCents: null,
      estimatedMinutes: 241,
    }),
    { code: "INVALID_ETA" },
  );
  assert.equal((await repo.order(order.id)).estimated_minutes, null);
});

test("product guides persist separately from prices, reject stale edits and stay outside the catalog payload", async () => {
  const content = createProductContentService({ repository: repo }),
    p = (await repo.catalog(true)).find((p) => p.id === "prod-1");
  assert.equal((await content.get(p)).revision, 0);
  const value = { revision: 0, content: contentDefaults["prod-270"] };
  const saved = await content.save(p.id, value);
  assert.equal(saved.revision, 1);
  const another = createProductContentService({
    repository: new ShopRepository(pool, catalog, policy),
  });
  assert.equal(
    (await another.get(p)).content.recipe.title,
    saved.content.recipe.title,
  );
  await assert.rejects(content.save(p.id, value), { code: "CONTENT_CHANGED" });
  await assert.rejects(
    content.save(p.id, {
      revision: 1,
      content: { ...value.content, description: "<script>alert(1)</script>" },
    }),
    { code: "INVALID_CONTENT" },
  );
  const publicProduct = (await repo.catalog(false)).find((v) => v.id === p.id);
  assert.equal("recipe" in publicProduct, false);
  assert.equal("content" in publicProduct, false);
  assert.equal(
    (await repo.catalog(true)).find((v) => v.id === p.id).valor_unitario,
    119.99,
  );
});

test("reviews bind completed purchases, deduplicate retries, moderate without changing opinions and hide customer contacts", async () => {
  const { order, selection } = deliveryOrderFixture();
  const paid = {
    ...order,
    status: "processed",
    status_detail: "accredited",
    total_paid_amount: "44.00",
  };
  await repo.recordOrder(paid, selection);
  const config = {
    origin: "https://loja.example",
    secure: true,
    accessToken: "APP_USR-" + "fixture".repeat(8),
    environment: "production",
  };
  const now = Math.floor(Date.now() / 1000),
    key = deriveKey(config.accessToken, config.origin),
    jti = "real-review-session";
  const proof = {
    id: order.id,
    ref: order.external_reference,
    totalCents: 4400,
    expires: now + 3600,
  };
  const cookies = `__Host-mn-orders=${seal(key, "orders", { orders: [proof] }, now, 3600)}; __Host-mn-checkout=${seal(key, "session", { jti }, now, 3600)}`;
  const payments = createPaymentService({
    catalog,
    policy,
    config,
    repository: repo,
  });
  const service = createReviewService({
    repository: repo,
    payments,
    catalogProvider: () => repo.catalog(false),
  });
  const body = {
    orderId: order.id,
    productId: "prod-1",
    rating: 4,
    text: "Produto bem embalado e textura agradável.",
    publishConsent: true,
  };
  const request = (payload, headers = {}) =>
    new Request(config.origin + "/api/reviews", {
      method: payload ? "POST" : "GET",
      headers: {
        Origin: config.origin,
        Cookie: cookies,
        "Content-Type": "application/json",
        "X-CSRF-Token": mac(key, "csrf", jti),
        ...headers,
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  assert.equal((await service.submit(request(body))).status, 403);
  assert.deepEqual(
    (await (await service.eligibility(request())).json()).products,
    [],
  );
  await repo.setPacked(order.id, "prod-1:300", true);
  await repo.setFulfillment(order.id, "completed");
  assert.equal(
    (await service.submit(request(body, { "X-CSRF-Token": "wrong" }))).status,
    403,
  );
  assert.equal(
    (await service.submit(request(body, { Origin: "https://evil.example" })))
      .status,
    403,
  );
  assert.equal(
    (await service.submit(request(body, { Cookie: "" }))).status,
    403,
  );
  const eligible = await (await service.eligibility(request())).json();
  assert.equal(eligible.products.length, 1);
  assert.equal(eligible.products[0].reviewed, false);
  const attempts = await Promise.all([
    service.submit(request(body)),
    service.submit(request(body)),
  ]);
  assert.deepEqual(
    attempts.map((r) => r.status),
    [200, 200],
  );
  assert.equal((await service.list("prod-1")).count, 0);
  assert.equal(
    (await service.submit(request({ ...body, rating: 1 }))).status,
    409,
  );
  assert.equal(
    (await service.submit(request({ ...body, productId: "prod-2" }))).status,
    403,
  );
  const all = await service.adminList();
  assert.equal(all.reviews.length, 1);
  const review = all.reviews[0];
  assert.equal(review.author, "Cliente");
  assert.equal(review.published, false);
  await assert.rejects(
    service.moderate(review.id, {
      published: true,
      reply: "Obrigado!",
      rating: 5,
    }),
    { code: "INVALID_MODERATION" },
  );
  await service.moderate(review.id, {
    published: true,
    reply: "Obrigado por compartilhar sua experiência!",
  });
  const visible = await service.list("prod-1");
  assert.equal(visible.count, 1);
  assert.equal(visible.average, 4);
  assert.equal(visible.reviews[0].verified, true);
  assert.match(visible.reviews[0].reply, /Obrigado/);
  assert.doesNotMatch(
    JSON.stringify(visible),
    /entrega@example|11999999999|Rua de teste|ORD01MNDELIVERY|Cliente entrega/,
  );
  await service.moderate(review.id, { published: false, reply: "" });
  const hidden = await service.list("prod-1");
  assert.equal(hidden.count, 0);
  assert.equal(hidden.average, null);
  assert.equal((await service.adminList()).reviews[0].rating, 4);
  assert.equal((await service.adminList()).reviews[0].text, body.text);
  assert.equal(
    (await pool.execute("SELECT COUNT(*) n FROM mn_orders"))[0][0].n,
    1,
  );
});
