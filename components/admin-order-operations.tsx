"use client";
import { useState, type FormEvent } from "react";
import {
  Printer,
  PackageCheck,
  Truck,
  Store,
  Navigation,
  MessageCircle,
} from "lucide-react";
import {
  orderMessages,
  whatsappLink,
  whatsappPhone,
} from "@/lib/order-messages.mjs";
import { formatPrice } from "@/lib/products";
import type { Order } from "./admin-dashboard";
import { printOrderReceipt } from "@/lib/thermal-receipt";
// Navigation links open the delivery address in the courier's app. They use
// public URLs only: no map key is needed and nothing is sent until tapped.
export function navigationLinks(address: NonNullable<Order["address"]>) {
  const query = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - ${address.state}, ${address.postalCode}, Brasil`;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    waze: `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`,
  };
}
type Props = {
  order: Order;
  busy: boolean;
  update: (path: string, body: Record<string, unknown>) => Promise<void>;
  templates?: Record<string, string>;
};
export function AdminOrderOperations({
  order,
  busy,
  update,
  templates,
}: Props) {
  const [staffNote, setStaffNote] = useState(order.staff_note || ""),
    [courierName, setCourierName] = useState(order.courier_name || ""),
    [deliveryCost, setDeliveryCost] = useState(
      order.delivery_cost_cents == null
        ? ""
        : (order.delivery_cost_cents / 100).toFixed(2),
    ),
    [estimatedMinutes, setEstimatedMinutes] = useState(
      order.estimated_minutes?.toString() || "",
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
    const eta = estimatedMinutes.trim();
    if (
      eta &&
      (!/^\d{1,3}$/.test(eta) || Number(eta) < 1 || Number(eta) > 240)
    ) {
      setError("Informe uma previsão de 1 a 240 minutos.");
      return;
    }
    await update("operations", {
      staffNote,
      courierName,
      estimatedMinutes: eta ? Number(eta) : null,
      deliveryCostCents: raw ? Math.round(Number(raw) * 100) : null,
    });
  }
  return (
    <section className="admin-order-operations">
      <SendToCustomer
        order={order}
        busy={busy}
        update={update}
        templates={templates}
      />
      <div className="order-customer-card">
        <h3>Dados do cliente</h3>
        <dl>
          <div>
            <dt>Nome</dt>
            <dd>{order.customer_name || "Não informado"}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>
              {order.customer_email ? (
                <a href={`mailto:${encodeURIComponent(order.customer_email)}`}>
                  {order.customer_email}
                </a>
              ) : (
                "Não informado"
              )}
            </dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>
              {order.customer_phone &&
              /^\+?[0-9 ()-]{10,22}$/.test(order.customer_phone) ? (
                <a
                  href={`tel:+${order.customer_phone.replace(/\D/g, "").length <= 11 ? "55" : ""}${order.customer_phone.replace(/\D/g, "")}`}
                >
                  {order.customer_phone}
                </a>
              ) : (
                "Não informado neste pedido"
              )}
            </dd>
          </div>
          <div>
            <dt>WhatsApp automático</dt>
            <dd>
              {order.whatsapp_opt_in
                ? "Autorizado pelo cliente neste pedido"
                : "Sem autorização neste pedido"}
            </dd>
          </div>
        </dl>
        <p className="fine-print">
          Contatos disponíveis apenas para a equipe autenticada. Use para
          atender esta compra.
        </p>
      </div>
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
        {address && order.fulfillment_mode === "delivery" && (
          <div className="delivery-navigation">
            <a
              className="button button-outline button-small"
              href={navigationLinks(address).google}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={15} /> Abrir no Google Maps
            </a>
            <a
              className="button button-outline button-small"
              href={navigationLinks(address).waze}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={15} /> Abrir no Waze
            </a>
          </div>
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
      {!!order.notifications?.length && (
      <div className="order-customer-card">
        <h3>Avisos automáticos enviados</h3>
        {order.notifications?.length ? (
          <ul className="notification-order-history">
            {order.notifications.map((item) => (
              <li key={`${item.event}:${item.channel}`}>
                <strong>
                  {(
                    {
                      paid: "Pagamento aprovado",
                      ready: "Pedido separado",
                      out_for_delivery: "Saiu para entrega",
                    } as Record<string, string>
                  )[item.event] || item.event}
                </strong>
                <span>
                  {item.channel === "email" ? "E-mail" : "WhatsApp"} ·{" "}
                  {(
                    {
                      pending: "Na fila",
                      sending: "Enviando",
                      accepted: "Aceito pelo serviço",
                      cancelled: "Cancelado ou expirado",
                      failed: "Falha: confira a configuração",
                      unknown: "Envio incerto: confira na Brevo",
                    } as Record<string, string>
                  )[item.status] || item.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nenhum aviso automático registrado. Ative os canais em “Mensagens
            aos clientes” para os próximos eventos.
          </p>
        )}
      </div>
      )}
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
        onClick={() => printOrderReceipt(order)}
      >
        <Printer size={17} /> Imprimir pedido
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
              Previsão de chegada (minutos)
              <input
                type="number"
                min={1}
                max={240}
                step={1}
                inputMode="numeric"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="Ex.: 30"
              />
              <small>
                Salve antes de marcar “Saiu para entrega”. A mensagem usa esta
                previsão.
              </small>
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

const nextStage: Record<string, string> = {
  confirmed: "packing",
  ready: "ready",
  out_for_delivery: "out_for_delivery",
  completed: "completed",
};
const stageOrder = ["new", "packing", "ready", "out_for_delivery", "completed"];
// One tap: opens the store's WhatsApp with a complete message and moves the
// order forward. The team reviews the text and taps send in WhatsApp.
function SendToCustomer({ order, busy, update, templates }: Props) {
  const [minutes, setMinutes] = useState(
      order.estimated_minutes ? String(order.estimated_minutes) : "",
    ),
    [error, setError] = useState("");
  const phone = whatsappPhone(order.customer_phone);
  if (order.state !== "paid") return null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const delivery = order.fulfillment_mode === "delivery";
  async function advance(target: string) {
    if (
      stageOrder.indexOf(order.fulfillment_status) < stageOrder.indexOf(target)
    )
      await update("fulfillment", { state: target });
  }
  function send(id: string) {
    setError("");
    if (!phone) return;
    let eta: number | null = null;
    if (id === "out_for_delivery") {
      eta = Number(minutes);
      if (!/^\d{1,3}$/.test(minutes.trim()) || eta < 1 || eta > 240) {
        setError("Informe a previsão de chegada, de 1 a 240 minutos.");
        return;
      }
    }
    const message = orderMessages(
      { ...order, ...(eta ? { estimated_minutes: eta } : {}) },
      origin,
      templates,
    ).find((m) => m.id === id);
    if (!message) return;
    window.open(
      whatsappLink(phone, message.text),
      "_blank",
      "noopener,noreferrer",
    );
    void (async () => {
      if (eta)
        await update("operations", {
          staffNote: order.staff_note || "",
          courierName: order.courier_name || "",
          deliveryCostCents: order.delivery_cost_cents ?? null,
          estimatedMinutes: eta,
        });
      await advance(nextStage[id]);
    })();
  }
  return (
    <div className="send-customer">
      <h3>
        <MessageCircle size={19} /> Enviar para o cliente
      </h3>
      {!phone ? (
        <p className="fine-print">Telefone não informado neste pedido.</p>
      ) : (
        <>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => send("confirmed")}
          >
            Enviar: pagamento confirmado
          </button>
          <button
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={() => send("ready")}
          >
            {delivery
              ? "Enviar: separado e embalado"
              : "Enviar: pronto para retirar"}
          </button>
          {delivery && (
            <div className="send-customer-eta">
              <label className="field-label">
                Chega em quantos minutos?
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={240}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="Ex.: 30"
                />
              </label>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => send("out_for_delivery")}
              >
                Enviar: saiu para entrega
              </button>
            </div>
          )}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => send("completed")}
          >
            Enviar agradecimento e concluir
          </button>
          {error && (
            <p className="payment-error" role="alert">
              {error}
            </p>
          )}
          <p className="fine-print">
            Abre o WhatsApp da loja com a mensagem pronta (itens, total e
            endereço) e atualiza a etapa do pedido. Confira e toque em enviar.
            {!order.whatsapp_opt_in &&
              " O cliente não marcou atualizações pelo WhatsApp: envie só o necessário sobre este pedido."}
          </p>
        </>
      )}
    </div>
  );
}
