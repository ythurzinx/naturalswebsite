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
    peso_produto: "kg",
    isGranel: true,
    valor_unitario: 119.99,
  },
  {
    id: "prod-2",
    nome_produto: "Pasta",
    peso_produto: "500 g",
    isGranel: false,
    valor_unitario: 19.99,
  },
  {
    id: "prod-3",
    nome_produto: "Outro",
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
      { id: "prod-1", quantity: 3, weight: 250 },
      { id: "prod-2", quantity: 2 },
    ],
    name: "Maria Fixture",
    email: "maria@example.com",
    fulfillment: "pickup",
    expectedTotalCents: 12998,
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
  assert.equal(stats.grossCents, 12998);
  assert.equal(stats.costsCents, 8000);
  assert.equal(stats.feesCents, 399);
  assert.equal(stats.profitCents, 4599);
  await repo.saveExpense({
    description: "Embalagens",
    amountCents: 500,
    incurredAt: Date.now(),
  });
  assert.equal((await repo.dashboard()).profitCents, 4099);
  await repo.saveProduct({ ...product("prod-1"), costCents: 50000 });
  assert.equal(
    (await repo.order(order.id)).cost_total_cents,
    8000,
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
  assert.equal(latest.paid_cents, 12998);
  assert.equal(latest.refunded_cents, 12998);
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
  for (const method of ["GET", "POST"]) {
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
  const service = createAdminService({
    config,
    repository: repo,
    payments: {},
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
});
