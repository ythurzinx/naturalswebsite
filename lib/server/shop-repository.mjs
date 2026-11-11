import { randomUUID, createHash } from "node:crypto";
import { reject } from "./errors.mjs";
import { cents, paymentState } from "./checkout-core.mjs";

export class ShopRepository {
  constructor(pool, baseCatalog, policy) {
    this.pool = pool;
    this.base = baseCatalog;
    this.policy = policy;
  }
  async productRows() {
    const [rows] = await this.pool.execute("SELECT * FROM mn_products");
    return rows;
  }
  async catalog(admin = false) {
    const rows = await this.productRows(),
      overrides = new Map(rows.map((row) => [row.id, row]));
    const merged = new Map(
      this.base.map((product) => [
        product.id,
        {
          ...product,
          active: !this.policy.disabledProductIds.includes(product.id),
          priceCents: Math.round(product.valor_unitario * 100),
          costCents: null,
          imageSha: null,
        },
      ]),
    );
    for (const row of rows) {
      const base = merged.get(row.id) || {};
      merged.set(row.id, {
        ...base,
        id: row.id,
        nome_produto: row.name,
        categoria: row.category,
        peso_produto: row.is_bulk
          ? "A granel · preço por 100 g"
          : row.weight_label,
        isGranel: !!row.is_bulk,
        valor_unitario: row.sale_cents / 100,
        quantidade: 0,
        total_unitario: 0,
        estoque_minimo: 0,
        status_estoque: "Sob consulta",
        active:
          !!row.active && !this.policy.disabledProductIds.includes(row.id),
        priceCents: row.sale_cents,
        costCents: row.cost_cents,
        imageSha: row.image_sha,
        imagem: row.image_sha
          ? `/api/product-images/${row.image_sha}`
          : undefined,
      });
    }
    const result = [...merged.values()];
    if (admin)
      return result.sort((a, b) =>
        a.nome_produto.localeCompare(b.nome_produto, "pt-BR"),
      );
    return result
      .filter((p) => p.active)
      .map(
        ({ active, priceCents, costCents, imageSha, ...publicProduct }) =>
          publicProduct,
      );
  }
  async audit(event, id, details = {}, connection = this.pool) {
    await connection.execute(
      "INSERT INTO mn_audit(event,entity_id,details,created_at) VALUES(?,?,?,?)",
      [event, String(id), JSON.stringify(details), Date.now()],
    );
  }
  async saveProduct(value) {
    const id = value.id || `custom-${randomUUID()}`;
    if (value.imageSha) {
      const [rows] = await this.pool.execute(
        "SELECT id FROM mn_images WHERE id=?",
        [value.imageSha],
      );
      if (!rows.length)
        reject("IMAGE_NOT_FOUND", "Envie uma foto válida antes de salvar.");
    }
    const original = (await this.catalog(true)).find((p) => p.id === id);
    await this.pool.execute(
      "INSERT INTO mn_products(id,name,category,weight_label,is_bulk,sale_cents,cost_cents,active,image_sha,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),weight_label=VALUES(weight_label),is_bulk=VALUES(is_bulk),sale_cents=VALUES(sale_cents),cost_cents=VALUES(cost_cents),active=VALUES(active),image_sha=VALUES(image_sha),updated_at=VALUES(updated_at)",
      [
        id,
        value.name,
        value.category,
        value.weightLabel,
        value.isBulk ? 1 : 0,
        value.priceCents,
        value.costCents,
        value.active ? 1 : 0,
        value.imageSha,
        Date.now(),
      ],
    );
    await this.audit("product.save", id, {
      previousPriceCents: original?.priceCents ?? null,
      priceCents: value.priceCents,
      active: value.active,
    });
    return id;
  }
  async saveImage(data) {
    const id = createHash("sha256").update(data).digest("hex");
    await this.pool.execute(
      "INSERT IGNORE INTO mn_images(id,data,byte_length,created_at) VALUES(?,?,?,?)",
      [id, data, data.length, Date.now()],
    );
    await this.audit("image.upload", id, { bytes: data.length });
    return id;
  }
  async setAvailability(ids, active) {
    const catalog = new Map(
      (await this.catalog(true)).map((product) => [product.id, product]),
    );
    if (ids.some((id) => !catalog.has(id)))
      reject(
        "PRODUCT_NOT_FOUND",
        "Um produto não existe. Atualize a seleção.",
        409,
      );
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const id of ids) {
        const product = catalog.get(id);
        await connection.execute(
          "INSERT INTO mn_products(id,name,category,weight_label,is_bulk,sale_cents,cost_cents,active,image_sha,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE active=VALUES(active),updated_at=VALUES(updated_at)",
          [
            id,
            product.nome_produto,
            product.categoria,
            product.peso_produto,
            product.isGranel ? 1 : 0,
            product.priceCents,
            product.costCents,
            active ? 1 : 0,
            product.imageSha,
            Date.now(),
          ],
        );
      }
      await this.audit(
        "products.availability",
        "batch",
        { ids, active },
        connection,
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async image(id) {
    const [rows] = await this.pool.execute(
      "SELECT data,byte_length FROM mn_images WHERE id=?",
      [id],
    );
    return rows[0] || null;
  }
  async recordOrder(order, selection) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.recordOrderOnce(order, selection);
      } catch (error) {
        if (
          attempt >= 2 ||
          ![
            "ER_DUP_ENTRY",
            "ER_LOCK_DEADLOCK",
            "ER_LOCK_WAIT_TIMEOUT",
          ].includes(error.code)
        )
          throw error;
      }
    }
  }
  async recordOrderOnce(order, selection) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute(
        "SELECT * FROM mn_orders WHERE id=? FOR UPDATE",
        [order.id],
      );
      const now = Date.now(),
        updated =
          Date.parse(order.last_updated_date || order.created_date) || now;
      const paid = cents(order.total_paid_amount) || 0,
        total = cents(order.total_amount),
        state = paymentState(order);
      if (!existing.length) {
        const source =
          selection?.items ||
          (order.items || []).map((item) => ({
            key: item.external_code,
            title: item.title,
            quantity: item.quantity,
            unitCents: cents(item.unit_price),
          }));
        if (
          !source.length ||
          source.length > 50 ||
          source.some(
            (item) =>
              typeof item.key !== "string" ||
              !Number.isInteger(item.quantity) ||
              item.quantity < 1 ||
              !Number.isInteger(item.unitCents) ||
              item.unitCents < 1,
          ) ||
          source.reduce(
            (sum, item) => sum + item.unitCents * item.quantity,
            0,
          ) !== total
        )
          reject(
            "INVALID_ORDER_ITEMS",
            "Não foi possível registrar os itens do pedido.",
            502,
          );
        const enriched = [];
        for (const item of source) {
          const separator = item.key.lastIndexOf(":"),
            productId = item.key.slice(0, separator),
            weight = Number(item.key.slice(separator + 1));
          const [cost] = await connection.execute(
            "SELECT cost_cents FROM mn_products WHERE id=?",
            [productId],
          );
          const baseCost = cost[0]?.cost_cents;
          enriched.push({
            ...item,
            productId,
            weight,
            cost:
              baseCost == null
                ? null
                : Math.round(baseCost * (weight ? weight / 1000 : 1)),
          });
        }
        const cost = enriched.some((item) => item.cost === null)
          ? null
          : enriched.reduce((sum, item) => sum + item.cost * item.quantity, 0);
        const refund =
          order.status === "refunded"
            ? paid
            : order.status_detail === "partially_refunded"
              ? null
              : 0;
        await connection.execute(
          "INSERT INTO mn_orders(id,reference,total_cents,paid_cents,refunded_cents,cost_total_cents,state,provider_status,customer_name,customer_email,provider_updated_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            order.id,
            order.external_reference,
            total,
            paid,
            refund,
            cost,
            state,
            order.status,
            selection?.name ||
              String(order.payer?.first_name || "").slice(0, 160),
            selection?.email || String(order.payer?.email || "").slice(0, 180),
            updated,
            Date.parse(order.created_date) || now,
            now,
          ],
        );
        for (const item of enriched)
          await connection.execute(
            "INSERT INTO mn_order_items(order_id,line_key,product_id,title,quantity,weight_grams,unit_cents,cost_unit_cents) VALUES(?,?,?,?,?,?,?,?)",
            [
              order.id,
              item.key,
              item.productId,
              String(item.title).slice(0, 220),
              item.quantity,
              item.weight,
              item.unitCents,
              item.cost,
            ],
          );
      } else if (updated >= existing[0].provider_updated_at) {
        if (
          existing[0].reference !== order.external_reference ||
          existing[0].total_cents !== total
        )
          reject("ORDER_RECORD_MISMATCH", "Pedido inconsistente.", 502);
        const historicPaid = Math.max(existing[0].paid_cents, paid),
          refund =
            order.status === "refunded"
              ? historicPaid
              : order.status_detail === "partially_refunded"
                ? null
                : (existing[0].refunded_cents ?? 0);
        await connection.execute(
          "UPDATE mn_orders SET paid_cents=?,refunded_cents=?,state=?,provider_status=?,provider_updated_at=?,updated_at=? WHERE id=?",
          [historicPaid, refund, state, order.status, updated, now, order.id],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async settlement(id, { feeCents, refundedCents, providerUpdatedAt }) {
    await this.pool.execute(
      "UPDATE mn_orders SET fee_cents=?,refunded_cents=?,updated_at=? WHERE id=? AND provider_updated_at=?",
      [feeCents, refundedCents, Date.now(), id, providerUpdatedAt],
    );
  }
  async orders() {
    const [rows] = await this.pool.execute(
      "SELECT * FROM mn_orders ORDER BY created_at DESC LIMIT 200",
    );
    return rows;
  }
  async order(id) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM mn_orders WHERE id=?",
      [id],
    );
    if (!rows.length) return null;
    const [items] = await this.pool.execute(
      "SELECT * FROM mn_order_items WHERE order_id=? ORDER BY line_key",
      [id],
    );
    return { ...rows[0], items };
  }
  async setFulfillment(id, state) {
    await this.pool.execute(
      "UPDATE mn_orders SET fulfillment_status=?,updated_at=? WHERE id=?",
      [state, Date.now(), id],
    );
    await this.audit("order.fulfillment", id, { state });
  }
  async pending() {
    const [rows] = await this.pool.execute(
      "SELECT id FROM mn_orders WHERE (state='pending' AND created_at>=?) OR (paid_cents>0 AND (fee_cents IS NULL OR refunded_cents IS NULL)) ORDER BY updated_at ASC LIMIT 10",
      [Date.now() - 7 * 86400000],
    );
    return rows.map((row) => row.id);
  }
  async expenses() {
    const [rows] = await this.pool.execute(
      "SELECT * FROM mn_expenses WHERE deleted_at IS NULL ORDER BY incurred_at DESC LIMIT 200",
    );
    return rows;
  }
  async saveExpense(value) {
    const id = value.id || randomUUID();
    const [result] = await this.pool.execute(
      "INSERT IGNORE INTO mn_expenses(id,description,amount_cents,incurred_at,created_at) VALUES(?,?,?,?,?)",
      [id, value.description, value.amountCents, value.incurredAt, Date.now()],
    );
    if (result.affectedRows)
      await this.audit("expense.create", id, {
        amountCents: value.amountCents,
      });
    else {
      const [existing] = await this.pool.execute(
        "SELECT description,amount_cents,incurred_at FROM mn_expenses WHERE id=?",
        [id],
      );
      if (
        !existing[0] ||
        existing[0].description !== value.description ||
        existing[0].amount_cents !== value.amountCents ||
        existing[0].incurred_at !== value.incurredAt
      )
        reject(
          "EXPENSE_CONFLICT",
          "Esta tentativa já foi usada com outros dados. Atualize o painel.",
          409,
        );
    }
    return id;
  }
  async deleteExpense(id) {
    await this.pool.execute(
      "UPDATE mn_expenses SET deleted_at=? WHERE id=? AND deleted_at IS NULL",
      [Date.now(), id],
    );
    await this.audit("expense.delete", id);
  }
  async backfillCosts() {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE mn_order_items i JOIN mn_products p ON p.id=i.product_id SET i.cost_unit_cents=ROUND(p.cost_cents*IF(i.weight_grams>0,i.weight_grams/1000,1)) WHERE i.cost_unit_cents IS NULL AND p.cost_cents IS NOT NULL",
      );
      await connection.query(
        "UPDATE mn_orders o JOIN (SELECT order_id, SUM(cost_unit_cents*quantity) total, SUM(cost_unit_cents IS NULL) missing FROM mn_order_items GROUP BY order_id) costs ON costs.order_id=o.id SET o.cost_total_cents=costs.total WHERE o.cost_total_cents IS NULL AND costs.missing=0",
      );
      await this.audit(
        "costs.backfill",
        "orders",
        { source: "merchant_current_costs" },
        connection,
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async dashboard(days = 30) {
    const from = Date.now() - days * 86400000;
    const [totals] = await this.pool.execute(
      "SELECT COUNT(*) orders, COALESCE(SUM(paid_cents),0) grossCents, COALESCE(SUM(refunded_cents),0) refundedCents, COALESCE(SUM(IF(paid_cents>0,fee_cents,0)),0) feesCents, COALESCE(SUM(IF(paid_cents>0,cost_total_cents,0)),0) costsCents, COALESCE(SUM(paid_cents>0 AND cost_total_cents IS NULL),0) missingCosts, COALESCE(SUM(paid_cents>0 AND fee_cents IS NULL),0) missingFees, COALESCE(SUM(paid_cents>0 AND refunded_cents IS NULL),0) missingRefunds, COALESCE(SUM(paid_cents>0 AND state NOT IN ('paid','refunded')),0) incompletePayments, COALESCE(SUM(state='pending'),0) pending FROM mn_orders WHERE created_at>=?",
      [from],
    );
    const [expenses] = await this.pool.execute(
      "SELECT COALESCE(SUM(amount_cents),0) expensesCents FROM mn_expenses WHERE incurred_at>=? AND deleted_at IS NULL",
      [from],
    );
    const [chart] = await this.pool.execute(
      "SELECT FLOOR((created_at-10800000)/86400000) day, SUM(paid_cents-COALESCE(refunded_cents,0)) cents FROM mn_orders WHERE created_at>=? GROUP BY day ORDER BY day",
      [from],
    );
    const stats = Object.fromEntries(
      Object.entries({ ...totals[0], ...expenses[0] }).map(([key, value]) => [
        key,
        Number(value),
      ]),
    );
    const catalog = await this.catalog(true);
    const [popular] = await this.pool.execute(
      "SELECT i.product_id, MAX(i.title) title, SUM(i.quantity) portions, SUM(i.weight_grams*i.quantity) grams, SUM(i.unit_cents*i.quantity) grossCents FROM mn_order_items i JOIN mn_orders o ON o.id=i.order_id WHERE o.created_at>=? AND o.state='paid' GROUP BY i.product_id ORDER BY grossCents DESC LIMIT 5",
      [from],
    );
    return {
      ...stats,
      days,
      catalogHealth: {
        total: catalog.length,
        active: catalog.filter((product) => product.active).length,
        missingPhotos: catalog.filter(
          (product) => !product.imageSha,
        ).length,
        missingCosts: catalog.filter(
          (product) => product.costCents === null,
        ).length,
      },
      topProducts: popular.map((row) => ({
        id: row.product_id,
        name:
          catalog.find((product) => product.id === row.product_id)
            ?.nome_produto || row.title,
        portions: Number(row.portions),
        grams: Number(row.grams),
        grossCents: Number(row.grossCents),
      })),
      netRevenueCents: stats.missingRefunds
        ? null
        : stats.grossCents - stats.refundedCents,
      profitCents:
        stats.missingCosts ||
        stats.missingFees ||
        stats.missingRefunds ||
        stats.incompletePayments
          ? null
          : stats.grossCents -
            stats.refundedCents -
            stats.feesCents -
            stats.costsCents -
            stats.expensesCents,
      chart: chart.map((row) => ({
        day: Number(row.day),
        cents: Number(row.cents),
      })),
    };
  }
  async loginLimit(key, limit, windowMs) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const now = Date.now();
      await connection.execute(
        "INSERT INTO mn_admin_limits(bucket,hits,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=IF(expires_at<=?,1,hits+1), expires_at=IF(expires_at<=?,VALUES(expires_at),expires_at)",
        [key, now + windowMs, now, now],
      );
      const [rows] = await connection.execute(
        "SELECT hits,expires_at FROM mn_admin_limits WHERE bucket=? FOR UPDATE",
        [key],
      );
      await connection.commit();
      return rows[0].hits <= limit;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async createAdminSession(hash, now) {
    await this.pool.execute(
      "DELETE FROM mn_admin_sessions WHERE expires_at<?",
      [now],
    );
    await this.pool.execute(
      "INSERT INTO mn_admin_sessions(token_hash,created_at,last_seen,expires_at) VALUES(?,?,?,?)",
      [hash, now, now, now + 8 * 3600000],
    );
  }
  async adminSession(hash) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM mn_admin_sessions WHERE token_hash=?",
      [hash],
    );
    return rows[0] || null;
  }
  async touchAdminSession(hash, now) {
    await this.pool.execute(
      "UPDATE mn_admin_sessions SET last_seen=? WHERE token_hash=?",
      [now, hash],
    );
  }
  async deleteAdminSession(hash) {
    await this.pool.execute(
      "DELETE FROM mn_admin_sessions WHERE token_hash=?",
      [hash],
    );
  }
  async consumeTotp(step) {
    try {
      await this.pool.execute("INSERT INTO mn_admin_totp(step) VALUES(?)", [
        step,
      ]);
      await this.pool.execute("DELETE FROM mn_admin_totp WHERE step<?", [
        step - 4,
      ]);
      return true;
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return false;
      throw error;
    }
  }
}
