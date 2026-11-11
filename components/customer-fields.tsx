"use client";
import { useState } from "react";
import { money } from "./shop-shell";
export type Buyer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  cep: string;
};
export function CustomerFields({
  buyer,
  change,
  delivery,
  shipping,
  quote,
}: {
  buyer: Buyer;
  change: (b: Buyer) => void;
  delivery: boolean;
  shipping: number | null;
  quote: (n: number | null) => void;
}) {
  const [message, set] = useState(""),
    [busy, wait] = useState(false);
  async function calculate() {
    wait(true);
    quote(null);
    set("");
    try {
      const r = await fetch("/api/calculate-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: buyer.cep }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      quote(d.cents);
      set(
        d.distance +
          " km por estrada · " +
          money(d.rate) +
          "/km · " +
          d.address,
      );
    } catch (e) {
      set((e as Error).message);
    } finally {
      wait(false);
    }
  }
  return (
    <>
      <h2>Dados do comprador</h2>
      <div className="fields">
        {(["name", "email", "phone"] as const).map((k, i) => (
          <label key={k}>
            {["Nome completo", "E-mail", "Telefone com DDD"][i]}
            <input
              required
              type={["text", "email", "tel"][i]}
              autoComplete={["name", "email", "tel"][i]}
              value={buyer[k]}
              onChange={(e) => change({ ...buyer, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {delivery && (
        <>
          <label>
            CEP de entrega
            <input
              required
              inputMode="numeric"
              value={buyer.cep}
              disabled={busy}
              placeholder="00000-000"
              maxLength={9}
              onChange={(e) => {
                change({ ...buyer, cep: e.target.value });
                quote(null);
                set("");
              }}
            />
          </label>
          <button
            className="soft-btn"
            type="button"
            disabled={busy}
            onClick={calculate}
          >
            {busy ? "Consultando rota…" : "Calcular frete"}
          </button>
          <p role="status">
            {message} {shipping !== null && " · Frete " + money(shipping)}
          </p>
          <label>
            Rua, número, complemento e bairro
            <input
              required
              autoComplete="street-address"
              value={buyer.address}
              onChange={(e) => change({ ...buyer, address: e.target.value })}
            />
          </label>
        </>
      )}
    </>
  );
}
