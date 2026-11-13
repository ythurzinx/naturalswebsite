import sharp from "sharp";
import { createAdminAuth } from "./admin-auth.mjs";
import { jsonResponse, readJson, safeFailure } from "./http-security.mjs";
import { reject } from "./errors.mjs";
import { orderIdPattern } from "./checkout-core.mjs";
import { validateMerchandising } from "./merchandising-validation.mjs";
const productId = /^(prod-\d+|custom-[a-f0-9-]{36})$/;
export function validateAvailability(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !["ids", "active"].includes(key)) ||
    typeof body.active !== "boolean" ||
    !Array.isArray(body.ids) ||
    body.ids.length < 1 ||
    body.ids.length > 50 ||
    new Set(body.ids).size !== body.ids.length ||
    body.ids.some((id) => typeof id !== "string" || !productId.test(id))
  )
    reject(
      "INVALID_SELECTION",
      "Selecione de 1 a 50 produtos diferentes e uma situação válida.",
    );
  return { ids: body.ids, active: body.active };
}
function text(value, min, max, multiline = false) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max &&
    !(
      multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/ : /[\x00-\x1f\x7f<>]/
    ).test(value)
  );
}
export function validateProduct(body, id) {
  if (
    !body ||
    Object.keys(body).some(
      (key) =>
        ![
          "name",
          "category",
          "weightLabel",
          "isBulk",
          "priceCents",
          "priceUnit",
          "costCents",
          "active",
          "imageSha",
        ].includes(key),
    ) ||
    !text(body.name, 2, 160) ||
    !text(body.category, 2, 100) ||
    !text(body.weightLabel, 1, 80) ||
    typeof body.isBulk !== "boolean" ||
    typeof body.active !== "boolean" ||
    (body.priceUnit !== undefined &&
      body.priceUnit !== (body.isBulk ? "100g" : "unit")) ||
    !Number.isInteger(body.priceCents) ||
    body.priceCents < 1 ||
    body.priceCents > 100000000 ||
    (body.costCents !== null &&
      (!Number.isInteger(body.costCents) ||
        body.costCents < 0 ||
        body.costCents > 100000000)) ||
    (body.imageSha !== null && !/^[a-f0-9]{64}$/.test(body.imageSha)) ||
    (id && !productId.test(id))
  )
    reject(
      "INVALID_PRODUCT",
      "Confira nome, preço, custo e os dados do produto.",
    );
  // Keep existing database amounts per kg; the editor explicitly submits 100 g.
  const factor = body.priceUnit === "100g" ? 10 : 1;
  const priceCents = body.priceCents * factor;
  const costCents = body.costCents === null ? null : body.costCents * factor;
  if (priceCents > 100000000 || (costCents !== null && costCents > 100000000))
    reject("INVALID_PRODUCT", "Preço ou custo acima do limite permitido.");
  const { priceUnit, ...value } = body;
  return {
    ...value,
    priceCents,
    costCents,
    id: id || undefined,
    name: body.name.trim(),
    category: body.category.trim(),
    weightLabel: body.isBulk
      ? "A granel · preço por 100 g"
      : body.weightLabel.trim(),
  };
}
export async function normalizeProductImage(bytes) {
  try {
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      reject("IMAGE_SIZE", "A foto deve ter até 5 MB.", 413);
    const image = sharp(bytes, { limitInputPixels: 20000000, animated: false }),
      meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format) ||
      !meta.width ||
      !meta.height ||
      (meta.pages || 1) > 1
    )
      reject("INVALID_IMAGE", "Use uma foto JPEG, PNG ou WebP sem animação.");
    const data = await image
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    if (data.length > 1024 * 1024)
      reject(
        "IMAGE_SIZE",
        "A foto é muito grande. Escolha uma imagem menor.",
        413,
      );
    return data;
  } catch (error) {
    if (error.status) throw error;
    reject(
      "INVALID_IMAGE",
      "Não foi possível ler esta foto. Use JPEG, PNG ou WebP.",
    );
  }
}
async function imageBody(request) {
  const type = request.headers.get("content-type")?.split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(type))
    reject("INVALID_IMAGE", "Use JPEG, PNG ou WebP.", 415);
  const size = Number(request.headers.get("content-length") || 0);
  if (size > 5 * 1024 * 1024)
    reject("IMAGE_SIZE", "A foto deve ter até 5 MB.", 413);
  if (!request.body) reject("INVALID_IMAGE", "Escolha uma foto.");
  const reader = request.body.getReader(),
    chunks = [];
  let count = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > 5 * 1024 * 1024) {
        await reader.cancel();
        reject("IMAGE_SIZE", "A foto deve ter até 5 MB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function createAdminService({
  config,
  repository,
  payments,
  notifications = /** @type {ReturnType<typeof import("./customer-notifications.mjs").createCustomerNotifications>|null} */ (
    null
  ),
  productContent = /** @type {ReturnType<typeof import("./product-content.mjs").createProductContentService>|null} */ (
    null
  ),
  reviews = /** @type {ReturnType<typeof import("./review-service.mjs").createReviewService>|null} */ (
    null
  ),
  paymentTesting = /** @type {ReturnType<typeof import("./payment-testing.mjs").createPaymentTesting>|null} */ (
    null
  ),
  shipping = /** @type {ReturnType<typeof import("./shipping-service.mjs").createShippingService>|null} */ (
    null
  ),
}) {
  const auth = createAdminAuth({ config, repository });
  async function handle(request, path) {
    try {
      const route = path.join("/"),
        method = request.method;
      if (route === "session" && method === "GET")
        return await auth.session(request);
      if (route === "login" && method === "POST")
        return await auth.login(request);
      if (route === "logout" && method === "POST")
        return await auth.logout(request);
      await auth.authenticate(request, method !== "GET");
      if (route.startsWith("payments/test/")) {
        if (!paymentTesting)
          reject(
            "PAYMENT_TEST_UNAVAILABLE",
            "Configure o token de teste na hospedagem.",
            503,
          );
        if (route === "payments/test/session" && method === "GET")
          return paymentTesting.session(request);
        if (route === "payments/test/status" && method === "GET")
          return paymentTesting.status(request);
        if (
          ["payments/test/checkout", "payments/test/reset"].includes(route) &&
          method === "POST"
        ) {
          if (!(await repository.loginLimit("admin-payment-test", 12, 600000)))
            reject("RATE_LIMIT", "Aguarde antes de iniciar outro teste.", 429);
          const body = await readJson(request);
          if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).some(
              (k) => !["csrfToken", "input"].includes(k),
            ) ||
            typeof body.csrfToken !== "string" ||
            body.csrfToken.length > 100
          )
            reject("INVALID_PAYMENT_TEST", "Atualize a sessão de homologação.");
          const headers = new Headers(request.headers);
          headers.set("x-csrf-token", body.csrfToken);
          headers.delete("content-length");
          const testRequest = new Request(request.url, {
            method: "POST",
            headers,
            body: JSON.stringify(body.input || {}),
          });
          return route.endsWith("/reset")
            ? paymentTesting.resetSession(testRequest)
            : paymentTesting.checkout(testRequest);
        }
      }
      if (route === "notifications" && method === "GET")
        return jsonResponse(
          (await notifications?.getSettings()) || { unavailable: true },
        );
      if (route === "notifications" && method === "PUT") {
        if (!notifications)
          reject(
            "NOTIFICATIONS_UNAVAILABLE",
            "Configure o serviço de mensagens.",
            503,
          );
        if (
          !(await repository.loginLimit(
            "admin-notifications-config",
            10,
            60000,
          ))
        )
          reject("RATE_LIMIT", "Aguarde antes de alterar as mensagens.", 429);
        return jsonResponse(
          await notifications.saveSettings(await readJson(request)),
        );
      }
      if (route === "notifications/drain" && method === "POST") {
        if (!(await repository.loginLimit("notification-worker", 1, 10000)))
          return jsonResponse({ processed: 0 });
        return jsonResponse(
          (await notifications?.drain({ limit: 2 })) || { processed: 0 },
        );
      }
      if (route === "reviews" && method === "GET") {
        if (!reviews)
          reject("REVIEWS_UNAVAILABLE", "Avaliações indisponíveis.", 503);
        return jsonResponse(await reviews.adminList());
      }
      if (path[0] === "reviews" && path.length === 2 && method === "PUT") {
        if (!reviews)
          reject("REVIEWS_UNAVAILABLE", "Avaliações indisponíveis.", 503);
        if (!(await repository.loginLimit("admin-reviews", 30, 60000)))
          reject(
            "RATE_LIMIT",
            "Aguarde antes de alterar outras avaliações.",
            429,
          );
        return jsonResponse(
          await reviews.moderate(path[1], await readJson(request, 5000)),
        );
      }
      if (route === "content-products" && method === "GET")
        return jsonResponse({
          products: [
            ...(await repository.catalog(true)),
            ...(await repository.catalog(false)).filter((p) => p.combo),
          ],
        });
      if (
        path[0] === "product-content" &&
        path.length === 2 &&
        /^(?:prod-\d+|custom-[a-f0-9-]{36}|combo-[a-z0-9-]{1,48})$/.test(
          path[1],
        )
      ) {
        if (!productContent)
          reject("CONTENT_UNAVAILABLE", "Conteúdo indisponível.", 503);
        if (method === "GET") {
          const product = [
            ...(await repository.catalog(true)),
            ...(await repository.catalog(false)).filter((p) => p.combo),
          ].find((p) => p.id === path[1]);
          if (!product) reject("NOT_FOUND", "Produto não encontrado.", 404);
          return jsonResponse(await productContent.get(product));
        }
        if (method === "PUT") {
          if (
            !(await repository.loginLimit("admin-product-content", 30, 60000))
          )
            reject(
              "RATE_LIMIT",
              "Aguarde antes de alterar mais conteúdos.",
              429,
            );
          return jsonResponse(
            await productContent.save(path[1], await readJson(request, 24000)),
          );
        }
      }
      if (route === "payments/diagnostics" && method === "GET")
        return jsonResponse(await payments.diagnostics());
      if (route === "merchandising" && method === "GET")
        return jsonResponse({
          settings: await repository.merchandisingSettings(),
          products: await repository.catalog(true),
        });
      if (route === "merchandising" && method === "PUT") {
        if (!(await repository.loginLimit("admin-merchandising", 20, 60000)))
          reject(
            "RATE_LIMIT",
            "Aguarde antes de alterar as ofertas novamente.",
            429,
          );
        const value = validateMerchandising(
          await readJson(request, 60000),
          await repository.catalog(true),
        );
        return jsonResponse({
          settings: await repository.saveMerchandising(value),
        });
      }
      if (route === "shipping" && method === "GET")
        return jsonResponse(await shipping.publicSettings());
      if (route === "shipping/estimate" && method === "POST") {
        if (
          !(await repository.loginLimit("admin-shipping-estimate", 30, 60000))
        )
          reject("RATE_LIMIT", "Aguarde antes de consultar outro CEP.", 429);
        return jsonResponse(await shipping.estimate(await readJson(request)));
      }
      if (route === "shipping" && method === "PUT") {
        if (!(await repository.loginLimit("admin-shipping", 15, 60000)))
          reject(
            "RATE_LIMIT",
            "Aguarde antes de alterar o frete novamente.",
            429,
          );
        return jsonResponse(
          await shipping.saveSettings(await readJson(request)),
        );
      }
      if (route === "order-alerts" && method === "GET") {
        const raw = new URL(request.url).searchParams.get("after");
        const after = raw === null ? null : Number(raw);
        if (
          raw !== null &&
          (!/^\d{1,15}$/.test(raw) || !Number.isSafeInteger(after))
        )
          reject("INVALID_CURSOR", "Atualize a fila de pedidos.");
        return jsonResponse(await repository.orderAlerts(after));
      }
      if (route === "dashboard" && method === "GET") {
        const days = Number(
          new URL(request.url).searchParams.get("days") || 30,
        );
        if (![7, 30, 90].includes(days))
          reject("INVALID_PERIOD", "Selecione 7, 30 ou 90 dias.");
        return jsonResponse(await repository.dashboard(days));
      }
      if (route === "products" && method === "GET")
        return jsonResponse({ products: await repository.catalog(true) });
      if (route === "products" && method === "POST") {
        const value = validateProduct(await readJson(request), null);
        return jsonResponse({ id: await repository.saveProduct(value) }, 201);
      }
      if (route === "products/availability" && method === "PATCH") {
        const selection = validateAvailability(await readJson(request));
        if (!(await repository.loginLimit("admin-availability", 20, 60000)))
          reject(
            "RATE_LIMIT",
            "Aguarde antes de fazer outra alteração em lote.",
            429,
          );
        await repository.setAvailability(selection.ids, selection.active);
        return jsonResponse({ updated: selection.ids.length });
      }
      if (path[0] === "products" && path.length === 2 && method === "PUT") {
        const value = validateProduct(await readJson(request), path[1]);
        return jsonResponse({ id: await repository.saveProduct(value) });
      }
      if (route === "images" && method === "POST") {
        if (!(await repository.loginLimit("admin-images", 100, 3600000)))
          reject(
            "RATE_LIMIT",
            "Limite de envio de fotos atingido. Aguarde.",
            429,
          );
        const data = await normalizeProductImage(await imageBody(request)),
          id = await repository.saveImage(data);
        return jsonResponse(
          { imageSha: id, url: `/api/product-images/${id}` },
          201,
        );
      }
      if (route === "orders" && method === "GET")
        return jsonResponse({ orders: await repository.orders() });
      if (route === "orders/sync" && method === "POST") {
        if (!(await repository.loginLimit("admin-order-sync", 15, 60000)))
          reject(
            "RATE_LIMIT",
            "Aguarde antes de consultar os pagamentos novamente.",
            429,
          );
        const ids = (await repository.pending()).slice(0, 3),
          results = await Promise.all(
            ids.map(async (id) => {
              try {
                await payments.reconcile(id);
                return { id, ok: true };
              } catch {
                return { id, ok: false };
              }
            }),
          );
        return jsonResponse({ results });
      }
      if (
        path[0] === "orders" &&
        path.length === 3 &&
        path[2] === "sync" &&
        method === "POST"
      ) {
        if (!orderIdPattern.test(path[1]))
          reject("INVALID_ORDER", "Pedido inválido.");
        if (!(await repository.order(path[1])))
          reject("NOT_FOUND", "Pedido não encontrado.", 404);
        if (!(await repository.loginLimit("admin-order-sync", 15, 60000)))
          reject(
            "RATE_LIMIT",
            "Aguarde antes de consultar os pagamentos novamente.",
            429,
          );
        await payments.reconcile(path[1]);
        await repository.audit("order.sync", path[1]);
        return jsonResponse({ order: await repository.order(path[1]) });
      }
      if (path[0] === "orders" && path.length === 2 && method === "GET") {
        if (!orderIdPattern.test(path[1]))
          reject("INVALID_ORDER", "Pedido inválido.");
        const order = await repository.order(path[1]);
        if (!order) reject("NOT_FOUND", "Pedido não encontrado.", 404);
        return jsonResponse({ order });
      }
      if (
        path[0] === "orders" &&
        path[2] === "fulfillment" &&
        path.length === 3 &&
        method === "PUT"
      ) {
        const body = await readJson(request);
        if (
          !body ||
          Object.keys(body).some((k) => k !== "state") ||
          ![
            "new",
            "packing",
            "ready",
            "out_for_delivery",
            "completed",
          ].includes(body.state) ||
          !orderIdPattern.test(path[1])
        )
          reject("INVALID_STATE", "Etapa do pedido inválida.");
        await payments.reconcile(path[1]);
        const order = await repository.order(path[1]);
        if (!order || order.state !== "paid")
          reject(
            "PAYMENT_REQUIRED",
            "Confirme o crédito do pedido antes de iniciar a separação.",
            409,
          );
        await repository.setFulfillment(path[1], body.state);
        await notifications?.drain({ limit: 2 }).catch(() => {});
        return jsonResponse({ ok: true });
      }
      if (
        path[0] === "orders" &&
        path.length === 3 &&
        path[2] === "packing" &&
        method === "PUT"
      ) {
        const body = await readJson(request);
        if (
          !orderIdPattern.test(path[1]) ||
          !body ||
          Object.keys(body).some((k) => !["lineKey", "packed"].includes(k)) ||
          typeof body.lineKey !== "string" ||
          body.lineKey.length > 100 ||
          typeof body.packed !== "boolean"
        )
          reject("INVALID_PACKING", "Revise o item da conferência.");
        await repository.setPacked(path[1], body.lineKey, body.packed);
        return jsonResponse({ order: await repository.order(path[1]) });
      }
      if (
        path[0] === "orders" &&
        path.length === 3 &&
        path[2] === "operations" &&
        method === "PUT"
      ) {
        const body = await readJson(request);
        if (
          !orderIdPattern.test(path[1]) ||
          !body ||
          Object.keys(body).some(
            (k) =>
              ![
                "staffNote",
                "courierName",
                "deliveryCostCents",
                "estimatedMinutes",
              ].includes(k),
          ) ||
          !text(body.staffNote, 0, 1000, true) ||
          !text(body.courierName, 0, 80) ||
          (body.estimatedMinutes !== undefined &&
            body.estimatedMinutes !== null &&
            (!Number.isInteger(body.estimatedMinutes) ||
              body.estimatedMinutes < 1 ||
              body.estimatedMinutes > 240)) ||
          (body.deliveryCostCents !== null &&
            (!Number.isSafeInteger(body.deliveryCostCents) ||
              body.deliveryCostCents < 0 ||
              body.deliveryCostCents > 1000000))
        )
          reject(
            "INVALID_OPERATIONS",
            "Revise a observação, o entregador e o custo real da entrega.",
          );
        await repository.saveOrderOperations(path[1], {
          staffNote: body.staffNote.trim(),
          courierName: body.courierName.trim(),
          deliveryCostCents: body.deliveryCostCents,
          estimatedMinutes: body.estimatedMinutes,
        });
        return jsonResponse({ order: await repository.order(path[1]) });
      }
      if (route === "costs/backfill" && method === "POST") {
        await repository.backfillCosts();
        return jsonResponse({ ok: true });
      }
      if (route === "expenses" && method === "GET")
        return jsonResponse({ expenses: await repository.expenses() });
      if (route === "expenses" && method === "POST") {
        const body = await readJson(request);
        if (
          !body ||
          Object.keys(body).some(
            (k) => !["id", "description", "amountCents", "date"].includes(k),
          ) ||
          (body.id !== undefined && !/^[a-f0-9-]{36}$/.test(body.id)) ||
          !text(body.description, 2, 180) ||
          !Number.isInteger(body.amountCents) ||
          body.amountCents < 1 ||
          body.amountCents > 100000000 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
        )
          reject(
            "INVALID_EXPENSE",
            "Confira descrição, data e valor da despesa.",
          );
        const incurredAt = Date.parse(`${body.date}T03:00:00Z`);
        if (
          !Number.isFinite(incurredAt) ||
          new Date(incurredAt).toISOString().slice(0, 10) !== body.date ||
          body.date >
            new Date().toLocaleDateString("en-CA", {
              timeZone: "America/Sao_Paulo",
            })
        )
          reject("INVALID_DATE", "Use uma data válida.");
        return jsonResponse(
          {
            id: await repository.saveExpense({
              id: body.id,
              description: body.description.trim(),
              amountCents: body.amountCents,
              incurredAt,
            }),
          },
          201,
        );
      }
      if (
        path[0] === "expenses" &&
        path.length === 2 &&
        method === "DELETE" &&
        /^[a-f0-9-]{36}$/.test(path[1])
      ) {
        await repository.deleteExpense(path[1]);
        return jsonResponse({ ok: true });
      }
      if (route === "audit" && method === "GET") {
        const [rows] = await repository.pool.execute(
          "SELECT id,event,entity_id,created_at FROM mn_audit ORDER BY id DESC LIMIT 80",
        );
        return jsonResponse({ events: rows });
      }
      reject("NOT_FOUND", "Recurso não encontrado.", 404);
    } catch (error) {
      return safeFailure(error);
    }
  }
  return { handle };
}
