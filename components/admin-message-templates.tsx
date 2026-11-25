"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_TEMPLATES,
  MESSAGE_TEMPLATES,
  TEMPLATE_FIELDS,
  messageFields,
  renderTemplate,
} from "@/lib/order-messages.mjs";

type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
type Templates = Record<string, string>;
const sample = {
  customer_name: "Maria Silva",
  fulfillment_mode: "delivery",
  estimated_minutes: 25,
  shipping_cents: 900,
  total_cents: 4920,
  coupon_code: "INAUGURA10",
  coupon_discount_cents: 420,
  address: {
    street: "Rua das Magnólias",
    number: "22",
    complement: "Apto 2",
    neighborhood: "Parque Assunção",
    city: "Taboão da Serra",
    state: "SP",
    postalCode: "06754100",
  },
  items: [
    { line_key: "a:300", product_id: "a", title: "Castanha de Caju Crua · 300 g", quantity: 1 },
    { line_key: "b:200", product_id: "b", title: "Uva Passa Branca · 200 g", quantity: 2 },
  ],
};
export function AdminMessageTemplates({ api }: { api: Api }) {
  const [draft, setDraft] = useState<Templates>({ ...DEFAULT_TEMPLATES }),
    [revision, setRevision] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState<Templates>({ ...DEFAULT_TEMPLATES });
  const fields = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const load = useCallback(async () => {
    setError("");
    try {
      const result = await api<{ templates: Templates; revision: number }>(
        "message-templates",
      );
      const value = { ...DEFAULT_TEMPLATES, ...result.templates };
      setDraft(value);
      setSaved(value);
      setRevision(result.revision);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar as mensagens.",
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const dirty = MESSAGE_TEMPLATES.some((t) => draft[t.id] !== saved[t.id]);
  function insert(id: string, key: string) {
    const area = fields.current[id];
    const value = draft[id] || "";
    const start = area?.selectionStart ?? value.length,
      end = area?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}{${key}}${value.slice(end)}`;
    setDraft({ ...draft, [id]: next });
    requestAnimationFrame(() => {
      area?.focus();
      const cursor = start + key.length + 2;
      area?.setSelectionRange(cursor, cursor);
    });
  }
  async function save() {
    if (revision === null) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ templates: Templates; revision: number }>(
        "message-templates",
        "PUT",
        { templates: draft, revision },
      );
      const value = { ...DEFAULT_TEMPLATES, ...result.templates };
      setDraft(value);
      setSaved(value);
      setRevision(result.revision);
      setNotice("Mensagens salvas. Os próximos envios já usam os novos textos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-messages">
      <div className="admin-card merchandising-intro">
        <div>
          <span className="eyebrow">WHATSAPP DA LOJA</span>
          <h2>Mensagens para o cliente</h2>
          <p>
            Estes textos aparecem prontos quando você toca em “Enviar para o
            cliente” em um pedido. Toque em um campo para inserir no texto; ele
            é trocado pelos dados de cada pedido. Use *asteriscos* para negrito
            no WhatsApp.
          </p>
        </div>
        <div className="admin-toolbar-actions">
          <button
            type="button"
            className="button"
            disabled={busy || !dirty || revision === null}
            onClick={() => void save()}
          >
            <Save size={16} /> {busy ? "Salvando…" : "Salvar mensagens"}
          </button>
        </div>
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
      {dirty && (
        <p className="merchandising-unsaved" role="status">
          Alterações ainda não salvas.
        </p>
      )}
      {MESSAGE_TEMPLATES.map((template) => {
        const order =
          template.id === "ready_pickup"
            ? { ...sample, fulfillment_mode: "pickup", shipping_cents: 0 }
            : sample;
        const preview = renderTemplate(
          draft[template.id] || "",
          messageFields(order),
        );
        return (
          <section className="admin-card message-template" key={template.id}>
            <div className="message-template-head">
              <h3>
                <MessageCircle size={18} /> {template.label}
              </h3>
              <button
                type="button"
                className="text-button"
                disabled={draft[template.id] === DEFAULT_TEMPLATES[template.id as keyof typeof DEFAULT_TEMPLATES]}
                onClick={() =>
                  setDraft({
                    ...draft,
                    [template.id]:
                      DEFAULT_TEMPLATES[
                        template.id as keyof typeof DEFAULT_TEMPLATES
                      ],
                  })
                }
              >
                <RotateCcw size={14} /> Restaurar padrão
              </button>
            </div>
            <div className="message-template-body">
              <label className="field-label">
                Texto da mensagem
                <textarea
                  ref={(element) => {
                    fields.current[template.id] = element;
                  }}
                  rows={11}
                  maxLength={2000}
                  value={draft[template.id] || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [template.id]: e.target.value })
                  }
                />
              </label>
              <div className="message-preview" aria-label={`Prévia: ${template.label}`}>
                <span>Prévia com um pedido de exemplo</span>
                <p>{preview}</p>
              </div>
            </div>
            <div className="message-fields" aria-label="Campos disponíveis">
              {TEMPLATE_FIELDS.map((field) => (
                <button
                  type="button"
                  key={field.key}
                  onClick={() => insert(template.id, field.key)}
                  title={`Inserir {${field.key}}`}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
