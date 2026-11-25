"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, RefreshCw } from "lucide-react";

type Api = <T>(path: string) => Promise<T>;
type Readiness = {
  payments: { configured: boolean; production: boolean; webhook: boolean };
  security: { mfa: boolean };
  coupons: { storage: boolean; active: number };
  shipping: { enabled: boolean; route: boolean; originAddress: boolean } | null;
  notifications: {
    email: boolean;
    whatsapp: boolean;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
    worker: boolean;
    issues: number;
  } | null;
};
type Item = {
  label: string;
  state: "ok" | "required" | "optional";
  hint: string;
  tech?: string;
};
function items(r: Readiness): Item[] {
  const n = r.notifications,
    s = r.shipping;
  return [
    {
      label: "Pagamento online em produção (Mercado Pago)",
      state:
        r.payments.configured && r.payments.production ? "ok" : "required",
      hint:
        r.payments.configured && r.payments.production
          ? "Pix e cartão ativos."
          : "O pagamento online não está ativo.",
      tech: "Hostinger: MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_ENV=production.",
    },
    {
      label: "Confirmação automática dos pagamentos",
      state: r.payments.webhook ? "ok" : "required",
      hint: r.payments.webhook
        ? "O Mercado Pago avisa a loja quando um pagamento é aprovado."
        : "A loja não recebe os avisos de pagamento do Mercado Pago.",
      tech: "Hostinger: MERCADOPAGO_WEBHOOK_SECRET; Mercado Pago: Webhook em /api/mercadopago/webhook.",
    },
    {
      label: "Login do painel com verificação em duas etapas",
      state: r.security.mfa ? "ok" : "required",
      hint: r.security.mfa
        ? "Código do autenticador exigido no login."
        : "O login não pede o código do autenticador.",
      tech: "Hostinger: ADMIN_TOTP_SECRET (gerado com npm run admin:setup).",
    },
    {
      label: "Cupons de desconto",
      state: !r.coupons.storage
        ? "required"
        : r.coupons.active
          ? "ok"
          : "optional",
      hint: !r.coupons.storage
        ? "O banco ainda não registra os usos de cupom."
        : r.coupons.active
          ? `${r.coupons.active} ${r.coupons.active === 1 ? "cupom valendo" : "cupons valendo"} agora.`
          : "Nenhum cupom valendo agora. Crie em Cupons.",
      tech: "phpMyAdmin: importar database/mundo-natural-schema.sql (só acrescenta tabelas).",
    },
    {
      label: "Entrega com frete",
      state: s?.enabled ? "ok" : "optional",
      hint: s?.enabled
        ? "Clientes podem pagar entrega online."
        : "Desativada: o site vende com retirada na loja. Ative em Frete e entregas.",
    },
    {
      label: "Frete pela distância de carro",
      state: s?.route && s.originAddress ? "ok" : "optional",
      hint: !s?.route
        ? "O frete usa uma estimativa aproximada da distância."
        : s.originAddress
          ? "Rota calculada do endereço de saída até a rua do cliente."
          : "Preencha o endereço de saída (rua e número) em Frete e entregas.",
      tech: "Hostinger: TOMTOM_API_KEY (grátis, em developer.tomtom.com) e reiniciar a aplicação.",
    },
    {
      label: "E-mails de pedido (Brevo)",
      state: n?.email && n.emailEnabled ? "ok" : "optional",
      hint: !n?.email
        ? "E-mails automáticos ainda não configurados."
        : n.emailEnabled
          ? "Pagamento aprovado, pedido separado e saída para entrega."
          : "Ative o canal em Mais opções → Mensagens aos clientes.",
      tech: "Hostinger: BREVO_API_KEY e BREVO_SENDER_EMAIL.",
    },
    {
      label: "WhatsApp de pedido (Brevo)",
      state: n?.whatsapp && n.whatsappEnabled ? "ok" : "optional",
      hint: !n?.whatsapp
        ? "Serviço pago. Enquanto isso, use “Enviar para o cliente” em cada pedido."
        : n.whatsappEnabled
          ? "Enviado a quem autorizar na finalização da compra."
          : "Informe os modelos aprovados e ative em Mensagens aos clientes.",
      tech: "Hostinger: BREVO_WHATSAPP_SENDER; Brevo: WhatsApp Business e modelos aprovados.",
    },
    {
      label: "Envio automático dos e-mails",
      state: n?.worker ? "ok" : "optional",
      hint: n?.worker
        ? n.issues
          ? `${n.issues} aviso(s) com falha: confira em Mensagens aos clientes.`
          : "Segredo do agendador configurado; confira se o agendador chama o site a cada minuto."
        : "Só necessário com os avisos automáticos da Brevo.",
      tech: "Hostinger: NOTIFICATION_WORKER_SECRET e um agendador (docs/NOTIFICACOES.md).",
    },
  ];
}
export function AdminReadiness({ api }: { api: Api }) {
  const [value, setValue] = useState<Readiness | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setValue(await api<Readiness>("readiness"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível conferir a loja.",
      );
    } finally {
      setBusy(false);
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const list = value ? items(value) : [];
  const missing = list.filter((i) => i.state === "required").length;
  return (
    <section className="admin-card readiness-card" aria-labelledby="readiness">
      <div className="readiness-head">
        <div>
          <span className="eyebrow">ANTES DE VENDER</span>
          <h2 id="readiness">Prontidão da loja</h2>
          {value && (
            <p className={missing ? "readiness-summary warn" : "readiness-summary"}>
              {missing
                ? `${missing} ${missing === 1 ? "item essencial pendente" : "itens essenciais pendentes"}.`
                : "Itens essenciais para vender estão prontos."}
            </p>
          )}
        </div>
        <button
          type="button"
          className="button button-outline button-small"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={15} /> {busy ? "Conferindo…" : "Conferir de novo"}
        </button>
      </div>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      <ul className="readiness-list">
        {list.map((item) => (
          <li key={item.label} className={item.state}>
            {item.state === "ok" ? (
              <CheckCircle2 size={18} aria-hidden />
            ) : item.state === "required" ? (
              <CircleAlert size={18} aria-hidden />
            ) : (
              <CircleDashed size={18} aria-hidden />
            )}
            <span>
              <strong>{item.label}</strong>
              <small>
                {item.state === "ok"
                  ? "Pronto. "
                  : item.state === "required"
                    ? "Essencial. "
                    : "Opcional. "}
                {item.hint}
              </small>
            </span>
          </li>
        ))}
      </ul>
      {list.some((item) => item.state !== "ok" && item.tech) && (
        <details className="readiness-tech">
          <summary>Detalhes para configurar</summary>
          <ul>
            {list
              .filter((item) => item.state !== "ok" && item.tech)
              .map((item) => (
                <li key={item.label}>
                  <strong>{item.label}:</strong> {item.tech}
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
