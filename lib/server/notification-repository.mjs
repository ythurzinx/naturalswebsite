import { createHash } from "node:crypto";
import { reject } from "./errors.mjs";

export const notificationDefaults = {
  revision: 0,
  emailEnabled: false,
  whatsappEnabled: false,
  whatsappTemplates: { paid: null, ready: null, out_for_delivery: null },
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const contactKey = (id) => `order-contact:${hash(id)}`;
export async function readSetting(connection, key) {
  const [rows] = await connection.execute(
    "SELECT value_json,version FROM mn_settings WHERE setting_key=?",
    [key],
  );
  return rows.length
    ? { ...JSON.parse(rows[0].value_json), revision: Number(rows[0].version) }
    : null;
}
export async function contactDetails(connection, id) {
  const value = await readSetting(connection, contactKey(id));
  return {
    whatsapp_opt_in: value?.whatsappOptIn === true,
    estimated_minutes: value?.estimatedMinutes ?? null,
  };
}
export async function recordContact(connection, id, selection, now) {
  // The first verified checkout owns consent. Webhook replays cannot replace it.
  await connection.execute(
    "INSERT IGNORE INTO mn_settings(setting_key,value_json,version,updated_at) VALUES(?,?,0,?)",
    [
      contactKey(id),
      JSON.stringify({
        whatsappOptIn: selection.whatsappOptIn === true,
        estimatedMinutes: null,
      }),
      now,
    ],
  );
}
export async function saveEta(connection, id, value, now) {
  if (value === undefined) return;
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 240))
    reject("INVALID_ETA", "Informe uma previsão de 1 a 240 minutos.");
  const contact = await contactDetails(connection, id);
  await connection.execute(
    "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES(?,?,0,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),version=version+1,updated_at=VALUES(updated_at)",
    [
      contactKey(id),
      JSON.stringify({
        whatsappOptIn: contact.whatsapp_opt_in,
        estimatedMinutes: value,
      }),
      now,
    ],
  );
}
export async function enqueueNotification(connection, id, event, now) {
  const settings = await readSetting(connection, "customer-notifications");
  if (!settings) return;
  const contact = await contactDetails(connection, id);
  for (const channel of ["email", "whatsapp"]) {
    if (
      !settings[`${channel}Enabled`] ||
      (channel === "whatsapp" && !contact.whatsapp_opt_in)
    )
      continue;
    const key = `notify-job:${hash(`${id}:${event}:${channel}`)}`;
    const job = {
      orderId: id,
      event,
      channel,
      status: "pending",
      attempts: 0,
      createdAt: now,
      nextAt: now,
      startedAt: null,
      expiresAt:
        now +
        (event === "out_for_delivery"
          ? Math.min(contact.estimated_minutes || 30, 60) * 60000
          : 86400000),
      estimatedMinutes: contact.estimated_minutes,
      settingsRevision: settings.revision,
      code: null,
    };
    // Dedupe survives restarts, webhooks, status polling and repeated staff clicks.
    await connection.execute(
      "INSERT IGNORE INTO mn_settings(setting_key,value_json,version,updated_at) VALUES(?,?,0,?)",
      [key, JSON.stringify(job), now],
    );
  }
}
export async function saveNotificationSettings(repository, value) {
  const connection = await repository.pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('customer-notifications','{}',0,?) ON DUPLICATE KEY UPDATE version=version",
      [Date.now()],
    );
    const [rows] = await connection.execute(
      "SELECT version FROM mn_settings WHERE setting_key='customer-notifications' FOR UPDATE",
    );
    if (Number(rows[0].version) !== value.revision)
      reject(
        "SETTINGS_CONFLICT",
        "As configurações mudaram. Atualize o painel.",
        409,
      );
    const { revision, ...settings } = value;
    await connection.execute(
      "UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key='customer-notifications'",
      [JSON.stringify(settings), Date.now()],
    );
    // An explicit choice in the panel always wins over automatic first setup.
    await connection.execute(
      "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('email-auto-setup-v1',?,0,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),version=version+1,updated_at=VALUES(updated_at)",
      [JSON.stringify({ initialized: true, source: "manual" }), Date.now()],
    );
    await repository.audit(
      "notifications.settings",
      "channels",
      {
        emailEnabled: value.emailEnabled,
        whatsappEnabled: value.whatsappEnabled,
      },
      connection,
    );
    await connection.commit();
    return { ...settings, revision: revision + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function initializeAutomaticEmail(repository) {
  const connection = await repository.pool.getConnection();
  try {
    await connection.beginTransaction();
    const { revision, ...defaults } = notificationDefaults;
    await connection.execute(
      "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('customer-notifications',?,0,?) ON DUPLICATE KEY UPDATE version=version",
      [JSON.stringify(defaults), Date.now()],
    );
    const [rows] = await connection.execute("SELECT value_json,version FROM mn_settings WHERE setting_key='customer-notifications' FOR UPDATE");
    const [markers] = await connection.execute("SELECT value_json FROM mn_settings WHERE setting_key='email-auto-setup-v1' FOR UPDATE");
    if (markers.length && JSON.parse(markers[0].value_json).initialized === true) {
      await connection.commit(); return false;
    }
    const settings = { ...defaults, ...JSON.parse(rows[0].value_json) }, version = Number(rows[0].version);
    if (!settings.emailEnabled) {
      await connection.execute(
        "UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key='customer-notifications'",
        [JSON.stringify({ ...settings, emailEnabled: true }), Date.now()],
      );
      // Only e-mail was enabled. Preserve already queued, unchanged WhatsApp
      // jobs; never create retroactive e-mail jobs for historical purchases.
      await connection.execute(
        "UPDATE mn_settings SET value_json=JSON_SET(value_json,'$.settingsRevision',?),version=version+1,updated_at=? WHERE setting_key LIKE 'notify-job:%' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.channel'))='whatsapp' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.status'))='pending' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.settingsRevision')) AS UNSIGNED)=?",
        [version + 1, Date.now(), version],
      );
      await repository.audit("notifications.email_auto_enable", "channels", { emailEnabled: true }, connection);
    }
    await connection.execute(
      "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('email-auto-setup-v1',?,0,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),version=version+1,updated_at=VALUES(updated_at)",
      [JSON.stringify({ initialized: true, source: "verified_sender" }), Date.now()],
    );
    await connection.commit(); return true;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function notificationJobs(pool, id = null) {
  const [rows] = await pool.execute(
    id
      ? "SELECT setting_key,value_json,version FROM mn_settings WHERE setting_key LIKE 'notify-job:%' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.orderId'))=? ORDER BY updated_at DESC LIMIT 6"
      : "SELECT setting_key,value_json,version FROM mn_settings WHERE setting_key LIKE 'notify-job:%' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.status')) IN ('pending','sending') ORDER BY updated_at ASC LIMIT 100",
    id ? [id] : [],
  );
  return rows.map((row) => ({
    key: row.setting_key,
    ...JSON.parse(row.value_json),
    revision: Number(row.version),
  }));
}
export async function updateNotificationJob(pool, job, patch, now) {
  const { key, revision, ...data } = job;
  const [result] = await pool.execute(
    "UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key=? AND version=?",
    [JSON.stringify({ ...data, ...patch }), now, key, revision],
  );
  return !!result.affectedRows;
}
