"use client";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
type Diagnostics = {
  configured: boolean;
  environment: string | null;
  origin?: string;
  webhookConfigured: boolean;
  lastAttempt: {
    state: string;
    supportCode: string | null;
    receivedEnvironment: string;
    at: number;
  } | null;
};
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
export function AdminPaymentDiagnostics({ api }: { api: Api }) {
  const [value, setValue] = useState<Diagnostics | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setValue(await api<Diagnostics>("payments/diagnostics"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar a configuração.",
      );
    } finally {
      setBusy(false);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <section className="admin-card payment-diagnostics">
      <div className="admin-section-title">
        <h2>
          <CreditCard size={20} /> Mercado Pago
        </h2>
        <button
          type="button"
          className="button button-outline"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={15} /> Atualizar diagnóstico
        </button>
      </div>
      {error && (
        <p role="alert" className="payment-error">
          {error}
        </p>
      )}
      {!value && !error && <p role="status">Consultando configuração…</p>}
      {value && (
        <>
          <dl className="integration-details">
            <div>
              <dt>Configuração do servidor</dt>
              <dd>
                {value.configured ? "Preenchida" : "Incompleta ou inválida"}
              </dd>
            </div>
            <div>
              <dt>Ambiente configurado</dt>
              <dd>
                {value.environment === "production"
                  ? "Produção · vendas reais"
                  : value.environment === "test"
                    ? "Teste · sem vendas reais"
                    : "Indisponível"}
              </dd>
            </div>
            <div>
              <dt>Webhook</dt>
              <dd>
                {value.webhookConfigured
                  ? "Assinatura configurada"
                  : "Falta configurar a assinatura"}
              </dd>
            </div>
            <div>
              <dt>Endereço de retorno</dt>
              <dd>{value.origin || "Não configurado"}</dd>
            </div>
          </dl>
          {value.lastAttempt ? (
            <p
              role="status"
              className={
                value.lastAttempt.state === "failed"
                  ? "payment-error"
                  : "admin-notice"
              }
            >
              {value.lastAttempt.state === "failed"
                ? `Última criação bloqueada: ${value.lastAttempt.supportCode}. A API retornou um pedido de ${value.lastAttempt.receivedEnvironment === "test" ? "teste" : "produção"}.`
                : "Última criação de pedido validada no ambiente configurado. O crédito de cada pagamento ainda depende da confirmação do Mercado Pago."}{" "}
              {new Date(value.lastAttempt.at).toLocaleString("pt-BR")}
            </p>
          ) : (
            <p className="fine-print">
              Ainda não há uma tentativa registrada para a credencial atual.
              Este diagnóstico não efetua cobranças.
            </p>
          )}
          <h3>Como resolver MPV08</h3>
          <ol>
            <li>
              Entre em Mercado Pago Developers → Suas integrações → aplicação da
              loja → Credenciais.
            </li>
            <li>
              Selecione <strong>Produção</strong> e ative o ambiente, se
              solicitado. Copie o <strong>Access Token</strong> dessa aba.
              Tokens de teste também podem começar com APP_USR.
            </li>
            <li>
              Na Hostinger → Variáveis de ambiente, atualize{" "}
              <code>MERCADOPAGO_ACCESS_TOKEN</code>, mantenha{" "}
              <code>MERCADOPAGO_ENV=production</code> e{" "}
              <code>APP_URL=https://mundonaturaltaboao.com.br</code>. Salve e
              reimplante.
            </li>
            <li>
              Confira a assinatura de Webhooks da mesma aplicação em{" "}
              <code>MERCADOPAGO_WEBHOOK_SECRET</code> e a URL de notificação{" "}
              <code>/api/mercadopago/webhook</code>.
            </li>
            <li>
              Depois da implantação, abra novamente o checkout para conferir o
              redirecionamento. Faça a conferência de Pix e cartão com uma conta
              compradora diferente da conta vendedora.
            </li>
          </ol>
          <p className="fine-print">
            As credenciais são configuradas somente no servidor. O painel não
            exibe nem recebe tokens.{" "}
            <a
              href="https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/go-to-production"
              target="_blank"
              rel="noopener noreferrer"
            >
              Guia oficial de produção
            </a>
            .
          </p>
        </>
      )}
    </section>
  );
}
