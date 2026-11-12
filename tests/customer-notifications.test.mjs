import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCustomerNotifications,
  notificationMessage,
  notificationConfiguration,
  validateNotificationSettings,
} from "../lib/server/customer-notifications.mjs";
const baseSettings = {
  revision: 2,
  emailEnabled: true,
  whatsappEnabled: true,
  whatsappTemplates: { paid: 11, ready: 12, out_for_delivery: 13 },
};
const env = {
  BREVO_API_KEY: "xkeysib-fixture-never-a-real-key",
  BREVO_SENDER_EMAIL: "loja@example.invalid",
  BREVO_WHATSAPP_SENDER: "551151993525",
};
const time = 1794517747000;
function fixture({
  channel = "whatsapp",
  event = "out_for_delivery",
  optIn = true,
  state = "paid",
  fulfillment = "out_for_delivery",
} = {}) {
  const rows = new Map();
  rows.set("customer-notifications", {
    version: 2,
    value: { ...baseSettings },
  });
  const key = "notify-job:" + "a".repeat(64);
  rows.set(key, {
    version: 0,
    value: {
      orderId: "ORD01MNTEST",
      event,
      channel,
      status: "pending",
      attempts: 0,
      nextAt: time,
      createdAt: time,
      expiresAt: time + 1800000,
      settingsRevision: 2,
      estimatedMinutes: 30,
    },
  });
  const order = {
    id: "ORD01MNTEST",
    state,
    customer_name: "Maria <teste>",
    customer_email: "cliente@example.invalid",
    customer_phone: "11999999999",
    whatsapp_opt_in: optIn,
    fulfillment_mode: "delivery",
    fulfillment_status: fulfillment,
  };
  const pool = {
    async execute(sql, args = []) {
      if (sql.startsWith("UPDATE mn_settings")) {
        const [json, , rowKey, version] = args,
          row = rows.get(rowKey);
        if (!row || row.version !== version) return [{ affectedRows: 0 }];
        rows.set(rowKey, { version: version + 1, value: JSON.parse(json) });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("WHERE setting_key=?")) {
        const row = rows.get(args[0]);
        return [
          row
            ? [{ value_json: JSON.stringify(row.value), version: row.version }]
            : [],
        ];
      }
      if (sql.includes("GROUP BY status"))
        return [[{ status: rows.get(key).value.status, n: 1 }]];
      return [
        [...rows]
          .filter(
            ([k, row]) =>
              k.startsWith("notify-job:") &&
              ["pending", "sending"].includes(row.value.status),
          )
          .map(([setting_key, row]) => ({
            setting_key,
            value_json: JSON.stringify(row.value),
            version: row.version,
          })),
      ];
    },
  };
  return {
    repository: {
      pool,
      async order() {
        return { ...order };
      },
    },
    rows,
    key,
    order,
  };
}
test("notification settings reject unknown fields, malformed IDs and absent templates", () => {
  assert.equal(validateNotificationSettings(baseSettings), baseSettings);
  for (const bad of [
    { ...baseSettings, token: "secret" },
    { ...baseSettings, revision: -1 },
    {
      ...baseSettings,
      whatsappTemplates: { paid: null, ready: 12, out_for_delivery: 13 },
    },
    {
      ...baseSettings,
      whatsappTemplates: {
        paid: 1,
        ready: 2,
        out_for_delivery: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  ])
    assert.throws(() => validateNotificationSettings(bad), {
      code: "INVALID_NOTIFICATIONS",
    });
  assert.equal(
    notificationConfiguration({
      ...env,
      BREVO_SENDER_EMAIL: "evil\r\nBcc:x@y.com",
    }).senderEmail,
    "",
  );
});
test("email templates escape customer text and never include address, private note or costs", () => {
  const message = notificationMessage(
    {
      id: "ORD01MNTEST",
      customer_name: "<img src=x onerror=alert(1)>",
      address: { street: "secret address" },
      staff_note: "secret internal note",
      cost_total_cents: 999,
    },
    "paid",
  );
  assert.match(message.htmlContent, /&lt;img/);
  assert.doesNotMatch(
    message.htmlContent,
    /<img|secret address|secret internal note|999/,
  );
});
test("only one concurrent worker sends a job, to a fixed Brevo endpoint with per-message ETA", async () => {
  const f = fixture(),
    calls = [];
  const service = createCustomerNotifications({
    ...f,
    env,
    now: () => time,
    fetcher: async (url, options) => {
      calls.push({ url, options });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response("{}", { status: 201 });
    },
  });
  await Promise.all([service.drain(), service.drain()]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.brevo.com/v3/whatsapp/sendMessage");
  assert.equal(calls[0].options.redirect, "error");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.templateId, 13);
  assert.deepEqual(body.contactNumbers, ["5511999999999"]);
  assert.equal(body.params.previsao_minutos, 30);
  assert.equal(f.rows.get(f.key).value.status, "accepted");
  const result = await service.getSettings();
  assert.doesNotMatch(JSON.stringify(result), /xkeysib|cliente@|5511999/);
});
test("WhatsApp refusal, refund, obsolete stage and disabled revision never send", async () => {
  for (const options of [
    { optIn: false },
    { state: "refunded" },
    { fulfillment: "completed" },
  ]) {
    const f = fixture(options);
    let calls = 0;
    await createCustomerNotifications({
      ...f,
      env,
      now: () => time,
      fetcher: async () => {
        calls++;
        return new Response("{}");
      },
    }).drain();
    assert.equal(calls, 0);
    assert.equal(f.rows.get(f.key).value.status, "cancelled");
  }
  const f = fixture();
  f.rows.get("customer-notifications").version++;
  await createCustomerNotifications({
    ...f,
    env,
    now: () => time,
    fetcher: async () => {
      throw Error("must not send");
    },
  }).drain();
  assert.equal(f.rows.get(f.key).value.status, "cancelled");
});
test("network uncertainty is retained without duplicate retry or sensitive error details", async () => {
  const f = fixture();
  let calls = 0;
  const service = createCustomerNotifications({
    ...f,
    env,
    now: () => time,
    fetcher: async () => {
      calls++;
      throw Error(
        "private provider response xkeysib-secret customer@example.com",
      );
    },
  });
  await service.drain();
  await service.drain();
  assert.equal(calls, 1);
  assert.equal(f.rows.get(f.key).value.status, "unknown");
  assert.doesNotMatch(
    JSON.stringify(f.rows.get(f.key)),
    /private provider|xkeysib|customer@/,
  );
});
test("provider rate limits back off and email uses stable idempotency key", async () => {
  const f = fixture({ channel: "email", event: "paid" });
  let calls = 0,
    current = time;
  const service = createCustomerNotifications({
    ...f,
    env,
    now: () => current,
    fetcher: async (_, options) => {
      calls++;
      assert.equal(
        JSON.parse(options.body).headers.idempotencyKey,
        "a".repeat(64),
      );
      return new Response("{}", { status: 429 });
    },
  });
  await service.drain();
  await service.drain();
  assert.equal(calls, 1);
  current += 60001;
  await service.drain();
  assert.equal(calls, 2);
  current += 120001;
  await service.drain();
  assert.equal(calls, 3);
  assert.equal(f.rows.get(f.key).value.status, "failed");
});
test("an interrupted worker is marked uncertain and never blindly sent again", async () => {
  const f = fixture();
  Object.assign(f.rows.get(f.key).value, {
    status: "sending",
    startedAt: time - 180000,
    attempts: 1,
  });
  await createCustomerNotifications({
    ...f,
    env,
    now: () => time,
    fetcher: async () => {
      throw Error("must not send");
    },
  }).drain();
  assert.equal(f.rows.get(f.key).value.status, "unknown");
  assert.equal(f.rows.get(f.key).value.code, "WORKER_INTERRUPTED");
});
