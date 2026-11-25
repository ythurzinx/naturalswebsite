"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mail, MessageCircle, RefreshCw, Save } from "lucide-react";
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
type Settings = {
  revision: number;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappTemplates: {
    paid: number | null;
    ready: number | null;
    out_for_delivery: number | null;
  };
};
type Data = {
  settings: Settings;
  readiness: { apiKey: boolean; email: boolean; whatsapp: boolean };
  queue: { pending: number; issues: number };
  emailSetup?: { state: string; email: string; source: string | null };
};
const eventLabels = {
  paid: "Pagamento aprovado",
  ready: "Pedido separado",
  out_for_delivery: "Saiu para entrega",
};
export function AdminNotificationSettings({ api }: { api: Api }) {
  const [data, setData] = useState<Data | null>(null),
    [draft, setDraft] = useState<Settings | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const value = await api<Data>("notifications");
      if (!value.settings) throw Error("Serviço indisponível.");
      setData(value);
      setDraft(value.settings);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar os canais.",
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await api<Data>("notifications", "PUT", { ...draft });
      setData(value);
      setDraft(value.settings);
      setNotice(
        "Configuração salva. Vale para os próximos eventos; pedidos antigos não recebem avisos retroativos.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function drain() {
    setBusy(true);
    setError("");
    try {
      await api("notifications/drain", "POST", {});
      await load();
      setNotice(
        "Fila processada. Confira o histórico em cada pedido e os relatórios da Brevo.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível processar a fila.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-notification-settings">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CUIDADO EM CADA ETAPA</span>
          <h2>Avisos automáticos da loja</h2>
          <p>
            Confirmação de pagamento, separação e saída para entrega. Contato da
            loja: <strong>(11) 5199-3525</strong>.
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Atualizar canais"
          onClick={() => void load()}
        >
          <RefreshCw size={19} />
        </button>
      </div>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {data && draft && (
        <>
          <details className="notification-setup-card" open={!data.readiness.email}>
            <summary>
              <h3>Começar com os e-mails da Brevo</h3>
            </summary>
            <ol>
              <li>
                Crie a conta na{" "}
                <a
                  href="https://www.brevo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Brevo
                </a>{" "}
                e verifique um remetente com o domínio da loja. A Brevo pode
                solicitar a autenticação do domínio nos registros DNS.
              </li>
              <li>
                Gere uma chave de API v3 na Brevo. Na Hostinger → Variáveis de
                ambiente, adicione <code>BREVO_API_KEY</code> e reimplante a aplicação.
              </li>
              <li>
                O servidor procura um remetente ativo do domínio configurado em{" "}
                <code>APP_URL</code> e ativa o e-mail na primeira configuração.
                Para escolher outro remetente já verificado, defina também{" "}
                <code>BREVO_SENDER_EMAIL</code> na hospedagem.
              </li>
              <li>
                Confira o status abaixo. Os próximos pagamentos confirmados e
                as etapas do pedido entram na fila automaticamente, inclusive
                com o painel fechado. Uma desativação feita aqui será respeitada.
              </li>
            </ol>
            <p className="fine-print">
              A chave fica somente nas variáveis da hospedagem. E-mail e
              WhatsApp têm regras e limites do provedor; WhatsApp exige créditos
              e modelos aprovados.
            </p>
          </details>
          <form className="notification-channels" onSubmit={save}>
            <div className="notification-setup-card">
              <h3>
                <Mail size={20} /> E-mail transacional
              </h3>
              <p>
                {data.readiness.email
                  ? data.emailSetup?.state === "verified"
                    ? "Remetente ativo identificado na Brevo. Tudo pronto para os próximos avisos."
                    : "Chave e remetente configurados. Confirme a verificação do endereço na Brevo."
                  : data.emailSetup?.state === "invalid_key"
                    ? "A Brevo recusou a chave. Confira a credencial de API v3 na Hostinger."
                    : data.emailSetup?.state === "sender_required"
                      ? "Chave conectada. Falta verificar um remetente do domínio na Brevo."
                      : data.emailSetup?.state === "provider_unavailable"
                        ? "Não foi possível consultar a Brevo agora. Tente atualizar os canais em instantes."
                        : "Adicione a chave de API na Hostinger e verifique o remetente na Brevo."}
              </p>
              {data.emailSetup?.email && <p className="fine-print">Remetente: <strong>{data.emailSetup.email}</strong></p>}
              <p className="fine-print">Confirmação com os itens, valores, recebimento e acompanhamento do pedido. Sem anúncios ou dados internos da loja.</p>
              <label className="notification-toggle">
                <input
                  type="checkbox"
                  checked={draft.emailEnabled}
                  disabled={!data.readiness.email || busy}
                  onChange={(e) =>
                    setDraft({ ...draft, emailEnabled: e.target.checked })
                  }
                />
                Enviar atualizações por e-mail
              </label>
            </div>
            <div className="notification-setup-card">
              <h3>
                <MessageCircle size={20} /> WhatsApp oficial
              </h3>
              <p>
                {data.readiness.whatsapp
                  ? "Credencial e número configurados no servidor. Confira a aprovação dos modelos na Brevo."
                  : "Configure a chave e o número verificado na Hostinger."}
              </p>
              <p className="fine-print">
                Somente para clientes que autorizarem no checkout. O número
                informado para contato também vale nos pedidos de retirada.
              </p>
              <p className="fine-print">Para ativar: conecte o WhatsApp Business à Brevo, aprove os três modelos de utilidade e configure <code>BREVO_WHATSAPP_SENDER=551151993525</code> na Hostinger. O atendimento manual e a cópia das mensagens continuam disponíveis em Pedidos.</p>
              {Object.entries(eventLabels).map(([event, label]) => (
                <label className="field-label" key={event}>
                  ID do modelo: {label}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]+"
                    maxLength={16}
                    value={
                      draft.whatsappTemplates[
                        event as keyof typeof eventLabels
                      ] ?? ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw && !/^\d+$/.test(raw)) return;
                      setDraft({
                        ...draft,
                        whatsappTemplates: {
                          ...draft.whatsappTemplates,
                          [event]: raw ? Number(raw) : null,
                        },
                      });
                    }}
                    placeholder="ID numérico aprovado na Brevo"
                  />
                </label>
              ))}
              <label className="notification-toggle">
                <input
                  type="checkbox"
                  checked={draft.whatsappEnabled}
                  disabled={!data.readiness.whatsapp || busy}
                  onChange={(e) =>
                    setDraft({ ...draft, whatsappEnabled: e.target.checked })
                  }
                />
                Enviar atualizações pelo WhatsApp
              </label>
              <p className="fine-print">
                Variáveis dos modelos: nome, pedido, recebimento,
                previsao_minutos e telefone_loja. A previsão é informada pela
                equipe no pedido antes da saída.
              </p>
            </div>
            <button className="button button-small" disabled={busy}>
              <Save size={17} />
              Salvar canais de atendimento
            </button>
          </form>
          <div className="notification-setup-card">
            <h3>Fila de envio</h3>
            <p>
              <strong>{data.queue.pending}</strong> avisos aguardando
              processamento · <strong>{data.queue.issues}</strong> com falha ou
              envio incerto.
            </p>
            <p>
              A aplicação Node.js processa a fila a cada minuto, mesmo com o
              painel fechado, enquanto o servidor estiver em execução. O
              pagamento verificado também aciona o envio. Um agendador externo
              pode ser configurado como apoio em <code>docs/NOTIFICACOES.md</code>.
            </p>
            <button
              type="button"
              className="button button-small button-outline"
              disabled={busy}
              onClick={() => void drain()}
            >
              Processar fila agora
            </button>
            <p className="fine-print">
              Falhas de rede com resultado incerto não são reenviadas
              automaticamente, para evitar mensagens duplicadas. Consulte o
              relatório da Brevo. “Aceito pelo serviço” não confirma entrega nem
              leitura.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
