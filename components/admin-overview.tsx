"use client";
import {
  Bike,
  Clock3,
  MessageCircle,
  Package,
  PackageCheck,
  Store,
  TicketPercent,
  Truck,
  Wallet,
} from "lucide-react";
import type { Order } from "./admin-dashboard";

type Today = {
  orders: number;
  paidOrders: number;
  grossCents: number;
  pending: number;
};
const currency = (cents: number | null | undefined) =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100);
function since(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}
const columns = [
  { id: "new", label: "Pagos · a separar", icon: Wallet },
  { id: "packing", label: "Em separação", icon: Package },
  { id: "ready", label: "Prontos", icon: PackageCheck },
  { id: "out_for_delivery", label: "Saiu para entrega", icon: Bike },
] as const;

// Daily cockpit: today's numbers and every paid order still in progress,
// grouped by step. Tapping a card opens the order with "Enviar para o cliente".
export function AdminOverview({
  today,
  averageTicketCents,
  orders,
  onOpen,
  onNavigate,
}: {
  today: Today | null;
  averageTicketCents: number | null;
  orders: Order[];
  onOpen: (id: string) => void;
  onNavigate: (tab: string) => void;
}) {
  const active = orders.filter(
    (order) => order.state === "paid" && order.fulfillment_status !== "completed",
  );
  const waiting = orders.filter(
    (order) =>
      order.state === "pending" &&
      Date.now() - order.created_at < 24 * 3600000,
  ).length;
  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  return (
    <div className="admin-overview">
      <header className="overview-hello">
        <div>
          <span className="eyebrow">{date}</span>
          <h2>{greeting()}! 🌿</h2>
          <p>
            {active.length
              ? `Você tem ${active.length} ${active.length === 1 ? "pedido em andamento" : "pedidos em andamento"}.`
              : "Nenhum pedido em andamento agora."}
          </p>
        </div>
        <div className="overview-actions">
          <button type="button" onClick={() => onNavigate("orders")}>
            <Truck size={17} /> Pedidos
          </button>
          <button type="button" onClick={() => onNavigate("coupons")}>
            <TicketPercent size={17} /> Cupons
          </button>
          <button type="button" onClick={() => onNavigate("messages")}>
            <MessageCircle size={17} /> Mensagens
          </button>
          <button type="button" onClick={() => onNavigate("products")}>
            <Store size={17} /> Produtos
          </button>
        </div>
      </header>
      <div className="overview-today">
        {[
          { label: "Vendas hoje", value: currency(today?.grossCents ?? null) },
          {
            label: "Pedidos pagos hoje",
            value: today ? String(today.paidOrders) : "—",
          },
          {
            label: "Aguardando pagamento",
            value: today ? String(waiting) : "—",
          },
          { label: "Ticket médio do período", value: currency(averageTicketCents) },
        ].map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>
      <section className="overview-board" aria-label="Pedidos em andamento">
        {columns.map(({ id, label, icon: Icon }) => {
          const list = active
            .filter((order) => order.fulfillment_status === id)
            .sort((a, b) => a.created_at - b.created_at);
          return (
            <div className="board-column" key={id}>
              <h3>
                <Icon size={17} /> {label} <span>{list.length}</span>
              </h3>
              {!list.length && <p className="board-empty">Nada por aqui.</p>}
              {list.map((order) => (
                <button
                  type="button"
                  className="board-card"
                  key={order.id}
                  onClick={() => onOpen(order.id)}
                  aria-label={`Abrir pedido de ${order.customer_name || "cliente"}`}
                >
                  <strong>
                    {(order.customer_name || "Cliente").split(" ")[0]}
                  </strong>
                  <span className="board-total">
                    {currency(order.total_cents)}
                  </span>
                  <small>
                    <span>
                      {order.fulfillment_mode === "delivery" ? (
                        <>
                          <Bike size={13} /> Entrega
                        </>
                      ) : (
                        <>
                          <Store size={13} /> Retirada
                        </>
                      )}
                    </span>
                    <span>
                      <Clock3 size={12} /> {since(order.created_at)}
                    </span>
                  </small>
                </button>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
