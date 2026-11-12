// Production HTTP checks only. No browser, live credentials or charges are used.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import assert from "node:assert/strict";
const temporary = createServer();
temporary.listen(0, "127.0.0.1");
await once(temporary, "listening");
const port = temporary.address().port;
await new Promise((resolve) => temporary.close(resolve));
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    String(port),
  ],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://loja.example",
      MERCADOPAGO_ACCESS_TOKEN: "",
      MERCADOPAGO_WEBHOOK_SECRET: "",
      DATABASE_URL: "",
      ADMIN_PASSWORD_HASH: "",
      ADMIN_SESSION_SECRET: "",
      ADMIN_TOTP_SECRET: "",
      BREVO_API_KEY: "",
      BREVO_SENDER_EMAIL: "",
      NOTIFICATION_WORKER_SECRET: "worker-fixture-" + "a".repeat(32),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let diagnostics = "";
server.stdout.on("data", (d) => (diagnostics = (diagnostics + d).slice(-4000)));
server.stderr.on("data", (d) => (diagnostics = (diagnostics + d).slice(-4000)));
const origin = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw Error("Test server exited: " + diagnostics);
    try {
      const r = await fetch(origin + "/api/health");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.ok(ready, "Production HTTP server did not become ready");
  const canonical = await fetch(origin + "/checkout?source=menu", {
    redirect: "manual",
    headers: { "x-forwarded-host": "www.loja.example" },
  });
  assert.equal(canonical.status, 308);
  assert.equal(
    canonical.headers.get("location"),
    "https://loja.example/checkout?source=menu",
  );
  assert.ok(canonical.headers.get("cache-control").includes("no-store"));
  const aliasApi = await fetch(origin + "/api/checkout/session", {
    redirect: "manual",
    headers: { "x-forwarded-host": "www.loja.example" },
  });
  assert.equal(
    aliasApi.status,
    200,
    "API requests keep their own security validation",
  );
  assert.equal(aliasApi.headers.get("location"), null);
  let previousNonce = "";
  for (let i = 0; i < 2; i++) {
    const response = await fetch(origin + "/", {
      headers: {
        "x-nonce": "attacker-value",
        "Content-Security-Policy": "script-src * 'unsafe-inline'",
      },
    });
    assert.equal(response.status, 200);
    const policy = response.headers.get("content-security-policy") || "",
      nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(
      nonce && nonce !== previousNonce && nonce !== "attacker-value",
      "A fresh server-generated nonce is required",
    );
    previousNonce = nonce;
    const html = await response.text();
    assert.ok(
      html.includes("por 100 g"),
      "Bulk prices must be shown per 100 g",
    );
    assert.ok(
      html.includes("100 em 100 g"),
      "Bulk weight increments must be clear",
    );
    const scripts = Array.from(
      html.matchAll(/<script\b[^>]*>/g),
      (match) => match[0],
    );
    assert.ok(scripts.length > 0);
    for (const script of scripts)
      assert.ok(
        script.includes(`nonce="${nonce}"`),
        "Executable scripts must carry the response nonce",
      );
    assert.ok(
      !policy
        .split(";")
        .find((p) => p.trim().startsWith("script-src "))
        .includes("unsafe-inline"),
    );
    assert.ok(response.headers.get("cache-control")?.includes("no-store"));
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
  for (const path of [
    "/produtos",
    "/carrinho",
    "/checkout",
    "/pagamento/retorno",
    "/privacidade",
    "/termos",
    "/contato",
    "/sobre",
    "/blog",
    "/favoritos",
  ]) {
    const r = await fetch(origin + path);
    assert.equal(r.status, 200, path);
    assert.ok((await r.text()).includes("<h1"), path + " needs a main heading");
  }
  assert.equal((await fetch(origin + "/admin")).status, 200);
  const admin = await fetch(origin + "/api/admin/products");
  assert.equal(admin.status, 503);
  assert.equal((await admin.json()).code, "ADMIN_UNAVAILABLE");
  assert.equal((await fetch(origin + "/api/admin/notifications")).status, 503);
  assert.equal(
    (await fetch(origin + "/api/notifications/worker", { method: "POST" }))
      .status,
    401,
  );
  assert.equal(
    (
      await fetch(origin + "/api/notifications/worker", {
        method: "POST",
        headers: { Authorization: "Bearer invalid-secret" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(origin + "/api/notifications/worker", {
        method: "POST",
        headers: { Authorization: "Bearer worker-fixture-" + "a".repeat(32) },
      })
    ).status,
    503,
  );
  const session = await fetch(origin + "/api/checkout/session");
  assert.equal((await session.json()).available, false);
  assert.ok(session.headers.get("cache-control").includes("no-store"));
  const checkout = await fetch(origin + "/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://loja.example",
    },
    body: "{}",
  });
  assert.equal(checkout.status, 503);
  assert.equal((await checkout.json()).code, "PAYMENT_NOT_CONFIGURED");
  const shipping = await fetch(origin + "/api/shipping/settings");
  assert.equal(shipping.status, 200);
  assert.equal((await shipping.json()).enabled, false);
  assert.ok(shipping.headers.get("cache-control").includes("no-store"));
  assert.equal((await fetch(origin + "/api/shipping/session")).status, 503);
  assert.equal(
    (
      await fetch(origin + "/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    503,
  );
  assert.equal((await fetch(origin + "/api/admin/order-alerts")).status, 503);
  assert.equal(
    (await fetch(origin + "/api/mercadopago/webhook", { method: "POST" }))
      .status,
    404,
  );
  console.log(
    "HTTP de produção: páginas, admin bloqueado, CSP/nonces, cookies/cache e APIs sem credenciais verificados.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  const force = setTimeout(() => server.kill("SIGKILL"), 3000);
  await once(server, "close");
  clearTimeout(force);
}
