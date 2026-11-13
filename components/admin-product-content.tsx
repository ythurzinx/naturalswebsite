"use client";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Save, Plus, Trash2 } from "lucide-react";
import type { Product, ProductContent } from "@/lib/types";
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
type Value = { content: ProductContent; revision: number };
export function AdminProductContent({
  api,
  initialId = "",
}: {
  api: Api;
  initialId?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]),
    [id, setId] = useState(initialId),
    [search, setSearch] = useState(""),
    [value, setValue] = useState<Value | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    api<{ products: Product[] }>("content-products")
      .then((d) => {
        if (!active) return;
        setProducts(d.products);
        if (!id)
          setId(
            d.products.find((p) => p.isGranel)?.id || d.products[0]?.id || "",
          );
      })
      .catch(() => setError("Não foi possível carregar os produtos."));
    return () => {
      active = false;
    };
  }, [api]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setValue(null);
    setError("");
    setNotice("");
    api<Value>(`product-content/${id}`)
      .then((d) => {
        if (active) setValue(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, api]);
  function update(patch: Partial<ProductContent>) {
    setValue((v) => (v ? { ...v, content: { ...v.content, ...patch } } : null));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setValue(
        await api<Value>(`product-content/${id}`, "PUT", {
          ...value,
          content: {
            ...value.content,
            highlights: value.content.highlights
              .map((s) => s.trim())
              .filter(Boolean),
            notes: value.content.notes.map((s) => s.trim()).filter(Boolean),
            recipe: value.content.recipe
              ? {
                  ...value.content.recipe,
                  ingredients: value.content.recipe.ingredients
                    .map((s) => s.trim())
                    .filter(Boolean),
                  steps: value.content.recipe.steps
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : null,
          },
        }),
      );
      setNotice("Informações e receita publicadas na ficha do produto.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const c = value?.content,
    filtered = products.filter(
      (p) =>
        p.id === id ||
        p.nome_produto
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    );
  return (
    <section className="admin-content-editor">
      <div className="section-heading">
        <div>
          <span className="eyebrow">AJUDE O CLIENTE A ESCOLHER</span>
          <h2>Conteúdo e receitas</h2>
          <p>
            Edite a descrição, os destaques, as orientações e a receita de cada
            produto.
          </p>
        </div>
        <BookOpen size={28} />
      </div>
      <div className="admin-panel content-product-picker">
        <label className="field-label">
          Encontrar produto
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite o nome do produto"
          />
        </label>
        <label className="field-label">
          Produto para editar informações
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_produto} · {p.id}
              </option>
            ))}
          </select>
        </label>
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
      {!c && id && <p role="status">Carregando a ficha…</p>}
      {c && (
        <form onSubmit={save} className="admin-panel">
          <fieldset disabled={busy} className="checkout-fieldset">
            <label className="field-label">
              Finalidade do produto
              <select
                value={c.kind}
                onChange={(e) =>
                  update({
                    kind: e.target.value as ProductContent["kind"],
                    ...(e.target.value !== "food" ? { recipe: null } : {}),
                  })
                }
              >
                <option value="food">Ingrediente de uso alimentar</option>
                <option value="herbal">Botânico: orientação específica</option>
                <option value="supplement">Suplemento: seguir rotulagem</option>
                <option value="external">Uso externo ou não alimentício</option>
              </select>
            </label>
            <label className="field-label">
              Descrição completa
              <textarea
                required
                minLength={20}
                maxLength={1200}
                rows={4}
                value={c.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label className="field-label">
              Benefícios e características (um por linha, até 6)
              <textarea
                rows={4}
                maxLength={1320}
                value={c.highlights.join("\n")}
                onChange={(e) =>
                  update({ highlights: e.target.value.split("\n") })
                }
              />
            </label>
            <label className="field-label">
              Como usar
              <textarea
                required
                maxLength={1000}
                rows={3}
                value={c.usage}
                onChange={(e) => update({ usage: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label className="field-label">
                Como conservar
                <textarea
                  required
                  maxLength={600}
                  rows={3}
                  value={c.storage}
                  onChange={(e) => update({ storage: e.target.value })}
                />
              </label>
              <label className="field-label">
                Ingredientes e alergênicos
                <textarea
                  required
                  maxLength={600}
                  rows={3}
                  value={c.allergens}
                  onChange={(e) => update({ allergens: e.target.value })}
                />
              </label>
            </div>
            <label className="field-label">
              Cuidados adicionais (um por linha)
              <textarea
                rows={3}
                maxLength={1800}
                value={c.notes.join("\n")}
                onChange={(e) =>
                  update({
                    notes: e.target.value ? e.target.value.split("\n") : [],
                  })
                }
              />
            </label>
            <div className="content-recipe-editor">
              <h3>Receita culinária</h3>
              {c.kind !== "food" ? (
                <p className="fine-print">
                  Para este tipo de produto, publique orientações de uso em vez
                  de uma receita de ingestão.
                </p>
              ) : c.recipe ? (
                <>
                  <label className="field-label">
                    Nome da receita
                    <input
                      required
                      maxLength={120}
                      value={c.recipe.title}
                      onChange={(e) =>
                        update({
                          recipe: { ...c.recipe!, title: e.target.value },
                        })
                      }
                    />
                  </label>
                  <div className="form-row">
                    <label className="field-label">
                      Tempo aproximado (minutos)
                      <input
                        required
                        type="number"
                        min={1}
                        max={1440}
                        value={c.recipe.minutes}
                        onChange={(e) =>
                          update({
                            recipe: {
                              ...c.recipe!,
                              minutes: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Rendimento
                      <input
                        required
                        maxLength={80}
                        value={c.recipe.servings}
                        onChange={(e) =>
                          update({
                            recipe: { ...c.recipe!, servings: e.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    Ingredientes (um por linha)
                    <textarea
                      rows={6}
                      value={c.recipe.ingredients.join("\n")}
                      onChange={(e) =>
                        update({
                          recipe: {
                            ...c.recipe!,
                            ingredients: e.target.value.split("\n"),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Modo de preparo (uma etapa por linha)
                    <textarea
                      rows={6}
                      value={c.recipe.steps.join("\n")}
                      onChange={(e) =>
                        update({
                          recipe: {
                            ...c.recipe!,
                            steps: e.target.value.split("\n"),
                          },
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => update({ recipe: null })}
                  >
                    Remover receita desta ficha
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button button-small button-outline"
                  onClick={() =>
                    update({
                      recipe: {
                        title: "",
                        minutes: 15,
                        servings: "2 porções",
                        ingredients: [""],
                        steps: [""],
                      },
                    })
                  }
                >
                  <Plus size={16} />
                  Adicionar receita
                </button>
              )}
            </div>
            <h3>Fontes de referência</h3>
            {c.sources.map((s, i) => (
              <div className="content-source-row" key={i}>
                <label className="field-label">
                  Título da fonte
                  <input
                    maxLength={120}
                    value={s.title}
                    onChange={(e) =>
                      update({
                        sources: c.sources.map((v, j) =>
                          j === i ? { ...v, title: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Link da fonte
                  <input
                    type="url"
                    maxLength={1000}
                    value={s.url}
                    onChange={(e) =>
                      update({
                        sources: c.sources.map((v, j) =>
                          j === i ? { ...v, url: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover fonte ${i + 1}`}
                  onClick={() =>
                    update({ sources: c.sources.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {c.sources.length < 6 && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  update({ sources: [...c.sources, { title: "", url: "" }] })
                }
              >
                Adicionar referência
              </button>
            )}
            <p className="fine-print">
              Use informações verificáveis e confirme a composição do lote.
              Evite promessas de cura, emagrecimento ou resultados garantidos. A
              ficha não substitui o rótulo.
            </p>
            <button className="button" disabled={busy}>
              <Save size={17} />
              {busy ? "Salvando…" : "Publicar informações e receita"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
