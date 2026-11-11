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
import { referencePriceCents } from "../lib/pricing.mjs";
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
    ["PUT", ["orders", "ORD01MNDELIVERYDBFIXTURE", "packing"]],
    ["PUT", ["orders", "ORD01MNDELIVERYDBFIXTURE", "operations"]],
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
  const path = ["orders", "ORD01MNDELIVERYDBFIXTURE", "operations"];
  for (const headers of [
    { Origin: config.origin },
    { Origin: "https://evil.example", "X-CSRF-Token": csrf },
  ]) {
    const response = await service.handle(
      new Request(config.origin + "/api/admin/" + path.join("/"), {
        method: "PUT",
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
