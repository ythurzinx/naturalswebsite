import { reject } from "./errors.mjs";
import {
  notificationDefaults,
  readSetting,
  saveNotificationSettings,
  notificationJobs,
  updateNotificationJob,
} from "./notification-repository.mjs";

const events = ["paid", "ready", "out_for_delivery"];
const emailPattern =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
export function notificationConfiguration(env = {}) {
  const apiKey = env.BREVO_API_KEY || "";
  const senderEmail = env.BREVO_SENDER_EMAIL || "";
  const senderNumber = env.BREVO_WHATSAPP_SENDER || "";
  return {
    apiKey: /^[A-Za-z0-9_.-]{16,512}$/.test(apiKey) ? apiKey : "",
    senderEmail:
      senderEmail.length <= 180 && emailPattern.test(senderEmail)
        ? senderEmail
        : "",
    senderNumber: /^55[1-9]{2}\d{8,9}$/.test(senderNumber) ? senderNumber : "",
  };
}
export function validateNotificationSettings(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (k) =>
        ![
          "revision",
          "emailEnabled",
          "whatsappEnabled",
          "whatsappTemplates",
        ].includes(k),
    ) ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    typeof body.emailEnabled !== "boolean" ||
    typeof body.whatsappEnabled !== "boolean" ||
    !body.whatsappTemplates ||
    typeof body.whatsappTemplates !== "object" ||
    Array.isArray(body.whatsappTemplates) ||
    Object.keys(body.whatsappTemplates).length !== 3 ||
    Object.keys(body.whatsappTemplates).some((k) => !events.includes(k)) ||
    events.some(
      (k) =>
        body.whatsappTemplates[k] !== null &&
        (!Number.isSafeInteger(body.whatsappTemplates[k]) ||
          body.whatsappTemplates[k] < 1),
    ) ||
    (body.whatsappEnabled && events.some((k) => !body.whatsappTemplates[k]))
  )
    reject(
      "INVALID_NOTIFICATIONS",
      "Confira os canais e os três IDs dos modelos aprovados no WhatsApp.",
    );
  return body;
}
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function notificationMessage(order, event, estimatedMinutes = null) {
  const id = String(order.id).slice(0, 80);
  const name = String(order.customer_name || "Cliente").slice(0, 160);
  const texts = {
    paid: "Seu pagamento foi aprovado! A loja recebeu o pedido e vai iniciar a separação.",
    ready:
      order.fulfillment_mode === "delivery"
        ? "Seu pedido foi separado e embalado pela loja. Estamos preparando a saída para entrega."
        : "Seu pedido foi separado e está pronto para retirada na loja.",
    out_for_delivery: `Seu pedido saiu para entrega. Previsão de chegada: aproximadamente ${estimatedMinutes} minutos a partir da saída. O trânsito pode alterar esse prazo.`,
  };
  const titles = {
    paid: "Pagamento aprovado",
    ready: "Pedido separado",
    out_for_delivery: "Pedido saiu para entrega",
  };
  return {
    subject: `${titles[event]} · Mundo Natural`,
    textContent: `Olá, ${name}!\n\n${texts[event]}\nPedido: ${id}\n\nMundo Natural · (11) 5199-3525\nAtualização referente à sua compra.`,
    htmlContent: `<html lang="pt-BR"><body style="margin:0;background:#f8f7f2;font-family:Arial,sans-serif;color:#294b37"><main style="max-width:560px;margin:24px auto;padding:32px;background:white;border-radius:16px"><p>MUNDO NATURAL · TABOÃO DA SERRA</p><h1 style="font-size:26px">${titles[event]}</h1><p>Olá, ${escapeHtml(name)}!</p><p>${escapeHtml(texts[event])}</p><p>Pedido: <strong>${escapeHtml(id)}</strong></p><hr><p>Dúvidas? (11) 5199-3525</p><small>Atualização referente à sua compra. Sem conteúdo promocional.</small></main></body></html>`,
  };
}
export function createCustomerNotifications({
  repository,
  env = {},
  fetcher = fetch,
  now = Date.now,
}) {
  const config = notificationConfiguration(env);
  const readiness = {
    apiKey: !!config.apiKey,
    email: !!(config.apiKey && config.senderEmail),
    whatsapp: !!(config.apiKey && config.senderNumber),
  };
  async function settings() {
    return repository
      ? (await readSetting(repository.pool, "customer-notifications")) ||
          structuredClone(notificationDefaults)
      : structuredClone(notificationDefaults);
  }
  async function getSettings() {
    const value = await settings();
    let queue = { pending: 0, issues: 0 };
    if (repository) {
      const [rows] = await repository.pool.execute(
        "SELECT JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.status')) status, COUNT(*) n FROM mn_settings WHERE setting_key LIKE 'notify-job:%' GROUP BY status",
      );
      for (const row of rows) {
        if (["pending", "sending"].includes(row.status))
          queue.pending += Number(row.n);
        if (["failed", "unknown"].includes(row.status))
          queue.issues += Number(row.n);
      }
    }
    return { settings: value, readiness, queue };
  }
  async function saveSettings(body) {
    const value = validateNotificationSettings(body);
    if (!repository)
      reject("DATABASE_REQUIRED", "Configure o banco de dados.", 503);
    if (
      (value.emailEnabled && !readiness.email) ||
      (value.whatsappEnabled && !readiness.whatsapp)
    )
      reject(
        "NOTIFICATION_SETUP_REQUIRED",
        "Configure as credenciais e os remetentes na Hostinger antes de ativar os canais.",
        409,
      );
    await saveNotificationSettings(repository, value);
    return getSettings();
  }
  async function send(job, order, value) {
    const message = notificationMessage(order, job.event, job.estimatedMinutes);
    const phone = String(order.customer_phone || "").replace(/\D/g, "");
    const internationalPhone =
      phone.startsWith("55") && phone.length >= 12 ? phone : `55${phone}`;
    if (
      job.channel === "email" &&
      (!emailPattern.test(order.customer_email) ||
        order.customer_email.length > 180)
    )
      return { status: "failed", code: "INVALID_RECIPIENT" };
    if (
      job.channel === "whatsapp" &&
      (!order.whatsapp_opt_in ||
        !/^55[1-9]{2}\d{8,9}$/.test(internationalPhone))
    )
      return { status: "cancelled", code: "NO_WHATSAPP_CONSENT" };
    const body =
      job.channel === "email"
        ? {
            sender: { name: "Mundo Natural", email: config.senderEmail },
            to: [
              {
                email: order.customer_email,
                name: order.customer_name || "Cliente",
              },
            ],
            ...message,
            headers: { idempotencyKey: job.key.slice("notify-job:".length) },
            tags: ["atualizacao-pedido"],
          }
        : {
            templateId: value.whatsappTemplates[job.event],
            senderNumber: config.senderNumber,
            contactNumbers: [internationalPhone],
            params: {
              nome: order.customer_name || "Cliente",
              pedido: order.id,
              previsao_minutos: job.estimatedMinutes ?? "",
              telefone_loja: "(11) 5199-3525",
              recebimento:
                order.fulfillment_mode === "delivery"
                  ? "entrega"
                  : "retirada na loja",
            },
          };
    try {
      const response = await fetcher(
        `https://api.brevo.com/v3/${job.channel === "email" ? "smtp/email" : "whatsapp/sendMessage"}`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          headers: {
            "api-key": config.apiKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      // Never retain provider responses: they can contain recipients or credentials.
      await response.body?.cancel();
      if (response.ok) return { status: "accepted", code: null };
      if (response.status === 429 && job.attempts < 3)
        return {
          status: "pending",
          code: "RATE_LIMIT",
          nextAt: now() + 60000 * job.attempts,
        };
      if (response.status >= 500)
        return { status: "unknown", code: "PROVIDER_UNCERTAIN" };
      return {
        status: "failed",
        code: [401, 403].includes(response.status)
          ? "PROVIDER_AUTH"
          : response.status === 429
            ? "RATE_LIMIT"
            : "PROVIDER_REJECTED",
      };
    } catch {
      // A timeout may follow successful delivery. No blind retry that could double-send.
      return { status: "unknown", code: "SEND_UNCERTAIN" };
    }
  }
  async function drain({ limit = 4 } = {}) {
    if (!repository) return { processed: 0 };
    const value = await settings();
    const jobs = await notificationJobs(repository.pool);
    let processed = 0;
    for (const job of jobs) {
      if (processed >= Math.min(4, Math.max(1, limit))) break;
      if (job.status === "sending") {
        if (job.startedAt < now() - 120000)
          await updateNotificationJob(
            repository.pool,
            job,
            { status: "unknown", code: "WORKER_INTERRUPTED" },
            now(),
          );
        continue;
      }
      if (job.nextAt > now()) continue;
      if (
        job.expiresAt < now() ||
        job.settingsRevision !== value.revision ||
        !value[`${job.channel}Enabled`]
      ) {
        await updateNotificationJob(
          repository.pool,
          job,
          { status: "cancelled", code: "EXPIRED_OR_DISABLED" },
          now(),
        );
        continue;
      }
      if (!readiness[job.channel]) continue;
      const claimed = {
        ...job,
        status: "sending",
        startedAt: now(),
        attempts: job.attempts + 1,
      };
      if (
        !(await updateNotificationJob(
          repository.pool,
          job,
          {
            status: "sending",
            startedAt: claimed.startedAt,
            attempts: claimed.attempts,
          },
          now(),
        ))
      )
        continue;
      claimed.revision++;
      processed++;
      let result;
      try {
        const order = await repository.order(job.orderId);
        const stale =
          !order ||
          order.state !== "paid" ||
          (job.event === "ready" && order.fulfillment_status !== "ready") ||
          (job.event === "out_for_delivery" &&
            (order.fulfillment_mode !== "delivery" ||
              order.fulfillment_status !== "out_for_delivery" ||
              !job.estimatedMinutes));
        result = stale
          ? { status: "cancelled", code: "ORDER_CHANGED" }
          : await send(claimed, order, value);
      } catch {
        result = { status: "unknown", code: "WORKER_INTERRUPTED" };
      }
      await updateNotificationJob(repository.pool, claimed, result, now());
    }
    return { processed };
  }
  return { getSettings, saveSettings, drain };
}
