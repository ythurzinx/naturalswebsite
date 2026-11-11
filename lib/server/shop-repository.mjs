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
      if (!selection) {
        const [intents] = await connection.execute(
          "SELECT selection_json FROM mn_checkout_intents WHERE reference=?",
          [order.external_reference],
        );
        if (intents.length) selection = JSON.parse(intents[0].selection_json);
      }
      // Serialize event producers until commit. AUTO_INCREMENT alone can
      // expose a later committed cursor before an earlier transaction commits.
      await connection.execute(
        "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('order-event-sequence','{}',0,?) ON DUPLICATE KEY UPDATE version=version",
        [Date.now()],
      );
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
          const baseCost =
            productId === "__shipping__" ? 0 : cost[0]?.cost_cents;
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
      if (
        !existing.length ||
        (updated >= existing[0].provider_updated_at &&
          existing[0].state !== state)
      ) {
        await connection.execute(
          "INSERT INTO mn_order_events(order_id,kind,state,created_at) VALUES(?,?,?,?)",
          [
            order.id,
            state === "paid" ? "paid" : !existing.length ? "created" : "status",
            state,
            now,
          ],
        );
      }
      if (selection) {
        if (selection.totalCents !== total)
          reject("ORDER_RECORD_MISMATCH", "Pedido inconsistente.", 502);
        await connection.execute(
          "INSERT INTO mn_order_details(order_id,fulfillment_mode,shipping_cents,distance_m,address_json,customer_phone,customer_note,checkout_saved,updated_at) VALUES(?,?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE fulfillment_mode=IF(checkout_saved=0,VALUES(fulfillment_mode),fulfillment_mode), shipping_cents=IF(checkout_saved=0,VALUES(shipping_cents),shipping_cents), distance_m=IF(checkout_saved=0,VALUES(distance_m),distance_m), address_json=IF(checkout_saved=0,VALUES(address_json),address_json), customer_phone=IF(checkout_saved=0,VALUES(customer_phone),customer_phone), customer_note=IF(checkout_saved=0,VALUES(customer_note),customer_note),checkout_saved=1",
          [
            order.id,
            selection.fulfillment || "pickup",
            selection.shippingCents || 0,
            selection.delivery?.distanceMeters ?? null,
            selection.delivery
              ? JSON.stringify(selection.delivery.address)
              : null,
            selection.phone || "",
            selection.notes || "",
            now,
          ],
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
      "SELECT o.*, COALESCE(d.fulfillment_mode,'pickup') fulfillment_mode, COALESCE(d.shipping_cents,0) shipping_cents, d.delivery_cost_cents FROM mn_orders o LEFT JOIN mn_order_details d ON d.order_id=o.id ORDER BY o.created_at DESC LIMIT 200",
    );
    return rows.map((row) => ({
      ...row,
      shipping_cents: Number(row.shipping_cents),
    }));
  }
  async order(id) {
    const [rows] = await this.pool.execute(
      "SELECT o.*, COALESCE(d.fulfillment_mode,'pickup') fulfillment_mode, COALESCE(d.shipping_cents,0) shipping_cents, d.distance_m, d.address_json, COALESCE(d.customer_phone,'') customer_phone, COALESCE(d.customer_note,'') customer_note, COALESCE(d.staff_note,'') staff_note, COALESCE(d.courier_name,'') courier_name, d.delivery_cost_cents, d.checkout_saved FROM mn_orders o LEFT JOIN mn_order_details d ON d.order_id=o.id WHERE o.id=?",
      [id],
    );
    if (!rows.length) return null;
    const [items] = await this.pool.execute(
      "SELECT i.*, COALESCE(p.packed,0) packed FROM mn_order_items i LEFT JOIN mn_order_packing p ON p.order_id=i.order_id AND p.line_key=i.line_key WHERE i.order_id=? ORDER BY i.line_key",
      [id],
    );
    const { address_json, ...row } = rows[0];
    return {
      ...row,
      shipping_cents: Number(row.shipping_cents),
      address: address_json ? JSON.parse(address_json) : null,
      items: items.map((item) => ({ ...item, packed: Number(item.packed) })),
    };
  }
  async setFulfillment(id, state) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT o.state,o.fulfillment_status,d.fulfillment_mode FROM mn_orders o LEFT JOIN mn_order_details d ON d.order_id=o.id WHERE o.id=? FOR UPDATE",
        [id],
      );
      if (!rows.length || rows[0].state !== "paid")
        reject(
          "PAYMENT_REQUIRED",
          "O pedido precisa estar pago para iniciar a separação.",
          409,
        );
      if (
        state === "out_for_delivery" &&
        rows[0].fulfillment_mode !== "delivery"
      )
        reject("INVALID_STATE", "Este pedido é para retirada na loja.", 409);
      if (["ready", "out_for_delivery", "completed"].includes(state)) {
        const [missing] = await connection.execute(
          "SELECT COUNT(*) n FROM mn_order_items i LEFT JOIN mn_order_packing p ON p.order_id=i.order_id AND p.line_key=i.line_key WHERE i.order_id=? AND i.product_id<>'__shipping__' AND COALESCE(p.packed,0)=0",
          [id],
        );
        if (Number(missing[0].n))
          reject(
            "PACKING_INCOMPLETE",
            "Confira e marque todos os produtos antes de finalizar a embalagem.",
            409,
          );
      }
      await connection.execute(
        "UPDATE mn_orders SET fulfillment_status=?,updated_at=? WHERE id=?",
        [state, Date.now(), id],
      );
      await this.audit(
        "order.fulfillment",
        id,
        { previous: rows[0].fulfillment_status, state },
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
  async recordCheckoutIntent(reference, selection) {
    const json = JSON.stringify(selection);
    const [result] = await this.pool.execute(
      "INSERT IGNORE INTO mn_checkout_intents(reference,selection_json,created_at) VALUES(?,?,?)",
      [reference, json, Date.now()],
    );
    if (!result.affectedRows) {
      const [rows] = await this.pool.execute(
        "SELECT selection_json FROM mn_checkout_intents WHERE reference=?",
        [reference],
      );
      if (rows[0]?.selection_json !== json)
        reject(
          "CHECKOUT_CONFLICT",
          "Esta tentativa já foi usada com outros dados. Atualize a página.",
          409,
        );
    }
    await this.pool.execute(
      "DELETE FROM mn_checkout_intents WHERE created_at<? LIMIT 100",
      [Date.now() - 7 * 86400000],
    );
  }
  async shippingSettings() {
    const [rows] = await this.pool.execute(
      "SELECT value_json,version FROM mn_settings WHERE setting_key='shipping'",
    );
    return rows.length
      ? { ...JSON.parse(rows[0].value_json), revision: Number(rows[0].version) }
      : {};
  }
  async saveShippingSettings(value) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "INSERT INTO mn_settings(setting_key,value_json,version,updated_at) VALUES('shipping','{}',0,?) ON DUPLICATE KEY UPDATE version=version",
        [Date.now()],
      );
      const [rows] = await connection.execute(
        "SELECT version FROM mn_settings WHERE setting_key='shipping' FOR UPDATE",
      );
      if (Number(rows[0].version) !== value.revision)
        reject(
          "SETTINGS_CHANGED",
          "O frete foi alterado em outra aba. Atualize o painel antes de salvar.",
          409,
        );
      await connection.execute(
        "UPDATE mn_settings SET value_json=?,version=version+1,updated_at=? WHERE setting_key='shipping'",
        [JSON.stringify(value), Date.now()],
      );
      await this.audit(
        "shipping.settings",
        "shipping",
        {
          enabled: value.enabled,
          pricePerKmCents: value.pricePerKmCents,
          revision: value.revision + 1,
        },
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
  async orderAlerts(after = null) {
    // Capture the cursor first: an order committed during the count is picked
    // up by the next poll, rather than silently consumed by a newer cursor.
    const [latest] = await this.pool.execute(
      "SELECT COALESCE(MAX(id),0) event_cursor FROM mn_order_events",
    );
    const [counts] = await this.pool.execute(
      "SELECT SUM(state='paid' AND fulfillment_status IN ('new','packing')) toPack, SUM(state='paid' AND fulfillment_status='ready') ready, SUM(state='pending') pending FROM mn_orders",
    );
    if (after === null)
      return {
        cursor: Number(latest[0].event_cursor),
        events: [],
        counts: counts[0],
        hasMore: false,
      };
    const [events] = await this.pool.execute(
      "SELECT e.id,e.order_id,e.kind,e.state,e.created_at,o.total_cents,o.state current_state FROM mn_order_events e JOIN mn_orders o ON o.id=e.order_id WHERE e.id>? ORDER BY e.id LIMIT 100",
      [after],
    );
    return {
      cursor: events.length ? Number(events.at(-1).id) : after,
      events,
      counts: counts[0],
      hasMore: events.length === 100,
    };
  }
  async setPacked(id, key, packed) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [order] = await connection.execute(
        "SELECT state,fulfillment_status FROM mn_orders WHERE id=? FOR UPDATE",
        [id],
      );
      if (!order.length || order[0].state !== "paid")
        reject(
          "PAYMENT_REQUIRED",
          "Confirme o pagamento antes de separar os produtos.",
          409,
        );
      if (
        ["out_for_delivery", "completed"].includes(order[0].fulfillment_status)
      )
        reject(
          "ORDER_LOCKED",
          "Reabra a etapa de separação antes de alterar a conferência.",
          409,
        );
      const [items] = await connection.execute(
        "SELECT product_id FROM mn_order_items WHERE order_id=? AND line_key=?",
        [id, key],
      );
      if (!items.length || items[0].product_id === "__shipping__")
        reject("INVALID_ITEM", "Produto não encontrado nesse pedido.", 404);
      await connection.execute(
        "INSERT INTO mn_order_packing(order_id,line_key,packed,updated_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE packed=VALUES(packed),updated_at=VALUES(updated_at)",
        [id, key, packed ? 1 : 0, Date.now()],
      );
      if (!packed && order[0].fulfillment_status === "ready")
        await connection.execute(
          "UPDATE mn_orders SET fulfillment_status='packing',updated_at=? WHERE id=?",
          [Date.now(), id],
        );
      await this.audit("order.packing", id, { key, packed }, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async saveOrderOperations(id, value) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT id FROM mn_orders WHERE id=? FOR UPDATE",
        [id],
      );
      if (!rows.length) reject("NOT_FOUND", "Pedido não encontrado.", 404);
      await connection.execute(
        "INSERT INTO mn_order_details(order_id,staff_note,courier_name,delivery_cost_cents,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE staff_note=VALUES(staff_note),courier_name=VALUES(courier_name),delivery_cost_cents=VALUES(delivery_cost_cents),updated_at=VALUES(updated_at)",
        [
          id,
          value.staffNote,
          value.courierName,
          value.deliveryCostCents,
          Date.now(),
        ],
      );
      // Notes and addresses are deliberately excluded from audit records.
      await this.audit(
        "order.operations",
        id,
        { deliveryCostCents: value.deliveryCostCents },
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
      "SELECT i.product_id, MAX(i.title) title, SUM(i.quantity) portions, SUM(i.weight_grams*i.quantity) grams, SUM(i.unit_cents*i.quantity) grossCents FROM mn_order_items i JOIN mn_orders o ON o.id=i.order_id WHERE o.created_at>=? AND o.state='paid' AND i.product_id<>'__shipping__' GROUP BY i.product_id ORDER BY grossCents DESC LIMIT 5",
      [from],
    );
    const [deliveryCosts] = await this.pool.execute(
      "SELECT COALESCE(SUM(d.delivery_cost_cents),0) deliveryCostsCents, COALESCE(SUM(d.delivery_cost_cents IS NULL),0) missingDeliveryCosts FROM mn_order_details d JOIN mn_orders o ON o.id=d.order_id WHERE o.created_at>=? AND o.paid_cents>0 AND d.fulfillment_mode='delivery'",
      [from],
    );
    stats.deliveryCostsCents = Number(deliveryCosts[0].deliveryCostsCents);
    stats.missingDeliveryCosts = Number(deliveryCosts[0].missingDeliveryCosts);
    return {
      ...stats,
      days,
      catalogHealth: {
        total: catalog.length,
        active: catalog.filter((product) => product.active).length,
        missingPhotos: catalog.filter((product) => !product.imageSha).length,
        missingCosts: catalog.filter((product) => product.costCents === null)
          .length,
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
        stats.missingDeliveryCosts ||
        stats.incompletePayments
          ? null
          : stats.grossCents -
            stats.refundedCents -
            stats.feesCents -
            stats.costsCents -
            stats.deliveryCostsCents -
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
