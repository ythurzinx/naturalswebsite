"use client";
import { useEffect, useState } from "react";
import { ShopFooter, ShopHeader } from "@/components/shop-shell";
export default function Support() {
  const [phone, set] = useState("551151993525");
  useEffect(() => {
    fetch("/api/loja")
      .then((r) => r.json())
      .then((d) => {
        if (d.phone) set(d.phone);
      })
      .catch(() => {});
  }, []);
  return (
    <div className="mn">
      <ShopHeader />
      <main className="inner">
        <h1>Como podemos ajudar?</h1>
        <section className="mn-panel">
          <h2>Atendimento da Mundo Natural</h2>
          <p>
            Fale com a loja sobre a entrega, uma troca, os ingredientes ou os
            seus dados. Se já fez um pedido, informe o número dele.
          </p>
          <a className="solid" href={"https://wa.me/" + phone}>
            Conversar no WhatsApp
          </a>
        </section>
        <details className="mn-panel">
          <summary>Como consultar o frete?</summary>
          <p>
            Escolha entrega no carrinho e informe seu CEP antes de finalizar.
          </p>
        </details>
        <details className="mn-panel">
          <summary>Como escolher o peso?</summary>
          <p>
            Nos produtos vendidos a granel, digite os gramas desejados. A
            vitrine calcula o valor da porção.
          </p>
        </details>
      </main>
      <ShopFooter />
    </div>
  );
}
