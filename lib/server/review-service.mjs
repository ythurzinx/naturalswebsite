import { createHash } from "node:crypto";
import { reject } from "./errors.mjs";
import {
  jsonResponse,
  readJson,
  safeFailure,
  RateLimiter,
} from "./http-security.mjs";
import { orderIdPattern } from "./checkout-core.mjs";
const productId = /^(?:prod-\d+|custom-[a-f0-9-]{36}|combo-[a-z0-9-]{1,48})$/;
const reviewId = (order, product) =>
  createHash("sha256").update(`${order}:${product}`).digest("hex");
const clean = (s, min, max) =>
  typeof s === "string" &&
  s.trim().length >= min &&
  s.length <= max &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(s);
const safe =
  (fn) =>
  async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      return safeFailure(e);
    }
  };
const publicReview = (r) => ({
  id: r.id,
  productId: r.productId,
  productName: r.productName,
  rating: r.rating,
  text: r.text,
  author: r.author,
  createdAt: r.createdAt,
  reply: r.reply || "",
  verified: true,
});
export function validateReview(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (k) =>
        !["orderId", "productId", "rating", "text", "publishConsent"].includes(
          k,
        ),
    ) ||
    !orderIdPattern.test(body.orderId) ||
    !productId.test(body.productId) ||
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5 ||
    !clean(body.text, 10, 600) ||
    body.publishConsent !== true
  )
    reject(
      "INVALID_REVIEW",
      "Escolha de 1 a 5 estrelas, escreva de 10 a 600 caracteres e autorize a publicação do primeiro nome e da avaliação.",
    );
  return { ...body, text: body.text.trim() };
}
export function createReviewService({
  repository,
  payments,
  catalogProvider,
  now = Date.now,
}) {
  const limiter = new RateLimiter();
  async function list(product = /** @type {string|null} */ (null)) {
    limiter.take("reviews-public", 300, 60, Math.floor(now() / 1000));
    if (product && !productId.test(product))
      reject("INVALID_PRODUCT", "Produto inválido.");
    if (!repository)
      return { available: false, average: null, count: 0, reviews: [] };
    const active = (await catalogProvider()).map((p) => p.id);
    if (product && !active.includes(product))
      reject("NOT_FOUND", "Produto não encontrado.", 404);
    if (!active.length)
      return { available: true, average: null, count: 0, reviews: [] };
    const ids = product ? [product] : active;
    const where = `setting_key LIKE 'product-review:%' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.published'))='true' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.productId')) IN (${ids.map(() => "?").join(",")})`;
    const [summary] = await repository.pool.execute(
      `SELECT COUNT(*) n, SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.rating')) AS UNSIGNED)) stars FROM mn_settings WHERE ${where}`,
      ids,
    );
    const [rows] = await repository.pool.execute(
      `SELECT value_json FROM mn_settings WHERE ${where} ORDER BY CAST(JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.createdAt')) AS UNSIGNED) DESC LIMIT 20`,
      ids,
    );
    const count = Number(summary[0].n);
    return {
      available: true,
      count,
      average: count
        ? Math.round((Number(summary[0].stars) * 10) / count) / 10
        : null,
      reviews: rows.map((r) => publicReview(JSON.parse(r.value_json))),
    };
  }
  async function ownedCompleted(request, write = false) {
    const owned = payments.reviewOrders(request, write);
    if (!repository)
      reject(
        "REVIEWS_UNAVAILABLE",
        "Avaliações temporariamente indisponíveis.",
        503,
      );
    const orders = [];
    for (const proof of owned) {
      const order = await repository.order(proof.id);
      if (
        order &&
        order.reference === proof.ref &&
        order.total_cents === proof.totalCents &&
        order.paid_cents > 0 &&
        order.fulfillment_status === "completed"
      )
        orders.push(order);
    }
    return orders;
  }
  const eligibility = safe(async (request) => {
    const orders = await ownedCompleted(request),
      products = [];
    const active = new Map((await catalogProvider()).map((p) => [p.id, p]));
    for (const order of orders)
      for (const item of order.items || []) {
        const purchased = [
          item.product_id,
          String(item.line_key || "").split("|").length > 1
            ? String(item.line_key).split("|")[0]
            : null,
        ].filter(Boolean);
        for (const candidate of purchased) {
          if (
            !active.has(candidate) ||
            !productId.test(candidate) ||
            products.some(
              (p) => p.orderId === order.id && p.productId === candidate,
            )
          )
            continue;
          const id = reviewId(order.id, candidate);
          const [rows] = await repository.pool.execute(
            "SELECT value_json FROM mn_settings WHERE setting_key=?",
            [`product-review:${id}`],
          );
          const entry = active.get(candidate);
          products.push({
            orderId: order.id,
            productId: candidate,
            title: entry?.nome_produto || item.title,
            reviewed: !!rows.length,
          });
        }
      }
    return jsonResponse({ products });
  });
  const submit = safe(async (request) => {
    const orders = await ownedCompleted(request, true),
      body = validateReview(await readJson(request, 5000));
    const order = orders.find((o) => o.id === body.orderId);
    if (
      !order ||
      !(order.items || []).some(
        (i) =>
          i.product_id === body.productId ||
          (body.productId.startsWith("combo-") &&
            String(i.line_key || "").startsWith(body.productId + "|")),
      )
    )
      reject(
        "PURCHASE_REQUIRED",
        "Avalie um produto de um pedido concluído acessível neste navegador.",
        403,
      );
    const product = (await catalogProvider()).find(
      (p) => p.id === body.productId,
    );
    if (!product) reject("NOT_FOUND", "Produto não encontrado.", 404);
    const id = reviewId(order.id, body.productId);
    if (!(await repository.loginLimit(`review:${id}`, 5, 600000)))
      reject("RATE_LIMIT", "Aguarde antes de enviar outra avaliação.", 429);
    const first =
      String(order.customer_name || "Cliente")
        .trim()
        .split(/\s+/)[0]
        .replace(/[^\p{L}\p{M}'-]/gu, "")
        .slice(0, 30) || "Cliente";
    const value = {
      id,
      orderId: order.id,
      productId: product.id,
      productName: product.nome_produto,
      rating: body.rating,
      text: body.text,
      author: first,
      createdAt: now(),
      publishConsent: true,
      published: false,
      reply: "",
    };
    const [result] = await repository.pool.execute(
      "INSERT IGNORE INTO mn_settings(setting_key,value_json,version,updated_at) VALUES(?,?,0,?)",
      [`product-review:${id}`, JSON.stringify(value), now()],
    );
    if (!result.affectedRows) {
      const [rows] = await repository.pool.execute(
        "SELECT value_json FROM mn_settings WHERE setting_key=?",
        [`product-review:${id}`],
      );
      const prior = JSON.parse(rows[0].value_json);
      if (prior.rating !== body.rating || prior.text !== body.text)
        reject(
          "ALREADY_REVIEWED",
          "Você já enviou uma avaliação deste produto neste pedido.",
          409,
        );
    }
    return jsonResponse({
      received: true,
      published: false,
      message:
        "Obrigado! Sua avaliação foi recebida e aguarda análise antes da publicação.",
    });
  });
  async function adminList() {
    if (!repository)
      reject("REVIEWS_UNAVAILABLE", "Configure o banco de dados.", 503);
    const [rows] = await repository.pool.execute(
      "SELECT value_json FROM mn_settings WHERE setting_key LIKE 'product-review:%' ORDER BY updated_at DESC LIMIT 200",
    );
    return { reviews: rows.map((r) => JSON.parse(r.value_json)) };
  }
  async function moderate(id, body) {
    if (
      !/^[a-f0-9]{64}$/.test(id) ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => !["published", "reply"].includes(k)) ||
      typeof body.published !== "boolean" ||
      !clean(body.reply, 0, 600)
    )
      reject("INVALID_MODERATION", "Revise a situação e a resposta da loja.");
    const conn = await repository.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        "SELECT value_json FROM mn_settings WHERE setting_key=? FOR UPDATE",
        [`product-review:${id}`],
      );
      if (!rows.length) reject("NOT_FOUND", "Avaliação não encontrada.", 404);
      const value = JSON.parse(rows[0].value_json);
      await conn.execute(
        "UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key=?",
        [
          JSON.stringify({
            ...value,
            published: body.published,
            reply: body.reply.trim(),
          }),
          now(),
          `product-review:${id}`,
        ],
      );
      await repository.audit(
        "review.moderation",
        id,
        { published: body.published, hasReply: !!body.reply.trim() },
        conn,
      );
      await conn.commit();
      return { ok: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  return { list, eligibility, submit, adminList, moderate };
}
