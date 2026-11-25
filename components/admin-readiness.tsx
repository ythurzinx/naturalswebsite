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
          : "Confira MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_ENV=production na Hostinger.",
    },
    {
      label: "Avisos de pagamento do Mercado Pago (Webhook)",
      state: r.payments.webhook ? "ok" : "required",
      hint: r.payments.webhook
        ? "Assinatura configurada."
        : "Configure MERCADOPAGO_WEBHOOK_SECRET e o Webhook no Mercado Pago.",
    },
    {
      label: "Login do painel com verificação em duas etapas",
      state: r.security.mfa ? "ok" : "required",
      hint: r.security.mfa
        ? "Código do autenticador exigido no login."
        : "Gere ADMIN_TOTP_SECRET com npm run admin:setup.",
    },
    {
      label: "Cupons de desconto",
      state: !r.coupons.storage
        ? "required"
        : r.coupons.active
          ? "ok"
          : "optional",
      hint: !r.coupons.storage
        ? "Importe database/mundo-natural-schema.sql no phpMyAdmin para registrar os usos."
        : r.coupons.active
          ? `${r.coupons.active} ${r.coupons.active === 1 ? "cupom valendo" : "cupons valendo"} agora.`
          : "Nenhum cupom valendo agora. Crie em Cupons.",
    },
    {
      label: "Entrega com frete",
      state: s?.enabled ? "ok" : "optional",
      hint: s?.enabled
        ? "Clientes podem pagar entrega online."
        : "Desativada: o site vende com retirada na loja. Ative em Frete e entregas.",
    },
    {
      label: "Distância de carro (serviço de rotas)",
      state: s?.route && s.originAddress ? "ok" : "optional",
      hint: !s?.route
        ? "Cadastre TOMTOM_API_KEY (grátis, sem cartão) na Hostinger e reinicie a aplicação."
        : s.originAddress
          ? "Rota calculada do endereço de saída até a rua do cliente."
          : "Preencha o endereço de saída (rua e número) em Frete e entregas.",
    },
    {
      label: "E-mails de pedido (Brevo)",
      state: n?.email && n.emailEnabled ? "ok" : "optional",
      hint: !n?.email
        ? "Cadastre BREVO_API_KEY e BREVO_SENDER_EMAIL na Hostinger."
        : n.emailEnabled
          ? "Pagamento aprovado, pedido separado e saída para entrega."
          : "Ative o canal em Mensagens aos clientes.",
    },
    {
      label: "WhatsApp de pedido (Brevo)",
      state: n?.whatsapp && n.whatsappEnabled ? "ok" : "optional",
      hint: !n?.whatsapp
        ? "Cadastre BREVO_WHATSAPP_SENDER e conecte o WhatsApp Business na Brevo."
        : n.whatsappEnabled
          ? "Enviado a quem autorizar na finalização da compra."
          : "Informe os modelos aprovados e ative em Mensagens aos clientes.",
    },
    {
      label: "Envio automático dos avisos",
      state: n?.worker ? "ok" : "optional",
      hint: n?.worker
        ? n.issues
          ? `${n.issues} aviso(s) com falha: confira em Mensagens aos clientes.`
          : "Segredo do agendador configurado; confira se o agendador chama o site a cada minuto."
        : "Cadastre NOTIFICATION_WORKER_SECRET e um agendador (veja docs/NOTIFICACOES.md).",
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
    </section>
  );
}
