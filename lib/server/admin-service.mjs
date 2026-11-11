import sharp from "sharp";
import { createAdminAuth } from "./admin-auth.mjs";
import { jsonResponse, readJson, safeFailure } from "./http-security.mjs";
import { reject } from "./errors.mjs";
const productId = /^(prod-\d+|custom-[a-f0-9-]{36})$/;
function text(value, min, max) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max &&
    !/[\x00-\x1f\x7f<>]/.test(value)
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
  return {
    ...body,
    id: id || undefined,
    name: body.name.trim(),
    category: body.category.trim(),
    weightLabel: body.weightLabel.trim(),
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
export function createAdminService({ config, repository, payments }) {
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
      if (path[0] === "orders" && path.length === 2 && method === "GET") {
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
          !["new", "ready", "completed"].includes(body.state)
        )
          reject("INVALID_STATE", "Situação de retirada inválida.");
        await payments.reconcile(path[1]);
        const order = await repository.order(path[1]);
        if (!order || order.state !== "paid")
          reject(
            "PAYMENT_REQUIRED",
            "Confirme o crédito do pedido antes de liberar a retirada.",
            409,
          );
        await repository.setFulfillment(path[1], body.state);
        return jsonResponse({ ok: true });
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
