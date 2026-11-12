"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FlaskConical, ExternalLink, RefreshCw } from "lucide-react";
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
type TestStatus = { state: string; testMode: boolean; orderId?: string };
export function AdminPaymentTest({ api }: { api: Api }) {
  const [available, setAvailable] = useState<boolean | null>(null),
    [csrfToken, setCsrfToken] = useState(""),
    [status, setStatus] = useState<TestStatus | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState("Teste de integração"),
    [email, setEmail] = useState("");
  const refresh = useCallback(async () => {
    const result = await api<TestStatus>("payments/test/status");
    if (result.testMode !== true)
      throw Error("A homologação precisa usar o ambiente de teste.");
    setStatus(result);
  }, [api]);
  useEffect(() => {
    let active = true;
    void api<{ available: boolean; testMode?: boolean; csrfToken?: string }>(
      "payments/test/session",
    )
      .then(async (result) => {
        if (!active) return;
        setAvailable(result.available && result.testMode === true);
        setCsrfToken(result.csrfToken || "");
        if (result.available && result.testMode === true) await refresh();
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível iniciar a homologação.",
          );
      });
    return () => {
      active = false;
    };
  }, [api, refresh]);
  useEffect(() => {
    if (!status || !["pending", "action_required"].includes(status.state))
      return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [status, refresh]);
  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy || !available) return;
    setBusy(true);
    setError("");
    try {
      const session = await api<{ csrfToken: string }>(
        "payments/test/reset",
        "POST",
        { csrfToken },
      );
      setCsrfToken(session.csrfToken);
      const result = await api<{ checkoutUrl: string }>(
        "payments/test/checkout",
        "POST",
        {
          csrfToken: session.csrfToken,
          input: {
            name,
            email,
            fulfillment: "pickup",
            items: [{ id: "sandbox-checkout", quantity: 1 }],
            expectedTotalCents: 100,
          },
        },
      );
      const url = new URL(result.checkoutUrl);
      if (
        url.protocol !== "https:" ||
        !["www.mercadopago.com.br", "mercadopago.com.br"].includes(
          url.hostname,
        ) ||
        url.username ||
        url.password ||
        url.port ||
        url.pathname !== "/checkout/v1/redirect"
      )
        throw Error("Endereço de homologação inválido.");
      window.location.assign(url.href);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir o teste.",
      );
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    paid: "Teste aprovado pelo Mercado Pago",
    pending: "Teste aguardando pagamento",
    failed: "Teste rejeitado pelo Mercado Pago",
    refunded: "Teste estornado",
    canceled: "Teste cancelado",
  };
  return (
    <section className="admin-card sandbox-payment">
      <span className="eyebrow">
        <FlaskConical size={15} /> HOMOLOGAÇÃO PRIVADA
      </span>
      <h2>Testar o checkout com o Mercado Pago</h2>
      <p>
        Uma compra de teste de <strong>R$ 1,00</strong>, sem cobrança real,
        separada da vitrine. O resultado fica fora dos pedidos de embalagem e
        dos relatórios financeiros.
      </p>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      {available === null && !error && (
        <p role="status">Verificando o ambiente de teste…</p>
      )}
      {available === false && (
        <div className="sandbox-setup">
          <h3>Configure uma vez na Hostinger</h3>
          <ol>
            <li>
              Mercado Pago Developers → Suas integrações → aplicação da loja →
              Credenciais → <strong>Teste</strong>. Copie o Access Token.
            </li>
            <li>
              Hostinger → site → Variáveis de ambiente: adicione{" "}
              <code>MERCADOPAGO_TEST_ACCESS_TOKEN</code> com esse valor.
            </li>
            <li>
              Salve, reimplante e volte a esta aba. O token de produção e{" "}
              <code>MERCADOPAGO_ENV=production</code> continuam na configuração
              da loja.
            </li>
          </ol>
        </div>
      )}
      {available && (
        <>
          {status && status.state !== "none" && (
            <div className="sandbox-result" role="status">
              <strong>
                {labels[status.state] || "Teste em processamento"}
              </strong>
              <p>{status.orderId}</p>
              <small>
                Ambiente de teste. Este resultado não confirma uma venda real.
              </small>
              <button
                type="button"
                className="text-button"
                onClick={() => void refresh().catch((e) => setError(e.message))}
              >
                <RefreshCw size={14} /> Atualizar resultado
              </button>
            </div>
          )}
          <form onSubmit={start}>
            <fieldset className="checkout-fieldset" disabled={busy}>
              <div className="form-row">
                <label className="field-label">
                  Nome para homologação
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  E-mail para homologação
                  <input
                    required
                    type="email"
                    maxLength={180}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
              <button className="button">
                <ExternalLink size={16} />
                {busy ? "Abrindo homologação…" : "Abrir checkout de teste"}
              </button>
            </fieldset>
          </form>
        </>
      )}
      <p className="fine-print">
        Nome e e-mail são enviados ao Mercado Pago para a homologação. Use uma
        janela anônima e os cartões oficiais de teste no formulário do Mercado
        Pago. Não use cartão real. Para simular aprovação, use o titular
        indicado como APRO no guia oficial. Faça também um cenário de rejeição.
        O token de teste permanece no servidor; dados de cartão são preenchidos
        somente no Mercado Pago.
      </p>
      <a
        className="section-link"
        href="https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/integration-test/test-purchase-with-card"
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver cartões e cenários oficiais <ExternalLink size={14} />
      </a>
    </section>
  );
}
