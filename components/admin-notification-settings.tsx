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
          <h2>Mensagens aos clientes</h2>
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
          <div className="notification-setup-card">
            <h3>Conectar a Brevo</h3>
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
                e verifique o remetente de e-mail.
              </li>
              <li>
                Ative o WhatsApp, conecte o número da loja e aprove três modelos
                de utilidade.
              </li>
              <li>
                Na Hostinger, configure <code>BREVO_API_KEY</code>,{" "}
                <code>BREVO_SENDER_EMAIL</code> e{" "}
                <code>BREVO_WHATSAPP_SENDER=551151993525</code>. Reimplante a
                aplicação.
              </li>
              <li>
                Preencha os IDs dos modelos e ative os canais abaixo. Para
                enviar mesmo com o painel fechado, configure o agendador
                descrito em <code>docs/NOTIFICACOES.md</code>.
              </li>
            </ol>
            <p className="fine-print">
              A chave fica somente nas variáveis da hospedagem. E-mail e
              WhatsApp têm regras e limites do provedor; WhatsApp exige créditos
              e modelos aprovados.
            </p>
          </div>
          <form className="notification-channels" onSubmit={save}>
            <div className="notification-setup-card">
              <h3>
                <Mail size={20} /> E-mail transacional
              </h3>
              <p>
                {data.readiness.email
                  ? "Credencial e remetente configurados no servidor."
                  : "Configure a chave e o remetente de e-mail na Hostinger."}
              </p>
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
              O painel processa a fila enquanto está aberto. O agendador mantém
              os envios ativos quando a equipe sai do painel. A confirmação de
              pagamento também pode acionar os avisos pelo webhook verificado.
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
