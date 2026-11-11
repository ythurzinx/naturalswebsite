"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Truck, Calculator, Save } from "lucide-react";
import { formatPrice } from "@/lib/products";
import type { ShippingSettings } from "@/lib/shipping-context";
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
export function AdminShippingSettings({ api }: { api: Api }) {
  const [value, setValue] = useState<ShippingSettings | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    originPostalCode: "",
    rate: "",
    base: "",
    minimum: "",
    radius: "",
    free: "",
    enabled: false,
  });
  const [sampleKm, setSampleKm] = useState("3"),
    [sampleTotal, setSampleTotal] = useState("100");
  const load = useCallback(async () => {
    try {
      const result = await api<ShippingSettings>("shipping");
      setValue(result);
      setDraft({
        originPostalCode: result.originPostalCode,
        rate: (result.pricePerKmCents / 100).toFixed(2),
        base: (result.baseFeeCents / 100).toFixed(2),
        minimum: (result.minimumFeeCents / 100).toFixed(2),
        radius: String(result.maxDistanceMeters / 1000),
        free:
          result.freeAboveCents === null
            ? ""
            : (result.freeAboveCents / 100).toFixed(2),
        enabled: result.enabled,
      });
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o frete.",
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const parse = (v: string) => {
    const raw = v.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
      throw Error("Use valores positivos com até duas casas decimais.");
    return Math.round(Number(raw) * 100);
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<ShippingSettings>("shipping", "PUT", {
        enabled: draft.enabled,
        originPostalCode: draft.originPostalCode,
        pricePerKmCents: parse(draft.rate),
        baseFeeCents: parse(draft.base),
        minimumFeeCents: parse(draft.minimum),
        maxDistanceMeters: parse(draft.radius) * 10,
        freeAboveCents: draft.free.trim() ? parse(draft.free) : null,
        revision: value.revision,
      });
      setValue(result);
      setNotice(
        "Frete salvo. Carrinho e checkout passam a usar a nova regra; pedidos já criados mantêm o valor original.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  const numeric = (v: string) => Number(v.replace(",", "."));
  const km = numeric(sampleKm),
    subtotal = numeric(sampleTotal);
  const sampleFee =
    draft.free && subtotal >= numeric(draft.free)
      ? 0
      : Math.max(
          numeric(draft.minimum),
          numeric(draft.base) + numeric(draft.rate) * km,
        );
  const field = (
    key: keyof typeof draft,
    label: string,
    placeholder = "0,00",
  ) => (
    <label className="field-label">
      {label}
      <input
        inputMode="decimal"
        required={key !== "free"}
        value={String(draft[key])}
        placeholder={placeholder}
        onChange={(e) =>
          setDraft((prior) => ({ ...prior, [key]: e.target.value }))
        }
      />
    </label>
  );
  return (
    <div className="admin-shipping-grid">
      <form className="admin-card" onSubmit={save}>
        <span className="eyebrow">LOGÍSTICA DA LOJA</span>
        <h2>
          <Truck size={24} /> Frete por quilômetro
        </h2>
        <p>
          Distância aproximada, em linha reta entre as coordenadas dos CEPs.
          Consulta pela BrasilAPI, sem chave de mapas paga.
        </p>
        <fieldset disabled={busy || !value} className="checkout-fieldset">
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) =>
                setDraft((prior) => ({ ...prior, enabled: e.target.checked }))
              }
            />{" "}
            Habilitar entrega com pagamento online
          </label>
          <label className="field-label">
            CEP de origem da loja
            <input
              inputMode="numeric"
              maxLength={9}
              placeholder="00000-000"
              required={draft.enabled}
              value={draft.originPostalCode}
              onChange={(e) =>
                setDraft((prior) => ({
                  ...prior,
                  originPostalCode: e.target.value.replace(/[^\d-]/g, ""),
                }))
              }
            />
          </label>
          <div className="form-row">
            {field("rate", "Valor por km (R$)")}
            {field("base", "Taxa base (R$)")}
          </div>
          <div className="form-row">
            {field("minimum", "Frete mínimo (R$)")}
            {field("radius", "Distância máxima (km)", "10")}
          </div>
          {field(
            "free",
            "Frete grátis a partir de (R$), opcional",
            "Deixe vazio para desativar",
          )}
          <p className="fine-print">
            Frete = maior valor entre o mínimo e a taxa base + distância × valor
            por km. O limite de distância vale também para frete grátis.
            Cotações expiram após 10 minutos e são recalculadas quando a regra
            muda.
          </p>
          <button className="button" disabled={busy || !value}>
            <Save size={17} />
            {busy
              ? "Validando CEP e salvando…"
              : "Salvar configuração do frete"}
          </button>
        </fieldset>
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => void load()}
        >
          Recarregar configuração salva
        </button>
      </form>
      <aside className="admin-card shipping-simulator">
        <span className="eyebrow">PRÉVIA DA REGRA</span>
        <h2>
          <Calculator size={22} /> Simular frete
        </h2>
        <p>Use este exemplo para conferir as taxas antes de salvar.</p>
        <label className="field-label">
          Distância estimada (km)
          <input
            inputMode="decimal"
            value={sampleKm}
            onChange={(e) => setSampleKm(e.target.value)}
          />
        </label>
        <label className="field-label">
          Subtotal dos produtos (R$)
          <input
            inputMode="decimal"
            value={sampleTotal}
            onChange={(e) => setSampleTotal(e.target.value)}
          />
        </label>
        <strong className="shipping-sample-price">
          {!draft.enabled
            ? "Entrega desativada"
            : !Number.isFinite(sampleFee) || km < 0 || subtotal < 0
              ? "Revise os valores"
              : km > numeric(draft.radius)
                ? "Fora da área atendida"
                : formatPrice(Math.round(sampleFee * 100) / 100)}
        </strong>
        <p className="fine-print">
          Simulação da configuração em edição. Para o lucro refletir o resultado
          da venda, registre também o custo real do entregador em cada pedido.
        </p>
        <p className="admin-notice">
          CEPs genéricos ou sem coordenadas exigem atendimento. A loja deve
          conferir a área atendida e combinar o prazo com o cliente.
        </p>
      </aside>
    </div>
  );
}
