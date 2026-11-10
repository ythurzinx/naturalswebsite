"use client";
import { useEffect, useState } from "react";
import { post, money } from "./shop-shell";
type Member = { id: string; qty: number; name?: string };
type Bundle = {
  key?: string;
  id?: string;
  name: string;
  description: string;
  image: string;
  customPrice: number;
  active: number;
  members: Member[];
};
const blank = (): Bundle => ({
  name: "",
  description: "",
  image: "neutra",
  customPrice: 0,
  active: 0,
  members: [
    { id: "", qty: 1 },
    { id: "", qty: 1 },
  ],
});
export default function ComboEditor() {
  const [list, setList] = useState<Bundle[]>([]),
    [edit, set] = useState<Bundle | null>(null),
    [msg, notice] = useState(""),
    [busy, wait] = useState(false);
  async function load() {
    const r = await fetch("/api/loja?view=adminCombos");
    if (!r.ok) throw Error("Faça login novamente.");
    setList((await r.json()).combos);
  }
  useEffect(() => {
    load().catch((e) => notice(e.message));
  }, []);
  function updateMember(i: number, patch: Partial<Member>) {
    if (edit)
      set({
        ...edit,
        members: edit.members.map((m, j) => (i === j ? { ...m, ...patch } : m)),
      });
  }
  return (
    <section className="mn-panel">
      <h2>Combos da loja</h2>
      <p>
        Use os códigos da aba Produtos. O estoque de cada combo acompanha o
        saldo dos itens que ele contém.
      </p>
      <button className="solid" onClick={() => set(blank())}>
        Criar combo
      </button>
      {msg && <p role="status">{msg}</p>}
      {list.map((c) => (
        <div className="rowline" key={c.key}>
          <strong>{c.name}</strong>
          <span>
            {c.active ? "Visível" : "Oculto"} ·{" "}
            {c.customPrice ? money(c.customPrice) : "Soma dos itens"}
          </span>
          <button className="soft-btn" onClick={() => set({ ...c })}>
            Editar {c.name}
          </button>
        </div>
      ))}
      {edit && (
        <form
          className="mn-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            wait(true);
            try {
              await post({
                ...edit,
                action: "saveCombo",
                revision: Number(edit.id?.split(":").pop()),
                price: edit.customPrice,
              });
              set(null);
              await load();
              notice("Combo salvo.");
            } catch (e) {
              notice((e as Error).message);
            } finally {
              wait(false);
            }
          }}
        >
          <label>
            Nome
            <input
              required
              maxLength={80}
              value={edit.name}
              onChange={(e) => set({ ...edit, name: e.target.value })}
            />
          </label>
          <label>
            Descrição
            <input
              maxLength={180}
              value={edit.description}
              onChange={(e) => set({ ...edit, description: e.target.value })}
            />
          </label>
          <label>
            Foto ilustrativa
            <select
              value={edit.image}
              onChange={(e) => set({ ...edit, image: e.target.value })}
            >
              {["neutra", "cafe", "lanche", "granolas"].map((v, i) => (
                <option key={v} value={v}>
                  {
                    [
                      "Sem foto",
                      "Granola com mel",
                      "Lanche com cacau",
                      "Granolas",
                    ][i]
                  }
                </option>
              ))}
            </select>
          </label>
          {edit.members.map((m, i) => (
            <div className="fields" key={i}>
              <label>
                Código do produto
                <input
                  required
                  value={m.id}
                  onChange={(e) =>
                    updateMember(i, { id: e.target.value, name: undefined })
                  }
                />
                {m.name}
              </label>
              <label>
                Quantidade
                <input
                  type="number"
                  min="1"
                  max="99"
                  required
                  value={m.qty || ""}
                  onChange={(e) =>
                    updateMember(i, { qty: Number(e.target.value) })
                  }
                />
              </label>
              <button
                type="button"
                disabled={edit.members.length <= 2}
                onClick={() =>
                  set({
                    ...edit,
                    members: edit.members.filter((_, j) => j !== i),
                  })
                }
              >
                Remover item
              </button>
            </div>
          ))}
          <button
            type="button"
            className="soft-btn"
            disabled={edit.members.length >= 15}
            onClick={() =>
              set({ ...edit, members: [...edit.members, { id: "", qty: 1 }] })
            }
          >
            Incluir produto
          </button>
          <label>
            Preço do combo em reais (zero usa a soma dos itens)
            <input
              type="number"
              step="0.01"
              min="0"
              key={edit.key || "novo"}
              defaultValue={edit.customPrice / 100}
              onChange={(e) =>
                set({
                  ...edit,
                  customPrice: Math.round(Number(e.target.value) * 100),
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!edit.active}
              onChange={(e) =>
                set({ ...edit, active: Number(e.target.checked) })
              }
            />{" "}
            Exibir na vitrine
          </label>
          <div className="actions">
            <button className="solid" disabled={busy}>
              Salvar combo
            </button>
            <button type="button" onClick={() => set(null)}>
              Fechar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
