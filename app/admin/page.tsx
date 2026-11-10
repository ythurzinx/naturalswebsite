"use client";
import { FormEvent, useEffect, useState } from "react";
import ComboEditor from "@/components/combo-editor";
import ArtStudio from "@/components/art-studio";
import { ShopHeader, ShopFooter, money, post } from "@/components/shop-shell";
type Product = {
  id: string;
  name: string;
  category: string;
  weight: string;
  price: number;
  stock: number;
  active: number;
};
type Order = {
  id: string;
  status: string;
  total: number;
  created: number;
  delivery: string;
  items: { name: string; qty: number; price: number }[];
};
const blank: Product = {
  id: "",
  name: "",
  category: "",
  weight: "",
  price: 0,
  stock: 0,
  active: 0,
};
const tabs = [
  "Produtos",
  "Pedidos",
  "Artes para a A1",
  "Canais de venda",
  "Combos",
];
async function get(view: string, params: Record<string, string> = {}) {
  const r = await fetch(
    "/api/loja?" + new URLSearchParams({ view, ...params }),
    { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Falha ao carregar.");
  return d;
}
export default function Admin() {
  const [auth, access] = useState(false),
    [pwd, password] = useState(""),
    [tab, choose] = useState(tabs[0]),
    [msg, notice] = useState(""),
    [busy, wait] = useState(false);
  const [products, list] = useState<Product[]>([]),
    [q, search] = useState(""),
    [page, paging] = useState(0),
    [count, total] = useState(0),
    [edit, select] = useState<Product | null>(null),
    [isNew, fresh] = useState(false);
  const [orders, history] = useState<Order[]>([]),
    [phone, contact] = useState(""),
    [ifood, channel] = useState(""),
    [revision, reload] = useState(0),
    [file, csv] = useState<File | null>(null);
  useEffect(() => {
    get("session")
      .then((d) => access(d.authorized))
      .catch((e) => notice(e.message));
  }, []);
  useEffect(() => {
    if (!auth) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        if (tab === tabs[0]) {
          const d = await get("products", { q, page: String(page) });
          if (live) {
            list(d.products);
            total(d.count);
          }
        }
        if (tab === tabs[1]) {
          const d = await get("orders");
          if (live) history(d.orders);
        }
        if (tab === tabs[3]) {
          const d = await get("settings");
          if (live) {
            contact(d.phone);
            channel(d.ifood);
          }
        }
      } catch (e) {
        if (live) notice((e as Error).message);
      }
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [auth, tab, q, page, revision]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    wait(true);
    notice("");
    try {
      await fn();
    } catch (e) {
      notice((e as Error).message);
    } finally {
      wait(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    run(async () => {
      await post({ ...edit, action: "product", create: isNew });
      select(null);
      notice("Produto salvo.");
      reload((n) => n + 1);
    });
  }
  return (
    <div className="mn">
      <ShopHeader />
      <main className="inner">
        <h1>Painel da loja</h1>
        {msg && (
          <p className="notice" role="status">
            {msg}
          </p>
        )}
        {!auth ? (
          <form
            className="mn-panel"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await post({ action: "login", password: pwd });
                password("");
                access(true);
              });
            }}
          >
            <label>
              Senha administrativa
              <input
                autoComplete="current-password"
                required
                type="password"
                value={pwd}
                onChange={(e) => password(e.target.value)}
              />
            </label>
            <button className="solid" disabled={busy}>
              Entrar no painel
            </button>
          </form>
        ) : (
          <>
            <div className="tabs">
              {tabs.map((t) => (
                <button
                  key={t}
                  className="soft-btn"
                  aria-pressed={t === tab}
                  onClick={() => {
                    choose(t);
                    notice("");
                  }}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() =>
                  run(async () => {
                    await post({ action: "logout" });
                    access(false);
                    list([]);
                    history([]);
                    select(null);
                  })
                }
              >
                Sair
              </button>
            </div>
            {tab === tabs[0] && (
              <>
                <div className="actions">
                  <button
                    className="solid"
                    onClick={() => {
                      fresh(true);
                      select({ ...blank });
                    }}
                  >
                    Novo produto
                  </button>
                  <input
                    className="standalone"
                    style={{ maxWidth: 360 }}
                    placeholder="Buscar por nome ou código"
                    aria-label="Buscar no cadastro"
                    value={q}
                    onChange={(e) => {
                      search(e.target.value);
                      paging(0);
                    }}
                  />
                </div>
                {edit && (
                  <form className="mn-panel" onSubmit={save}>
                    <h2>{isNew ? "Cadastrar produto" : "Editar produto"}</h2>
                    <div className="fields">
                      {(["id", "name", "category", "weight"] as const).map(
                        (k, i) => (
                          <label key={k}>
                            {
                              [
                                "Código",
                                "Nome",
                                "Categoria",
                                "Peso ou apresentação",
                              ][i]
                            }
                            <input
                              required={k !== "weight"}
                              disabled={k === "id" && !isNew}
                              value={edit[k]}
                              onChange={(e) =>
                                select({ ...edit, [k]: e.target.value })
                              }
                            />
                          </label>
                        ),
                      )}
                      <label>
                        Preço de venda (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          defaultValue={(edit.price / 100).toFixed(2)}
                          key={edit.id + "-preco"}
                          onChange={(e) =>
                            select({
                              ...edit,
                              price: Math.round(Number(e.target.value) * 100),
                            })
                          }
                        />
                      </label>
                      <label>
                        Estoque em unidades de venda
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={edit.stock}
                          onChange={(e) =>
                            select({ ...edit, stock: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!edit.active}
                        onChange={(e) =>
                          select({ ...edit, active: Number(e.target.checked) })
                        }
                      />{" "}
                      Exibir na vitrine
                    </label>
                    <div className="actions">
                      <button className="solid" disabled={busy}>
                        Salvar produto
                      </button>
                      <button type="button" onClick={() => select(null)}>
                        Fechar
                      </button>
                    </div>
                  </form>
                )}
                <div className="mn-panel">
                  <p>{count} cadastros encontrados</p>
                  {products.map((p) => (
                    <div className="rowline" key={p.id}>
                      <div>
                        <strong>{p.name}</strong>
                        <br />
                        <small>
                          #{p.id} · {p.category} · {p.weight || "Unidade"} ·{" "}
                          {money(p.price)} · Estoque {p.stock} ·{" "}
                          {p.active ? "Visível" : "Oculto"}
                        </small>
                      </div>
                      <button
                        className="soft-btn"
                        onClick={() => {
                          fresh(false);
                          select({ ...p });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                  <div className="pager">
                    <button disabled={!page} onClick={() => paging(page - 1)}>
                      Anterior
                    </button>
                    {page + 1} / {Math.max(1, Math.ceil(count / 45))}
                    <button
                      disabled={(page + 1) * 45 >= count}
                      onClick={() => paging(page + 1)}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
                <details className="mn-panel">
                  <summary>Importar relatório CSV</summary>
                  <p>
                    O relatório atualiza nomes, categorias, embalagens, preços,
                    estoque e visibilidade dos códigos presentes. Confira se o
                    relatório é mais recente que os últimos pedidos confirmados.
                    Saldos fracionados ou negativos precisam de revisão antes da
                    venda.
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Relatório de preços"
                    onChange={(e) => csv(e.target.files?.[0] || null)}
                  />
                  <button
                    className="solid"
                    disabled={!file || busy}
                    onClick={() =>
                      run(async () => {
                        if (!file) return;
                        const r = await post({
                          action: "import",
                          csv: await file.text(),
                        });
                        notice(r.count + " produtos importados.");
                        reload((n) => n + 1);
                      })
                    }
                  >
                    Importar e atualizar cadastros
                  </button>
                </details>
              </>
            )}
            {tab === tabs[1] && (
              <section className="mn-panel">
                <h2>Pedidos recebidos</h2>
                <p>
                  Confirmar um pedido dá baixa no estoque. Cancelar um pedido
                  confirmado devolve os itens ao saldo.
                </p>
                <button
                  className="soft-btn"
                  onClick={() => reload((n) => n + 1)}
                >
                  Atualizar lista
                </button>
                {!orders.length && <p>Nenhum pedido por aqui.</p>}
                {orders.map((o) => (
                  <article className="mn-panel" key={o.id}>
                    <strong>
                      #{o.id} · {o.status}
                    </strong>
                    <p>
                      {new Date(o.created).toLocaleString("pt-BR")} ·{" "}
                      {o.delivery}
                    </p>
                    {o.items.map((p, i) => (
                      <div key={i}>
                        {p.qty} × {p.name} · {money(p.price * p.qty)}
                      </div>
                    ))}
                    <p>Subtotal {money(o.total)}</p>
                    <div className="actions">
                      {(o.status === "A confirmar"
                        ? ["Confirmado", "Cancelado"]
                        : o.status === "Confirmado"
                          ? ["Concluído", "Cancelado"]
                          : []
                      ).map((s) => (
                        <button
                          className="soft-btn"
                          disabled={busy}
                          key={s}
                          onClick={() =>
                            run(async () => {
                              await post({
                                action: "status",
                                id: o.id,
                                status: s,
                              });
                              reload((n) => n + 1);
                            })
                          }
                        >
                          {s === "Confirmado"
                            ? "Confirmar"
                            : s === "Concluído"
                              ? "Concluir"
                              : "Cancelar pedido"}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}
            {tab === "Combos" && <ComboEditor />}
            {tab === tabs[2] && <ArtStudio />}
            {tab === tabs[3] && (
              <form
                className="mn-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await post({ action: "settings", phone, ifood });
                    notice("Canais de venda atualizados.");
                  });
                }}
              >
                <h2>Canais de venda</h2>
                <label>
                  WhatsApp comercial com 55 e DDD
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => contact(e.target.value)}
                  />
                </label>
                <label>
                  Link da loja no iFood (opcional)
                  <input
                    type="url"
                    value={ifood}
                    onChange={(e) => channel(e.target.value)}
                  />
                </label>
                <button className="solid" disabled={busy}>
                  Salvar canais
                </button>
              </form>
            )}
          </>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
