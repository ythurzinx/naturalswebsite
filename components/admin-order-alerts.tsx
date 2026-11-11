"use client";
import { Bell, Volume2, VolumeX, PackageCheck, Radio } from "lucide-react";
import { useOrderAlerts } from "@/hooks/use-order-alerts";
import { formatPrice } from "@/lib/products";
export function AdminOrderAlerts({
  alerts,
  onOpen,
  onQueue,
}: {
  alerts: ReturnType<typeof useOrderAlerts>;
  onOpen: (id: string) => void;
  onQueue: () => void;
}) {
  return (
    <section className="admin-alert-center" aria-label="Avisos de pedidos">
      <div className="admin-alert-toolbar">
        <span
          className={`live-indicator ${alerts.connected ? "connected" : ""}`}
        >
          <Radio size={16} />
          {alerts.connected
            ? "Acompanhando pedidos"
            : "Reconectando aos pedidos…"}
        </span>
        <button
          type="button"
          className="button button-small button-outline"
          onClick={onQueue}
        >
          <PackageCheck size={16} />
          {Number(alerts.counts?.toPack || 0)} para embalar
        </button>
        <button
          type="button"
          className="button button-small"
          onClick={() =>
            alerts.sound ? alerts.mute() : void alerts.enableSound()
          }
        >
          {alerts.sound ? <VolumeX size={16} /> : <Volume2 size={16} />}{" "}
          {alerts.sound ? "Silenciar avisos" : "Ativar avisos sonoros"}
        </button>
        {alerts.sound && (
          <button
            type="button"
            className="text-button"
            onClick={() => void alerts.testSound()}
          >
            Testar som
          </button>
        )}
      </div>
      <div className="admin-alert-preferences">
        <label>
          <input
            type="checkbox"
            checked={alerts.allOrders}
            onChange={(e) => alerts.setAllOrders(e.target.checked)}
          />{" "}
          Avisar também sobre pedidos pendentes
        </label>
        <small>
          Por padrão, o som toca quando o pagamento é aprovado. Mantenha este
          painel aberto e o volume ligado; o navegador pode pausar avisos em
          segundo plano.
        </small>
      </div>
      {alerts.audioError && (
        <p role="alert" className="payment-error">
          {alerts.audioError}
        </p>
      )}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="admin-order-notifications"
      >
        {alerts.events.map((event) => (
          <button
            key={event.id}
            className={`order-toast ${event.state === "paid" ? "paid" : ""}`}
            onClick={() => onOpen(event.order_id)}
          >
            <Bell size={19} />
            <span>
              <strong>
                {event.state === "paid"
                  ? "Pedido pago! Pode iniciar a separação."
                  : "Novo pedido aguardando pagamento."}
              </strong>
              <small>
                {event.order_id} · {formatPrice(event.total_cents / 100)}
              </small>
            </span>
            <span>Ver pedido →</span>
          </button>
        ))}
      </div>
      {!!alerts.events.length && (
        <button type="button" className="text-button" onClick={alerts.clear}>
          Limpar avisos
        </button>
      )}
    </section>
  );
}
