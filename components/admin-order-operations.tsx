"use client";
import { useState, type FormEvent } from "react";
import { Printer, PackageCheck, Truck, Store } from "lucide-react";
import { formatPrice } from "@/lib/products";
import type { Order } from "./admin-dashboard";
export function printPackingSlip(order: Order) {
  if (order.state !== "paid") return;
  const popup = window.open("", "_blank", "width=760,height=800");
  if (!popup) return;
  popup.opener = null;
  popup.document.title = "Resumo de separação · Mundo Natural";
  const style = popup.document.createElement("style");
  style.textContent =
    "body{font:16px/1.7 system-ui,sans-serif;max-width:680px;margin:32px auto;padding:0 16px;color:#172e20}h1{font-size:23px}p{white-space:pre-wrap;overflow-wrap:anywhere}footer{font-size:12px;margin-top:28px;border-top:1px solid #ccc}@media print{button{display:none}}";
  popup.document.head.append(style);
  const heading = popup.document.createElement("h1");
  heading.textContent = "Mundo Natural · Separação e embalagem";
  popup.document.body.append(heading);
  const address = order.address;
  const lines = [
    order.id,
    `Cliente: ${order.customer_name}`,
    `Recebimento: ${order.fulfillment_mode === "delivery" ? "Entrega" : "Retirada na loja"}`,
    order.customer_phone ? `Telefone: ${order.customer_phone}` : "",
    address
      ? `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ""}\n${address.neighborhood} · ${address.city}/${address.state} · CEP ${address.postalCode}`
      : "",
    "PRODUTOS",
    ...(order.items || [])
      .filter((i) => i.product_id !== "__shipping__")
      .map((i) => `${i.packed ? "[✓]" : "[  ]"} ${i.quantity} × ${i.title}`),
    order.customer_note ? `Observações do cliente: ${order.customer_note}` : "",
    `Total pago: ${formatPrice(order.total_cents / 100)}`,
  ];
  for (const line of lines.filter(Boolean)) {
    const p = popup.document.createElement("p");
    p.textContent = line;
    popup.document.body.append(p);
  }
  const footer = popup.document.createElement("footer");
  footer.textContent =
    "Resumo para conferência. Não é documento fiscal. Confira alergênicos e integridade das embalagens antes da saída.";
  popup.document.body.append(footer);
  popup.focus();
  popup.print();
}
type Props = {
  order: Order;
  busy: boolean;
  update: (path: string, body: Record<string, unknown>) => Promise<void>;
};
export function AdminOrderOperations({ order, busy, update }: Props) {
  const [staffNote, setStaffNote] = useState(order.staff_note || ""),
    [courierName, setCourierName] = useState(order.courier_name || ""),
    [deliveryCost, setDeliveryCost] = useState(
      order.delivery_cost_cents == null
        ? ""
        : (order.delivery_cost_cents / 100).toFixed(2),
    ),
    [error, setError] = useState("");
  const productItems = (order.items || []).filter(
      (i) => i.product_id !== "__shipping__",
    ),
    packed = productItems.filter((i) => !!i.packed).length,
    address = order.address;
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const raw = deliveryCost.trim().replace(",", ".");
    if (raw && !/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      setError("Use um custo em reais com até duas casas decimais.");
      return;
    }
    await update("operations", {
      staffNote,
      courierName,
      deliveryCostCents: raw ? Math.round(Number(raw) * 100) : null,
    });
  }
  return (
    <section className="admin-order-operations">
      <div className="order-delivery-card">
        <h3>
          {order.fulfillment_mode === "delivery" ? (
            <Truck size={19} />
          ) : (
            <Store size={19} />
          )}{" "}
          {order.fulfillment_mode === "delivery"
            ? "Entrega no endereço"
            : "Retirada na loja"}
        </h3>
        {address && (
          <p>
            {address.street}, <strong>{address.number}</strong>
            {address.complement && ` · ${address.complement}`}
            <br />
            {address.neighborhood} · {address.city}/{address.state}
            <br />
            CEP {address.postalCode}
          </p>
        )}
        {order.customer_phone && (
          <p>
            Contato:{" "}
            <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
          </p>
        )}
        {order.fulfillment_mode === "delivery" && (
          <p>
            Frete cobrado:{" "}
            <strong>{formatPrice((order.shipping_cents || 0) / 100)}</strong>
            {order.distance_m != null &&
              ` · Aprox. ${(order.distance_m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`}
          </p>
        )}
        {order.customer_note && (
          <p className="order-note">
            <strong>Observações do cliente</strong>
            <br />
            {order.customer_note}
          </p>
        )}
      </div>
      <div className="packing-heading">
        <h3>
          <PackageCheck size={20} /> Conferência da embalagem
        </h3>
        <span>
          {packed}/{productItems.length} itens conferidos
        </span>
      </div>
      <progress
        max={Math.max(1, productItems.length)}
        value={packed}
        aria-label="Progresso da conferência"
      />
      {order.state !== "paid" && (
        <p className="payment-error">
          Aguarde a aprovação do pagamento antes de separar ou liberar este
          pedido.
        </p>
      )}
      <div className="packing-checklist">
        {productItems.map((item) => (
          <label key={item.line_key} className={item.packed ? "checked" : ""}>
            <input
              type="checkbox"
              checked={!!item.packed}
              disabled={
                busy ||
                order.state !== "paid" ||
                ["completed", "out_for_delivery"].includes(
                  order.fulfillment_status,
                )
              }
              onChange={(e) =>
                void update("packing", {
                  lineKey: item.line_key,
                  packed: e.target.checked,
                })
              }
            />
            <span>
              <strong>
                {item.quantity} × {item.title}
              </strong>
              <small>Confira produto, peso, quantidade e embalagem.</small>
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="button button-small button-outline"
        disabled={order.state !== "paid"}
        onClick={() => printPackingSlip(order)}
      >
        <Printer size={17} /> Imprimir resumo de separação
      </button>
      <form onSubmit={save} className="order-operations-form">
        <h3>Anotações da equipe</h3>
        <label className="field-label">
          Observação interna (não vai para o cliente)
          <textarea
            maxLength={1000}
            rows={3}
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            placeholder="Ex.: separado na bancada 2, conferir embalagem…"
          />
        </label>
        {order.fulfillment_mode === "delivery" && (
          <div className="form-row">
            <label className="field-label">
              Entregador ou serviço
              <input
                maxLength={80}
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="Nome do entregador"
              />
            </label>
            <label className="field-label">
              Custo real da entrega (R$)
              <input
                inputMode="decimal"
                value={deliveryCost}
                onChange={(e) => setDeliveryCost(e.target.value)}
                placeholder="Deixe vazio até confirmar"
              />
            </label>
          </div>
        )}
        {order.fulfillment_mode === "delivery" &&
          order.delivery_cost_cents == null && (
            <p className="fine-print">
              O lucro fica pendente enquanto o custo real da entrega não estiver
              informado. Use 0 apenas se não houve despesa com a entrega.
            </p>
          )}
        <button type="submit" disabled={busy} className="button button-small">
          Salvar informações da equipe
        </button>
        {error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
