"use client";
import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, PackageCheck, Save } from "lucide-react";
import type { Order } from "./admin-dashboard";
import { orderMessages, whatsappLink, whatsappPhone, hasDamagedMessageText } from "@/lib/order-messages.mjs";

const stages = [
  { id: "new", label: "Pago · a separar" },
  { id: "packing", label: "Em separação" },
  { id: "ready", label: "Embalado e pronto" },
  { id: "out_for_delivery", label: "Saiu para entrega" },
  { id: "completed", label: "Concluído" },
];
function messageId(stage: string) {
  return stage === "ready" ? "ready" : stage === "out_for_delivery" ? "out_for_delivery"
    : stage === "completed" ? "completed" : "confirmed";
}
export function AdminOrderWorkflow({ order, busy, templates, transition }: {
  order: Order; busy: boolean; templates?: Record<string, string>;
  transition: (state: string, estimatedMinutes?: number) => Promise<Order>;
}) {
  const [stage, setStage] = useState(order.fulfillment_status),
    [minutes, setMinutes] = useState(order.estimated_minutes?.toString() || ""),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [manualCopy, setManualCopy] = useState("");
  useEffect(() => { setStage(order.fulfillment_status); }, [order.fulfillment_status]);
  useEffect(() => { setMinutes(order.estimated_minutes?.toString() || ""); }, [order.estimated_minutes]);
  const delivery = order.fulfillment_mode === "delivery",
    options = stages.filter((s) => delivery || s.id !== "out_for_delivery"),
    current = options.findIndex((s) => s.id === order.fulfillment_status),
    etaChanged = stage === "out_for_delivery" && minutes !== (order.estimated_minutes?.toString() || ""),
    dirty = stage !== order.fulfillment_status || etaChanged,
    origin = typeof window === "undefined" ? "" : window.location.origin,
    phone = whatsappPhone(order.customer_phone),
    packed = (order.items || []).filter((i) => i.product_id !== "__shipping__" && !i.packed).length;
  function textFor(value: Order) {
    if (value.state !== "paid") throw Error("O pagamento precisa estar confirmado antes de avisar a preparação.");
    const valueText = orderMessages(value, origin, templates).find((m) => m.id === messageId(value.fulfillment_status))?.text;
    if (!valueText || hasDamagedMessageText(valueText))
      throw Error("Confira o modelo da mensagem: há símbolos corrompidos ou conteúdo indisponível.");
    return valueText;
  }
  async function copy(value: Order) {
    const text = textFor(value);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Mensagem copiada. Cole na conversa e confira antes de enviar.");
    } catch {
      setManualCopy(text);
      setNotice("Selecione e copie o texto abaixo. O navegador não permitiu a cópia automática.");
    }
  }
  async function save() {
    if (busy || working || !dirty) return;
    setError(""); setNotice(""); setManualCopy("");
    let eta: number | undefined;
    if (stage === "out_for_delivery") {
      if (!/^\d{1,3}$/.test(minutes.trim()) || Number(minutes) < 1 || Number(minutes) > 240) {
        setError("Informe a previsão de chegada, de 1 a 240 minutos."); return;
      }
      eta = Number(minutes);
    }
    if (["ready", "out_for_delivery", "completed"].includes(stage) && packed > 0) {
      setError("Confira e marque todos os produtos na embalagem antes de salvar esta etapa."); return;
    }
    setWorking(true);
    try {
      const saved = await transition(stage, eta);
      if (saved.state !== "paid" || saved.fulfillment_status !== stage)
        throw Error("O pedido mudou. Confira os dados atualizados antes de avisar o cliente.");
      await copy(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o pedido.");
    } finally { setWorking(false); }
  }
  async function copyCurrent() {
    if (busy || working || dirty) return;
    setError(""); setNotice(""); setManualCopy("");
    try { await copy(order); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível copiar."); }
  }
  function openWhatsapp() {
    if (busy || working || dirty || !phone) return;
    setError("");
    try { window.open(whatsappLink(phone, textFor(order)), "_blank", "noopener,noreferrer"); }
    catch (e) { setError(e instanceof Error ? e.message : "Confira a mensagem antes de abrir."); }
  }
  let preview = "";
  try { preview = textFor({ ...order, fulfillment_status: stage, ...(stage === "out_for_delivery" ? { estimated_minutes: Number(minutes) || null } : {}) }); } catch { /* Pending payments have no preparation message. */ }
  return (
    <section className="order-workflow" aria-label="Etapa e mensagem do pedido">
      <div className="workflow-heading">
        <span className="workflow-symbol"><PackageCheck size={22} /></span>
        <div><span className="eyebrow">OPERAÇÃO DO PEDIDO</span><h3>Etapa e mensagem ao cliente</h3></div>
        <span className={`workflow-current ${order.state !== "paid" ? "pending" : ""}`}>{order.state === "paid" ? options[current]?.label : "Aguardando pagamento"}</span>
      </div>
      <ol className="workflow-progress" aria-label="Andamento do pedido">
        {options.map((s, i) => <li key={s.id} className={i <= current && order.state === "paid" ? "reached" : ""} aria-current={s.id === order.fulfillment_status ? "step" : undefined}><span>{i < current ? <Check size={12} /> : i + 1}</span><small>{s.label}</small></li>)}
      </ol>
      {order.state !== "paid" ? <p className="workflow-hint">O pagamento será confirmado pelo Mercado Pago. A preparação fica disponível depois da aprovação.</p> : <>
        <div className="workflow-fields">
          <label className="field-label">Etapa do pedido
            <select aria-label="Etapa do pedido" disabled={busy || working} value={stage} onChange={(e) => { setStage(e.target.value); setError(""); setNotice(""); setManualCopy(""); }}>
              {options.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          {delivery && stage === "out_for_delivery" && <label className="field-label">Previsão de chegada (minutos)
            <input type="number" min={1} max={240} step={1} inputMode="numeric" value={minutes} disabled={busy || working} onChange={(e) => setMinutes(e.target.value)} placeholder="Ex.: 30" />
          </label>}
        </div>
        <p className="workflow-hint">{dirty ? "Salve a etapa para liberar a mensagem correspondente. O cliente acompanha a atualização pelo site." : "A mensagem abaixo acompanha a etapa salva. Você pode copiar ou abrir a conversa no WhatsApp."}</p>
        <div className="workflow-actions">
          {dirty && <button type="button" className="button" disabled={busy || working} onClick={() => void save()}><Save size={16} />{working ? "Atualizando…" : "Salvar etapa e copiar mensagem"}</button>}
          <button type="button" className={`button ${dirty ? "button-outline" : ""}`} disabled={busy || working || dirty} onClick={() => void copyCurrent()}><Copy size={16} />Copiar mensagem atual</button>
          {phone && <button type="button" className="text-button" disabled={busy || working || dirty} onClick={openWhatsapp}><MessageCircle size={16} />Abrir no WhatsApp</button>}
        </div>
        <details className="workflow-preview" open={!!manualCopy}><summary><MessageCircle size={15} />Conferir mensagem</summary><p>{preview}</p></details>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {manualCopy && <label className="field-label">Texto da mensagem para copiar<textarea readOnly value={manualCopy} rows={7} onFocus={(e) => e.currentTarget.select()} /></label>}
        {error && <p className="payment-error" role="alert">{error}</p>}
        {!order.whatsapp_opt_in && <small className="fine-print">O cliente não autorizou avisos automáticos no WhatsApp. Use o atendimento manual apenas para tratar desta compra.</small>}
      </>}
    </section>
  );
}
