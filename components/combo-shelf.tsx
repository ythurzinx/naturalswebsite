"use client";
import { useEffect, useState } from "react";
import { Plus, Package } from "lucide-react";
import seed from "@/data/combo-seed.json";
import products from "@/data/public-catalog.json";
import { money } from "./shop-shell";
type Bundle = {
  id: string;
  key: string;
  name: string;
  description: string;
  image: string;
  price: number;
  available: boolean;
  members: { id: string; qty: number; name: string; weight: string }[];
};
const initial: Bundle[] = seed.map((c) => {
  const members = c.members.map((m) => {
    const p = products.find((row) => row[0] === m.id)!;
    return {
      ...m,
      name: String(p[1]),
      weight: String(p[3]),
      price: Number(p[4]),
    };
  });
  return {
    ...c,
    id: "kit:" + c.key + ":1",
    available: false,
    members,
    price: members.reduce((s, m) => s + m.qty * m.price, 0),
  };
});
type Item = {
  id: string;
  name: string;
  category: string;
  weight: string;
  price: number;
  available: number;
};
export default function ComboShelf({ add }: { add: (i: Item) => void }) {
  const [combos, set] = useState(initial),
    [offline, issue] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/loja?view=combos", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        set((await r.json()).combos);
      })
      .catch(() => {
        if (!ac.signal.aborted) issue(true);
      });
    return () => ac.abort();
  }, []);
  return (
    <section id="combos" className="combo-section">
      <div className="combo-heading">
        <div>
          <h2>
            Combos da loja<span>.</span>
          </h2>
          <p>Escolha uma combinação e leve todos os itens de uma vez.</p>
        </div>
        <a href="#catalogo">Ver produtos avulsos ↓</a>
      </div>
      {offline && (
        <p role="status">
          Prévia das combinações. O estoque será atualizado quando a loja
          estiver conectada.
        </p>
      )}
      {combos.length === 0 && (
        <p>
          Novas combinações estão sendo preparadas. Confira os produtos avulsos
          abaixo.
        </p>
      )}
      <div className="combo-grid">
        {combos.map((c) => (
          <article className="combo-card" key={c.id}>
            <div className={"combo-picture theme-" + c.image}>
              {c.image === "neutra" ? (
                <Package size={45} />
              ) : (
                <img
                  alt={"Imagem ilustrativa de " + c.name}
                  src={"/combos/" + c.image + ".webp"}
                />
              )}
              <span>{c.members.reduce((s, m) => s + m.qty, 0)} itens</span>
            </div>
            <div className="combo-body">
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <details>
                <summary>O que vem no combo</summary>
                <ul>
                  {c.members.map((m) => (
                    <li key={m.id}>
                      {m.qty} × {m.name.toLocaleLowerCase("pt-BR")} · {m.weight}
                    </li>
                  ))}
                </ul>
              </details>
              <div className="combo-buy">
                <strong>{money(c.price)}</strong>
                <button
                  disabled={!c.available}
                  aria-label={"Adicionar " + c.name + " à sacola"}
                  onClick={() =>
                    add({
                      id: c.id,
                      name: c.name,
                      category: "Combos",
                      weight: c.members
                        .map((m) => m.qty + " × " + m.name.toLowerCase())
                        .join(" + "),
                      price: c.price,
                      available: 1,
                    })
                  }
                >
                  {c.available ? (
                    <>
                      <Plus size={16} /> Adicionar
                    </>
                  ) : (
                    "Indisponível"
                  )}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
