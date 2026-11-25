"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
  RefreshCw,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import { whatsappUrl } from "@/lib/store";
type Order = {
  testMode?: boolean;
  orderId: string;
  state: "paid" | "pending" | "failed" | "refunded" | "canceled";
  totalCents: number;
  fulfillment?: string;
  stage?: "new" | "packing" | "ready" | "out_for_delivery" | "completed" | null;
  etaMinutes?: number | null;
};
const stageIndex = {
  new: 0,
  packing: 1,
  ready: 2,
  out_for_delivery: 3,
  completed: 4,
};
function Timeline({ order }: { order: Order }) {
  const delivery = order.fulfillment === "delivery";
  const steps = delivery
    ? [
        "Pagamento aprovado",
        "Em separação",
        "Separado e embalado",
        "Saiu para entrega",
        "Entregue",
      ]
    : [
        "Pagamento aprovado",
        "Em separação",
        "Pronto para retirar na loja",
        "Retirado",
      ];
  const raw = stageIndex[order.stage || "new"];
  const current = delivery ? raw : raw === 4 ? 3 : Math.min(raw, 2);
  return (
    <ol className="order-timeline" aria-label="Etapas do pedido">
      {steps.map((step, index) => (
        <li
          key={step}
          className={
            index < current ? "done" : index === current ? "current" : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span aria-hidden>{index <= current ? "✓" : index + 1}</span>
          <div>
            <strong>{step}</strong>
            {index === current &&
              step === "Saiu para entrega" &&
              order.etaMinutes && (
                <small>
                  Previsão de chegada: cerca de {order.etaMinutes} minutos a
                  partir da saída.
                </small>
              )}
          </div>
        </li>
      ))}
    </ol>
  );
}
const labels = {
  paid: "Pagamento confirmado",
  pending: "Aguardando confirmação",
  failed: "O pagamento não foi aprovado",
  refunded: "Reembolso registrado",
  canceled: "Pedido cancelado",
};
function Status() {
  const params = useSearchParams(),
    id = params.get("order_id") || "current";
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true),
    [resetting, setResetting] = useState(false);
  const { clearCart } = useCart();
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined,
      attempts = 0;
    setLoading(true);
    setError("");
    async function check() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || "Não foi possível consultar seu pedido.");
        setOrder(data);
        setError("");
        attempts++;
        if (data.state === "pending" && attempts < 12)
          timer = setTimeout(check, Math.min(5000 * attempts, 15000));
        // After payment, follow the preparation steps while the page is open.
        else if (data.state === "paid" && data.stage !== "completed")
          timer = setTimeout(check, 60000);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar seu pedido.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, refresh]);
  async function finish() {
    setResetting(true);
    try {
      const session = await fetch("/api/checkout/session", {
        cache: "no-store",
        credentials: "same-origin",
      }).then((r) => r.json());
      if (session.csrfToken)
        await fetch("/api/checkout/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": session.csrfToken },
        });
    } finally {
      clearCart();
      window.location.assign("/produtos");
    }
  }
  const paid = order?.state === "paid";
  return (
    <main id="conteudo" className="shell page-main">
      <span className="eyebrow">CUIDADO EM CADA ETAPA</span>
      <h1 className="page-title">
        Seu pagamento<span>.</span>
      </h1>
      <p className="section-description">
        A confirmação abaixo é consultada diretamente no Mercado Pago.
      </p>
      <section className="payment-status-card">
        {paid ? (
          <CheckCircle2 size={44} strokeWidth={1.3} />
        ) : (
          <Clock3 size={44} strokeWidth={1.3} />
        )}
        <h2>
          {loading
            ? "Consultando o pagamento…"
            : order
              ? `${order.testMode ? "Teste — " : ""}${labels[order.state]}`
              : "Vamos conferir seu pedido"}
        </h2>
        {error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}
        {order && (
          <>
            <p className="payment-order-id">Pedido: {order.orderId}</p>
            <strong className="detail-price">
              {formatPrice(order.totalCents / 100)}
            </strong>
            <p>
              {paid
                ? order?.fulfillment === "delivery"
                  ? "Seu pagamento foi confirmado. Acompanhe abaixo cada etapa do pedido; esta página se atualiza sozinha enquanto estiver aberta."
                  : "Seu pagamento foi confirmado. Acompanhe abaixo a separação e apresente o número do pedido na retirada."
                : order.state === "pending"
                  ? "O Pix ou a análise do cartão pode levar um tempo para ser confirmado. Você pode atualizar esta página. Evite iniciar outro pagamento para o mesmo pedido."
                  : "Consulte a equipe para receber ajuda com esta compra."}
            </p>
            {paid && <Timeline order={order} />}
          </>
        )}
        <div className="payment-status-actions">
          <button
            className="button button-outline"
            disabled={loading}
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw size={16} /> Atualizar status
          </button>
          <a
            className="button"
            href={whatsappUrl(
              order
                ? `Olá! Gostaria de falar sobre meu pedido ${order.orderId}.`
                : undefined,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={17} /> Falar com a loja
          </a>
        </div>
        {paid && (
          <button
            disabled={resetting}
            className="text-button"
            onClick={() => void finish()}
          >
            {resetting
              ? "Preparando…"
              : "Esvaziar carrinho e começar uma nova compra"}{" "}
            <ArrowRight size={13} />
          </button>
        )}
        <p className="privacy-note">
          <ShieldCheck size={16} /> Seu carrinho é preservado. O acesso ao
          pedido fica protegido neste navegador por um cookie essencial.
        </p>
        {paid && (
          <Link href="/avaliacoes" className="text-button">
            Avaliar produtos após a conclusão do pedido
          </Link>
        )}
        <Link href="/carrinho" className="back-link">
          Voltar ao meu carrinho
        </Link>
      </section>
    </main>
  );
}
export function PaymentStatus() {
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="shell page-main">
          <h1 className="page-title">Consultando seu pagamento…</h1>
        </main>
      }
    >
      <Status />
    </Suspense>
  );
}
