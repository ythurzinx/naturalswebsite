"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, TicketPercent, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/products";

type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
type Coupon = {
  code: string;
  percent: number;
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  minSubtotalCents: number;
  maxUses: number | null;
  onePerCustomer: boolean;
  note: string;
  createdAt: number;
  current: boolean;
  usage: { paidUses: number; paidDiscountCents: number; pendingUses: number };
};
const empty = {
  code: "",
  percent: "10",
  startsAt: "",
  endsAt: "",
  minSubtotal: "",
  maxUses: "",
  onePerCustomer: false,
  note: "",
};
const dateTime = (value: number) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
function moneyCents(value: string) {
  const clean = value.trim().replace(/\./g, "").replace(",", ".");
  if (!clean) return 0;
  const number = Number(clean);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}
function status(coupon: Coupon) {
  if (!coupon.active) return "Desativado";
  if (coupon.current) return "Valendo agora";
  if (coupon.startsAt && coupon.startsAt > Date.now()) return "Agendado";
  return "Fora da validade";
}
export function AdminCoupons({ api }: { api: Api }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]),
    [form, setForm] = useState(empty),
    [busy, setBusy] = useState(""),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setCoupons((await api<{ coupons: Coupon[] }>("coupons")).coupons);
      setLoaded(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar os cupons.",
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      setNotice(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    const minSubtotalCents = moneyCents(form.minSubtotal);
    if (!Number.isSafeInteger(minSubtotalCents) || minSubtotalCents < 0) {
      setError("Revise o valor mínimo da compra.");
      return;
    }
    await run("create", async () => {
      const result = await api<{ coupons: Coupon[] }>("coupons", "POST", {
        code: form.code,
        percent: Number(form.percent),
        startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).getTime() : null,
        minSubtotalCents,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        onePerCustomer: form.onePerCustomer,
        note: form.note,
        active: true,
      });
      setCoupons(result.coupons);
      setForm(empty);
      return `Cupom ${form.code.trim().toUpperCase()} criado e ativo.`;
    });
  }
  async function toggle(coupon: Coupon) {
    await run(coupon.code, async () => {
      const result = await api<{ coupons: Coupon[] }>(
        `coupons/${encodeURIComponent(coupon.code)}`,
        "PATCH",
        { active: !coupon.active },
      );
      setCoupons(result.coupons);
      return coupon.active
        ? `Cupom ${coupon.code} desativado. Ele deixa de valer no site imediatamente.`
        : `Cupom ${coupon.code} reativado.`;
    });
  }
  async function remove(coupon: Coupon) {
    if (
      !window.confirm(
        `Excluir o cupom ${coupon.code}? Os pedidos que já usaram o cupom continuam registrados.`,
      )
    )
      return;
    await run(coupon.code, async () => {
      const result = await api<{ coupons: Coupon[] }>(
        `coupons/${encodeURIComponent(coupon.code)}`,
        "DELETE",
      );
      setCoupons(result.coupons);
      return `Cupom ${coupon.code} excluído.`;
    });
  }
  const set = (patch: Partial<typeof empty>) =>
    setForm((current) => ({ ...current, ...patch }));
  return (
    <div className="admin-coupons">
      <div className="admin-card merchandising-intro">
        <div>
          <span className="eyebrow">PROMOÇÕES COM CÓDIGO</span>
          <h2>Cupons de desconto</h2>
          <p>
            O cliente digita o código ao finalizar a compra. O desconto vale
            para produtos e combos, nunca para o frete, e não se soma a uma
            oferta maior: o item fica com o menor preço. O servidor confere o
            cupom de novo antes do pagamento.
          </p>
        </div>
        <div className="admin-toolbar-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={!!busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} /> Recarregar
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
      <form className="admin-card coupon-create" onSubmit={create}>
        <h3>
          <TicketPercent size={19} /> Criar cupom
        </h3>
        <div className="form-row">
          <label className="field-label">
            Código
            <input
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,23}"
              title="De 3 a 24 letras sem acento, números, hífen ou sublinhado"
              autoCapitalize="characters"
              value={form.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              placeholder="INAUGURA10"
            />
          </label>
          <label className="field-label">
            Desconto (%)
            <input
              type="number"
              required
              min={1}
              max={80}
              step={1}
              value={form.percent}
              onChange={(e) => set({ percent: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field-label">
            Início (opcional)
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set({ startsAt: e.target.value })}
            />
          </label>
          <label className="field-label">
            Fim (opcional)
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set({ endsAt: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field-label">
            Compra mínima em produtos (R$, opcional)
            <input
              inputMode="decimal"
              value={form.minSubtotal}
              onChange={(e) => set({ minSubtotal: e.target.value })}
              placeholder="0,00"
            />
          </label>
          <label className="field-label">
            Limite total de usos (opcional)
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              value={form.maxUses}
              onChange={(e) => set({ maxUses: e.target.value })}
              placeholder="Sem limite"
            />
          </label>
        </div>
        <label className="field-label">
          Anotação interna (opcional)
          <input
            maxLength={80}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Ex.: inauguração da loja online"
          />
        </label>
        <label className="admin-toggle">
          <input
            type="checkbox"
            checked={form.onePerCustomer}
            onChange={(e) => set({ onePerCustomer: e.target.checked })}
          />
          Um uso por e-mail de cliente
        </label>
        <p className="fine-print">
          Os horários usam o fuso do seu aparelho. Sem datas, o cupom vale até
          você desativar. Um uso conta quando o pagamento é aprovado ou enquanto
          o pagamento ainda pode ser concluído (até 24 horas).
        </p>
        <button className="button" disabled={!!busy}>
          <Plus size={16} />
          {busy === "create" ? "Criando…" : "Criar cupom"}
        </button>
      </form>
      <div className="admin-card">
        <h3>Cupons cadastrados</h3>
        {loaded && !coupons.length && (
          <p className="fine-print">Nenhum cupom cadastrado ainda.</p>
        )}
        {coupons.map((coupon) => (
          <div className="coupon-row" key={coupon.code}>
            <div className="coupon-row-main">
              <strong className="coupon-code">{coupon.code}</strong>
              <span
                className={`coupon-status ${coupon.current ? "on" : "off"}`}
              >
                {status(coupon)}
              </span>
              <p>
                {coupon.percent}% de desconto
                {coupon.minSubtotalCents > 0 &&
                  ` · compra mínima de ${formatPrice(coupon.minSubtotalCents / 100)}`}
                {coupon.maxUses ? ` · até ${coupon.maxUses} usos` : ""}
                {coupon.onePerCustomer ? " · 1 uso por e-mail" : ""}
              </p>
              <p className="fine-print">
                {coupon.startsAt
                  ? `De ${dateTime(coupon.startsAt)}`
                  : "Sem data de início"}
                {coupon.endsAt
                  ? ` até ${dateTime(coupon.endsAt)}`
                  : " · sem data de fim"}
                {coupon.note ? ` · ${coupon.note}` : ""}
              </p>
              <p className="coupon-usage">
                {coupon.usage.paidUses}{" "}
                {coupon.usage.paidUses === 1 ? "uso pago" : "usos pagos"} ·{" "}
                {formatPrice(coupon.usage.paidDiscountCents / 100)} em descontos
                {coupon.usage.pendingUses > 0 &&
                  ` · ${coupon.usage.pendingUses} aguardando pagamento`}
              </p>
            </div>
            <div className="coupon-row-actions">
              <button
                type="button"
                className="button button-outline"
                disabled={!!busy}
                onClick={() => void toggle(coupon)}
              >
                {coupon.active ? "Desativar" : "Ativar"}
              </button>
              <button
                type="button"
                className="text-button danger"
                disabled={!!busy}
                onClick={() => void remove(coupon)}
                aria-label={`Excluir cupom ${coupon.code}`}
              >
                <Trash2 size={15} /> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
