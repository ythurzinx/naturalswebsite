"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Cookie,
  Flower2,
  Grid2X2,
  Leaf,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Sprout,
  Wheat,
} from "lucide-react";
import { ShopHeader, ShopFooter, money } from "@/components/shop-shell";
import { useCart } from "@/lib/cart-context";
import ComboShelf from "@/components/combo-shelf";
import publicSeed from "@/data/public-catalog.json";

type Item = {
  id: string;
  name: string;
  category: string;
  weight: string;
  price: number;
  available: number;
  bulk?: number;
  photo?: string;
};
const groups = [
  "Grãos e cereais",
  "Mel e derivados",
  "Lanches e naturais",
  "Suplementos",
];
const icons = [Wheat, Flower2, Cookie, Sprout];
const initial = publicSeed.map(([id, name, category, weight, price]) => ({
  id: String(id),
  name: String(name),
  category: String(category),
  weight: String(weight),
  price: Number(price),
  bulk: Number(weight === "a granel (kg)"),
  available: 0,
}));
const pretty = (name: string) => name;
export default function Store() {
  const [cat, category] = useState(""),
    [q, search] = useState(""),
    [page, paging] = useState(0),
    [items, products] = useState<Item[]>(initial.slice(0, 24)),
    [cats, categories] = useState(groups),
    [count, total] = useState(initial.length),
    [ifood, food] = useState(""),
    [notice, say] = useState(""),
    [error, issue] = useState(""),
    [busy, loading] = useState(false);
  const [grams, setGrams] = useState<Record<string, number>>({});
  const { addToCart } = useCart();
  useEffect(() => {
    const ac = new AbortController();
    loading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          "/api/loja?" +
            new URLSearchParams({ category: cat, q, page: String(page) }),
          { signal: ac.signal },
        );
        if (!r.ok) throw Error();
        const d = await r.json();
        products(d.products);
        categories(d.categories);
        total(d.count);
        food(d.ifood);
        issue("");
      } catch {
        if (!ac.signal.aborted) {
          const filtered = initial.filter(
            (p) =>
              (!cat || p.category === cat) &&
              p.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
          );
          products(filtered.slice(page * 24, (page + 1) * 24));
          total(filtered.length);
          categories([...new Set(initial.map((p) => p.category))]);
          issue("Estoque temporariamente indisponível.");
        }
      } finally {
        if (!ac.signal.aborted) loading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [cat, q, page]);
  useEffect(() => {
    const apply = () => {
      search(new URLSearchParams(location.search).get("q") || "");
      paging(0);
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);
  function add(p: Item) {
    if (p.bulk) {
      const g = grams[p.id] ?? 100;
      if (!Number.isInteger(g) || g < 1 || g > 50000) return;
      p = {
        ...p,
        id: "g:" + g + ":" + p.id,
        weight: g + " g",
        price: Math.round((p.price * g) / 1000),
      };
    }

    addToCart(
      {
        id: p.id,
        nome_produto: pretty(p.name),
        peso_produto: p.weight,
        valor_unitario: p.price / 100,
        categoria: p.category,
        quantidade: 999,
        estoque_minimo: 0,
        status_estoque: "",
        total_unitario: 0,
        isGranel: false,
      },
      1,
    );
    say(pretty(p.name) + " na sacola.");
  }
  return (
    <div className="mn">
      <ShopHeader />
      <main className="mn-main">
        <section className="market-hero hero-combos">
          <div className="hero-copy">
            <div className="hero-kicker">
              <MapPin size={15} /> Empório de Taboão da Serra
            </div>
            <h1>
              Combos para
              <br />o seu <em>dia a dia.</em>
            </h1>
            <p>
              Granolas, mel e lanches em combinações da nossa loja de família.
              Escolha a sua e acerte o pagamento pelo WhatsApp.
            </p>
            <a className="solid" href="#combos">
              Escolher meu combo <ArrowDown size={17} />
            </a>
          </div>
        </section>
        <ComboShelf add={add} />
        <section id="catalogo">
          <div className="catalog-title">
            <div>
              <span className="eyeline">
                <i /> POR CATEGORIA
              </span>
              <h2>Produtos avulsos</h2>
            </div>
            <label className="searchbox">
              <Search size={18} />
              <input
                aria-label="Buscar produto"
                placeholder="Buscar um produto..."
                value={q}
                onChange={(e) => {
                  search(e.target.value);
                  paging(0);
                }}
              />
            </label>
          </div>
          <div className="chips">
            {["", ...cats].map((c) => {
              const Icon = c ? icons[groups.indexOf(c)] || Leaf : Grid2X2;
              return (
                <button
                  aria-pressed={cat === c}
                  key={c}
                  onClick={() => {
                    category(c);
                    paging(0);
                  }}
                >
                  <Icon size={16} />
                  {c || "Todos"}
                </button>
              );
            })}
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="results">
            <span>{cat || "Todos os produtos"}</span>
            <small>{busy ? "Buscando…" : count + " produtos"}</small>
          </div>
          <div className="product-grid">
            {items.map((p) => {
              const Icon = icons[groups.indexOf(p.category)] || Leaf;
              return (
                <article className="product" key={p.id}>
                  {p.photo && (
                    <img className="sku-photo" src={p.photo} alt={p.name} />
                  )}
                  <div className="product-type">
                    <Icon size={19} />
                    {p.category}
                  </div>
                  <h3>{pretty(p.name)}</h3>
                  {p.bulk ? (
                    <label className="gram-picker">
                      {money(p.price)}/kg · Quantos gramas?
                      <input
                        type="number"
                        min="1"
                        max="50000"
                        step="1"
                        value={grams[p.id] ?? 100}
                        onChange={(e) =>
                          setGrams({ ...grams, [p.id]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ) : (
                    <small>{p.weight || "Unidade"}</small>
                  )}
                  <div className="product-buy">
                    <strong>
                      {money(
                        p.bulk
                          ? Math.round((p.price * (grams[p.id] ?? 100)) / 1000)
                          : p.price,
                      )}
                    </strong>
                    <button
                      disabled={
                        !p.available ||
                        (!!p.bulk &&
                          (!Number.isInteger(grams[p.id] ?? 100) ||
                            (grams[p.id] ?? 100) < 1 ||
                            (grams[p.id] ?? 100) > 50000))
                      }
                      onClick={() => add(p)}
                      aria-label={"Adicionar " + p.name}
                    >
                      {p.available ? (
                        <>
                          <Plus size={17} /> Adicionar
                        </>
                      ) : (
                        "Indisponível"
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!items.length && !busy && (
            <p>Nenhum produto encontrado. Experimente outra busca.</p>
          )}
          {count > 24 && (
            <div className="pager">
              <button disabled={!page} onClick={() => paging(page - 1)}>
                Anterior
              </button>{" "}
              Página {page + 1}{" "}
              <button
                disabled={(page + 1) * 24 >= count}
                onClick={() => paging(page + 1)}
              >
                Próxima
              </button>
            </div>
          )}
          {ifood && (
            <a className="outline-link" href={ifood} rel="noreferrer">
              Comprar pelo iFood <ArrowRight size={16} />
            </a>
          )}
        </section>
      </main>
      <ShopFooter />
      {notice && (
        <div className="toast" role="status">
          <ShoppingBag size={17} />
          {notice}
          <button onClick={() => say("")} aria-label="Fechar">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
