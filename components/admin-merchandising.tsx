"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Save,
  Trash2,
  Copy,
  Tag,
  Package,
  RefreshCw,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/products";
import { allocateCombo } from "@/lib/merchandising.mjs";
import { portionPriceCents, referencePriceCents } from "@/lib/pricing.mjs";

type Ingredient = { productId: string; weight: number };
type Combo = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  discountPercent: number;
  components: Ingredient[];
};
type Offer = {
  productId: string;
  active: boolean;
  discountPercent: number;
  startsAt: number | null;
  endsAt: number | null;
};
type Settings = { revision: number; combos: Combo[]; offers: Offer[] };
type AdminProduct = Product & { active: boolean; costCents: number | null };
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
function localDate(value: number | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(value - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function AdminMerchandising({ api }: { api: Api }) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [products, setProducts] = useState<AdminProduct[]>([]),
    [mode, setMode] = useState("combos"),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        settings: Settings;
        products: AdminProduct[];
      }>("merchandising");
      setSettings(result.settings);
      setProducts(result.products);
      setSelected(result.settings.combos[0]?.id || "");
      setDirty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar as ofertas.",
      );
    } finally {
      setBusy(false);
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  function change(next: Settings) {
    setSettings(next);
    setDirty(true);
    setNotice("");
  }
  function changeCombo(value: Partial<Combo>) {
    if (settings)
      change({
        ...settings,
        combos: settings.combos.map((c) =>
          c.id === selected ? { ...c, ...value } : c,
        ),
      });
  }
  function changeOffer(index: number, value: Partial<Offer>) {
    if (settings)
      change({
        ...settings,
        offers: settings.offers.map((o, i) =>
          i === index ? { ...o, ...value } : o,
        ),
      });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ settings: Settings }>("merchandising", "PUT", {
        ...settings,
      });
      setSettings(result.settings);
      setDirty(false);
      setNotice(
        "Vitrine atualizada. Os preços já são usados no catálogo, nos combos e no checkout.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const bulk = products.filter((p) => p.isGranel);
  const lookup = new Map(products.map((p) => [p.id, p]));
  const combo = settings?.combos.find((c) => c.id === selected);
  let preview: { originalCents: number; totalCents: number } | null = null,
    cost: number | null = null;
  if (combo)
    try {
      preview = allocateCombo(
        combo.components.map((c) => ({
          regularCents: portionPriceCents(lookup.get(c.productId)!, c.weight),
        })),
        combo.discountPercent,
      );
      if (
        combo.components.every(
          (c) => lookup.get(c.productId)?.costCents != null,
        )
      )
        cost = combo.components.reduce(
          (sum, c) =>
            sum +
            Math.round((lookup.get(c.productId)!.costCents! * c.weight) / 1000),
          0,
        );
    } catch {}
  const productOptions = (list: AdminProduct[]) =>
    list.map((p) => (
      <option key={p.id} value={p.id}>
        {p.active ? "" : "[Inativo] "}
        {p.nome_produto} · {formatPrice(referencePriceCents(p) / 100)}
        {p.isGranel ? "/100 g" : "/un."}
      </option>
    ));
  return (
    <form className="admin-merchandising" onSubmit={save}>
      <div className="admin-card merchandising-intro">
        <div>
          <span className="eyebrow">SUA VITRINE, DO SEU JEITO</span>
          <h2>Ofertas e combos</h2>
          <p>
            Os combos começam com a soma dos ingredientes. Você escolhe os
            descontos, os pesos e o que aparece no site.
          </p>
        </div>
        <div className="admin-toolbar-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={busy || dirty}
            onClick={() => void load()}
          >
            <RefreshCw size={16} /> Recarregar
          </button>
          <button className="button" disabled={busy || !settings || !dirty}>
            <Save size={16} /> {busy ? "Salvando…" : "Publicar alterações"}
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
          Alterações ainda não publicadas. Use “Publicar alterações” para
          atualizar a loja.
        </p>
      )}
      <div className="filter-chips merch-mode">
        <button
          type="button"
          className={`filter-chip ${mode === "combos" ? "active" : ""}`}
          aria-pressed={mode === "combos"}
          onClick={() => setMode("combos")}
        >
          <Package size={16} /> Combos ({settings?.combos.length || 0})
        </button>
        <button
          type="button"
          className={`filter-chip ${mode === "offers" ? "active" : ""}`}
          aria-pressed={mode === "offers"}
          onClick={() => setMode("offers")}
        >
          <Tag size={16} /> Ofertas individuais ({settings?.offers.length || 0})
        </button>
      </div>
      <fieldset disabled={busy || !settings} className="checkout-fieldset">
        {mode === "combos" && settings && (
          <div className="combo-editor-layout">
            <aside className="admin-card combo-selector">
              <h3>Seus combos</h3>
              {settings.combos.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={selected === c.id ? "selected" : ""}
                  onClick={() => setSelected(c.id)}
                >
                  <strong>{c.name}</strong>
                  <span>
                    {c.active ? "Ativo" : "Rascunho"} · {c.components.length}{" "}
                    itens
                    {c.discountPercent > 0
                      ? ` · ${c.discountPercent}% de desconto`
                      : ""}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="button button-outline"
                disabled={settings.combos.length >= 12 || bulk.length < 2}
                onClick={() => {
                  const id = `combo-${crypto.randomUUID()}`;
                  change({
                    ...settings,
                    combos: [
                      ...settings.combos,
                      {
                        id,
                        name: "Novo combo",
                        description: "",
                        active: false,
                        discountPercent: 0,
                        components: bulk
                          .slice(0, 2)
                          .map((p) => ({ productId: p.id, weight: 100 })),
                      },
                    ],
                  });
                  setSelected(id);
                }}
              >
                <Plus size={16} /> Criar combo
              </button>
            </aside>
            {combo ? (
              <div className="admin-card combo-editor">
                <div className="admin-section-title">
                  <h3>Editar combo</h3>
                  <label className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={combo.active}
                      onChange={(e) =>
                        changeCombo({ active: e.target.checked })
                      }
                    />{" "}
                    Exibir na loja
                  </label>
                </div>
                <label className="field-label">
                  Nome do combo
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    value={combo.name}
                    onChange={(e) => changeCombo({ name: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  Descrição
                  <textarea
                    maxLength={400}
                    rows={3}
                    value={combo.description}
                    onChange={(e) =>
                      changeCombo({ description: e.target.value })
                    }
                    placeholder="Conte o que vem no combo. Os ingredientes são embalados separadamente."
                  />
                </label>
                <h4>Ingredientes e porções</h4>
                {combo.components.map((c, index) => (
                  <div className="combo-ingredient-editor" key={index}>
                    <label className="field-label">
                      Ingrediente {index + 1}
                      <select
                        aria-label={`Ingrediente ${index + 1}`}
                        value={c.productId}
                        onChange={(e) =>
                          changeCombo({
                            components: combo.components.map((v, i) =>
                              i === index
                                ? { ...v, productId: e.target.value }
                                : v,
                            ),
                          })
                        }
                      >
                        {productOptions(bulk)}
                      </select>
                    </label>
                    <label className="field-label">
                      Peso (g)
                      <input
                        aria-label={`Peso do ingrediente ${index + 1} em gramas`}
                        type="number"
                        min={100}
                        max={5000}
                        step={100}
                        required
                        value={c.weight}
                        onChange={(e) =>
                          changeCombo({
                            components: combo.components.map((v, i) =>
                              i === index
                                ? { ...v, weight: Number(e.target.value) }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Retirar ingrediente ${index + 1}`}
                      disabled={combo.components.length <= 2}
                      onClick={() =>
                        changeCombo({
                          components: combo.components.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  disabled={
                    combo.components.length >= 8 ||
                    !bulk.some(
                      (p) =>
                        !combo.components.some((c) => c.productId === p.id),
                    )
                  }
                  onClick={() => {
                    const p = bulk.find(
                      (p) =>
                        !combo.components.some((c) => c.productId === p.id),
                    );
                    if (p)
                      changeCombo({
                        components: [
                          ...combo.components,
                          { productId: p.id, weight: 100 },
                        ],
                      });
                  }}
                >
                  <Plus size={15} /> Adicionar ingrediente
                </button>
                <label className="field-label combo-discount">
                  Desconto no combo (%)
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step={1}
                    required
                    value={combo.discountPercent}
                    onChange={(e) =>
                      changeCombo({ discountPercent: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="combo-price-preview" aria-live="polite">
                  {preview ? (
                    <>
                      <span>
                        Soma dos ingredientes{" "}
                        <strong>
                          {formatPrice(preview.originalCents / 100)}
                        </strong>
                      </span>
                      <span>
                        Preço do combo{" "}
                        <strong>{formatPrice(preview.totalCents / 100)}</strong>
                      </span>
                      <span>
                        Economia do cliente{" "}
                        <strong>
                          {formatPrice(
                            (preview.originalCents - preview.totalCents) / 100,
                          )}
                        </strong>
                      </span>
                      <p>
                        {cost !== null
                          ? `Margem bruta estimada: ${formatPrice((preview.totalCents - cost) / 100)}, antes de taxas, frete e despesas.`
                          : "Cadastre os custos dos ingredientes para calcular a margem bruta estimada."}
                      </p>
                    </>
                  ) : (
                    <p>
                      Revise os ingredientes, os pesos e o desconto para
                      visualizar o preço.
                    </p>
                  )}
                </div>
                {combo.components.some(
                  (c) => !lookup.get(c.productId)?.active,
                ) && (
                  <p className="payment-error">
                    Há um ingrediente inativo. Este combo fica fora da vitrine
                    até todos estarem ativos.
                  </p>
                )}
                <p className="fine-print">
                  Não há soma de descontos: o combo usa os preços regulares dos
                  ingredientes. Alterar um preço de ingrediente atualiza
                  automaticamente o combo. Limite de 8 ingredientes, até 20 kg
                  no total.
                </p>
                <div className="combo-editor-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={settings.combos.length >= 12}
                    onClick={() => {
                      const copy = {
                        ...combo,
                        id: `combo-${crypto.randomUUID()}`,
                        name: `${combo.name.slice(0, 88)} (cópia)`,
                        active: false,
                      };
                      change({
                        ...settings,
                        combos: [...settings.combos, copy],
                      });
                      setSelected(copy.id);
                    }}
                  >
                    <Copy size={15} /> Duplicar como rascunho
                  </button>
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => {
                      change({
                        ...settings,
                        combos: settings.combos.filter(
                          (c) => c.id !== combo.id,
                        ),
                      });
                      setSelected(
                        settings.combos.find((c) => c.id !== combo.id)?.id ||
                          "",
                      );
                    }}
                  >
                    <Trash2 size={15} /> Remover combo
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-card">
                <h3>Monte seu primeiro combo</h3>
                <p>
                  Escolha dois ou mais ingredientes a granel e defina as
                  porções.
                </p>
              </div>
            )}
          </div>
        )}
        {mode === "offers" && settings && (
          <div className="admin-card offer-editor">
            <h3>Carrossel de produtos com desconto</h3>
            <p className="fine-print">
              Apenas ofertas ativas e dentro do período aparecem na loja. Deixe
              as datas vazias para não limitar o período. Todos os horários usam
              o fuso do seu aparelho.
            </p>
            {!settings.offers.length && (
              <p>
                Nenhuma oferta cadastrada. Você decide quais produtos e
                descontos publicar.
              </p>
            )}
            {settings.offers.map((offer, index) => {
              const p = lookup.get(offer.productId);
              const price = p ? referencePriceCents(p) : 0;
              return (
                <div className="offer-editor-row" key={index}>
                  <label className="field-label">
                    Produto em oferta
                    <select
                      aria-label={`Produto da oferta ${index + 1}`}
                      value={offer.productId}
                      onChange={(e) =>
                        changeOffer(index, { productId: e.target.value })
                      }
                    >
                      {productOptions(products)}
                    </select>
                  </label>
                  <div className="form-row">
                    <label className="field-label">
                      Desconto (%)
                      <input
                        type="number"
                        min={offer.active ? 1 : 0}
                        max={80}
                        step={1}
                        required={offer.active}
                        value={offer.discountPercent}
                        onChange={(e) =>
                          changeOffer(index, {
                            discountPercent: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <p className="offer-price-preview">
                      De <del>{formatPrice(price / 100)}</del>
                      <strong>
                        por{" "}
                        {formatPrice(
                          Math.round(
                            (price * (100 - offer.discountPercent)) / 100,
                          ) / 100,
                        )}
                      </strong>
                      <small>{p?.isGranel ? "por 100 g" : "por unidade"}</small>
                    </p>
                  </div>
                  <div className="form-row">
                    <label className="field-label">
                      Início (opcional)
                      <input
                        type="datetime-local"
                        value={localDate(offer.startsAt)}
                        onChange={(e) =>
                          changeOffer(index, {
                            startsAt: e.target.value
                              ? new Date(e.target.value).getTime()
                              : null,
                          })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Fim (opcional)
                      <input
                        type="datetime-local"
                        value={localDate(offer.endsAt)}
                        onChange={(e) =>
                          changeOffer(index, {
                            endsAt: e.target.value
                              ? new Date(e.target.value).getTime()
                              : null,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="admin-section-title">
                    <label className="admin-toggle">
                      <input
                        type="checkbox"
                        checked={offer.active}
                        onChange={(e) =>
                          changeOffer(index, { active: e.target.checked })
                        }
                      />{" "}
                      Oferta ativa
                    </label>
                    <button
                      type="button"
                      className="text-button danger"
                      aria-label={`Remover oferta ${index + 1}`}
                      onClick={() =>
                        change({
                          ...settings,
                          offers: settings.offers.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 size={16} /> Remover
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="button button-outline"
              disabled={
                settings.offers.length >= 24 ||
                !products.some(
                  (p) => !settings.offers.some((o) => o.productId === p.id),
                )
              }
              onClick={() => {
                const p = products.find(
                  (p) => !settings.offers.some((o) => o.productId === p.id),
                );
                if (p)
                  change({
                    ...settings,
                    offers: [
                      ...settings.offers,
                      {
                        productId: p.id,
                        active: false,
                        discountPercent: 0,
                        startsAt: null,
                        endsAt: null,
                      },
                    ],
                  });
              }}
            >
              <Plus size={16} /> Adicionar oferta
            </button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
