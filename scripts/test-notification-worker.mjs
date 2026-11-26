// Exercises Next instrumentation, sender lookup and the durable outbox with
// no admin browser, real provider request or production database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { createDatabase } from "../lib/server/database.mjs";
import { ShopRepository } from "../lib/server/shop-repository.mjs";
import { migrate } from "../lib/server/schema.mjs";
const target = new URL(process.env.INTEGRATION_DATABASE_URL || "http://invalid");
assert.ok(target.protocol === "mysql:" && ["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname === "/mn_test",
  "Worker test requires the disposable loopback mn_test database");
const pool = createDatabase({ DATABASE_URL: target.href });
const repository = new ShopRepository(pool, [], { disabledProductIds: [] });
const directory = await mkdtemp(join(tmpdir(), "mn-worker-fixture-")), log = join(directory, "calls.jsonl");
let child, diagnostics = "";
try {
  await migrate(pool);
  await pool.execute("DELETE FROM mn_settings WHERE setting_key LIKE 'notify-job:%' OR setting_key IN ('customer-notifications','email-auto-setup-v1')");
  await pool.execute("INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('customer-notifications',?,0,?)",
    [JSON.stringify({ emailEnabled: true, whatsappEnabled: false, whatsappTemplates: { paid: null, ready: null, out_for_delivery: null } }), Date.now()]);
  const id = "ORD01WORKER" + Date.now();
  await repository.recordOrder({ id, external_reference: "worker-fixture", total_amount: "12.00", total_paid_amount: "12.00",
    status: "processed", status_detail: "accredited", created_date: new Date().toISOString(),
    items: [{ external_code: "prod-1:100", title: "Aveia · 100 g", quantity: 1, unit_price: "12.00" }],
    payer: { first_name: "Cliente teste", email: "worker@example.invalid" } });
  assert.equal((await repository.order(id)).notifications[0].status, "pending");
  const temporary = createServer(); temporary.listen(0, "127.0.0.1"); await once(temporary, "listening");
  const port = temporary.address().port; await new Promise((resolve) => temporary.close(resolve));
  const fixture = new URL("../tests/fixtures/brevo-fetch.mjs", import.meta.url).href;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: new URL("..", import.meta.url), stdio: ["ignore", "pipe", "pipe"], env: {
      ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", MN_BUILD_PHASE: "", NEXT_PHASE: "",
      NODE_OPTIONS: `--import=${fixture}`, MN_WORKER_FIXTURE_LOG: log,
      APP_URL: "https://loja.example", NEXT_PUBLIC_SITE_URL: "https://loja.example", DATABASE_URL: target.href,
      BREVO_API_KEY: "xkeysib-worker-fixture-not-a-real-key", BREVO_SENDER_EMAIL: "", BREVO_WHATSAPP_SENDER: "",
      MERCADOPAGO_ACCESS_TOKEN: "", MERCADOPAGO_TEST_ACCESS_TOKEN: "", MERCADOPAGO_WEBHOOK_SECRET: "",
      ADMIN_PASSWORD_HASH: "", ADMIN_SESSION_SECRET: "", ADMIN_TOTP_SECRET: "", NOTIFICATION_WORKER_SECRET: "",
    },
  });
  child.stdout.on("data", (d) => { diagnostics = (diagnostics + d).slice(-2000); });
  child.stderr.on("data", (d) => { diagnostics = (diagnostics + d).slice(-2000); });
  let sent = false;
  for (let n = 0; n < 80; n++) {
    if (child.exitCode !== null) throw Error("Worker process exited: " + diagnostics);
    if ((await repository.order(id)).notifications[0]?.status === "accepted") { sent = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.ok(sent, "Production worker did not send without an admin request: " + diagnostics);
  const calls = (await readFile(log, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(calls.filter((c) => c.kind === "sender").length, 1);
  const emails = calls.filter((c) => c.kind === "email"); assert.equal(emails.length, 1);
  assert.match(emails[0].body.subject, /Pagamento confirmado/);
  assert.equal(emails[0].body.sender.email, "pedidos@loja.example");
  assert.match(emails[0].body.textContent, /Total pago: R\$\s12,00/);
  assert.doesNotMatch(JSON.stringify(emails[0].body), /cost_cents|cost_unit_cents|cost_total_cents/);
  console.log("Worker Node.js: remetente verificado e e-mail processado sem abrir o painel; provedor totalmente simulado.");
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, 3000))]);
  }
  await pool.end(); await rm(directory, { recursive: true, force: true });
}
