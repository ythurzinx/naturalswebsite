"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { Upload, FileSpreadsheet, ShieldCheck, CheckCircle2, RefreshCw, ArrowRight, Coins } from "lucide-react";

type Api = <T>(path: string, method?: string, body?: Record<string, unknown>) => Promise<T>;
type Options = {
  costColumn: number | null; nameColumn: number | null; idColumn: number | null; codeColumn: number | null;
  bulkCostUnit: "kg" | "100g"; mode: "missing" | "replace";
};
type Preview = {
  columns: { index: number; label: string }[]; options: Options; sourceSha: string; rows: number;
  entries: { id: string; name: string; isBulk: boolean; beforeCostCents: number | null; costCents: number; line: number }[];
  issues: { line: number; name: string; reason: string }[];
  alreadyKnown: number; sameCost: number; fingerprint: string | null;
};
const currency = (cents: number | null) => cents === null ? "Sem custo" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const columns = [
  { id: "costColumn", label: "Coluna de custo" },
  { id: "nameColumn", label: "Nome do produto" },
  { id: "idColumn", label: "ID do site" },
  { id: "codeColumn", label: "Código do PDV ou código de barras" },
] as const;
export function AdminCostImport({ api, onApplied }: { api: Api; onApplied: () => void }) {
  const [fileBase64, setFileBase64] = useState(""), [fileName, setFileName] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null), [options, setOptions] = useState<Partial<Options>>({}),
    [validPreview, setValidPreview] = useState(false), [busy, setBusy] = useState(false),
    [error, setError] = useState(""), [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function inspect(data = fileBase64, settings = options) {
    if (!data) return;
    setBusy(true); setError(""); setNotice(""); setValidPreview(false);
    try {
      const result = await api<Preview>("costs/preview", "POST", { fileBase64: data, options: settings });
      setPreview(result); setOptions(result.options); setValidPreview(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível conferir o CSV."); }
    finally { setBusy(false); }
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setNotice(""); setPreview(null); setValidPreview(false); setFileBase64(""); setOptions({});
    if (file.size > 1024 * 1024 || !file.size) { setError("Escolha um CSV de até 1 MB."); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const data = btoa(binary);
      setFileBase64(data); setFileName(file.name);
      await inspect(data, {});
    } catch { setError("Não foi possível ler este arquivo."); }
    finally { setBusy(false); }
  }
  function change(patch: Partial<Options>) {
    setOptions({ ...options, ...patch }); setValidPreview(false); setNotice("");
  }
  async function apply() {
    if (!preview?.fingerprint || !validPreview || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ updated: number; skipped: number }>("costs/apply", "POST", {
        fileBase64, options, fingerprint: preview.fingerprint,
      });
      setNotice(`${result.updated} ${result.updated === 1 ? "produto atualizado" : "produtos atualizados"} com os custos do CSV. Os próximos pedidos usarão esses custos no cálculo do resultado.${result.skipped ? ` ${result.skipped} linhas ficaram para revisão.` : ""}`);
      setFileBase64(""); setPreview(null); setValidPreview(false); setFileName("");
      if (input.current) input.current.value = "";
      onApplied();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível importar os custos."); setValidPreview(false); }
    finally { setBusy(false); }
  }
  return (
    <section className="admin-cost-import">
      <div className="cost-import-intro admin-panel">
        <span className="cost-import-symbol"><Coins size={26} /></span>
        <div><span className="eyebrow">INFORMAÇÃO SÓ DA EQUIPE</span><h2>Custos reais. Resultado confiável.</h2>
          <p>Traga o CSV do seu PDV, confira as correspondências e aplique somente os custos. A loja usa esses valores no cálculo do lucro de cada venda.</p>
          <small><ShieldCheck size={14} />Custos ficam no banco protegido da loja e não aparecem para o cliente.</small>
        </div>
      </div>
      <div className="admin-panel cost-file-picker">
        <div className="cost-file-heading"><FileSpreadsheet size={24} /><div><h3>1. Escolha o arquivo do PDV</h3><p>CSV com a coluna Custo e o nome, ID ou código do produto. Até 1 MB.</p></div></div>
        <label className="cost-file-upload">
          <Upload size={20} /><strong>{fileName || "Escolher arquivo CSV"}</strong>
          <input ref={input} type="file" accept=".csv,text/csv,text/plain" disabled={busy} onChange={(e) => void choose(e)} aria-label="Arquivo CSV de custos" />
        </label>
        <p className="fine-print">A coluna de venda não é usada como custo. Produtos sem correspondência segura ficam separados para revisão.</p>
      </div>
      {error && <p className="payment-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status"><CheckCircle2 size={17} />{notice}</p>}
      {preview && <>
        <section className="admin-panel">
          <h3>2. Confira as colunas e a unidade</h3>
          <div className="cost-import-options">
            {columns.map(({ id, label }) => <label className="field-label" key={id}>{label}
              <select disabled={busy} value={options[id] ?? ""} onChange={(e) => change({ [id]: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">Não usar esta coluna</option>
                {preview.columns.map((c) => <option value={c.index} key={c.index}>{c.label}</option>)}
              </select>
            </label>)}
            <label className="field-label">Os custos a granel do CSV estão por
              <select value={options.bulkCostUnit} disabled={busy} onChange={(e) => change({ bulkCostUnit: e.target.value as Options["bulkCostUnit"] })}>
                <option value="kg">Quilograma (kg)</option><option value="100g">100 gramas (100 g)</option>
              </select><small>Produtos embalados continuam com custo por unidade.</small>
            </label>
            <label className="field-label">Como aplicar
              <select value={options.mode} disabled={busy} onChange={(e) => change({ mode: e.target.value as Options["mode"] })}>
                <option value="missing">Preencher somente custos vazios</option><option value="replace">Atualizar também custos já cadastrados</option>
              </select>
            </label>
          </div>
          {!validPreview && <p className="privacy-note">As opções mudaram. Confira a prévia novamente antes de aplicar.</p>}
          <button type="button" className="button button-outline" disabled={busy} onClick={() => void inspect()}><RefreshCw size={16} />{busy ? "Conferindo…" : "Conferir arquivo"}</button>
        </section>
        <section className="admin-panel">
          <div className="cost-preview-heading"><div><span className="eyebrow">CONFIRA ANTES DE APLICAR</span><h3>3. Prévia dos custos</h3></div><span>{preview.rows} linhas no arquivo</span></div>
          <div className="cost-import-counts"><span><strong>{preview.entries.length}</strong> produtos para atualizar</span><span><strong>{preview.alreadyKnown + preview.sameCost}</strong> custos preservados</span><span><strong>{preview.issues.length}</strong> linhas para revisar</span></div>
          {!!preview.entries.length && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produto</th><th>Custo atual</th><th>Novo custo</th></tr></thead><tbody>
            {preview.entries.slice(0, 50).map((entry) => <tr key={entry.id}><td><strong>{entry.name}</strong><small className="cost-unit-label">{entry.id} · por {entry.isBulk ? "kg" : "unidade"}</small></td><td>{currency(entry.beforeCostCents)}</td><td><strong>{currency(entry.costCents)}</strong></td></tr>)}
          </tbody></table></div>}
          {preview.entries.length > 50 && <p className="fine-print">Mostrando 50 de {preview.entries.length} produtos. Todos os produtos conferidos serão incluídos na importação.</p>}
          {!!preview.issues.length && <details className="cost-import-issues"><summary>Ver linhas para revisar ({preview.issues.length})</summary><ul>{preview.issues.slice(0, 60).map((issue, i) => <li key={i}><strong>{issue.line ? `Linha ${issue.line} · ` : ""}{issue.name || "Sem identificação"}</strong><span>{issue.reason}</span></li>)}</ul>{preview.issues.length > 60 && <p>Mostrando as primeiras 60 ocorrências.</p>}</details>}
          <div className="cost-apply-bar"><p>Atualiza os custos dos produtos conferidos. Vendas anteriores mantêm os custos registrados na compra.</p><button type="button" className="button" disabled={busy || !validPreview || !preview.fingerprint || !preview.entries.length} onClick={() => void apply()}>{busy ? "Aplicando…" : `Aplicar custos a ${preview.entries.length} produtos`}<ArrowRight size={16} /></button></div>
        </section>
      </>}
    </section>
  );
}
