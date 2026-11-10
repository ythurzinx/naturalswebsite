"use client";
import { useEffect, useState } from "react";
import { ShopHeader, ShopFooter } from "@/components/shop-shell";
export default function Contact() {
  const [phone, set] = useState("");
  useEffect(() => {
    fetch("/api/loja")
      .then((r) => r.json())
      .then((d) => set(d.phone || ""))
      .catch(() => {});
  }, []);
  return (
    <div className="mn">
      <ShopHeader />
      <main className="inner">
        <h1>Nossa loja</h1>
        <section className="mn-panel">
          <h2>Mundo Natural</h2>
          <p>
            Rua José Duarte Souza, 21 · Jardim das Margaridas
            <br />
            Taboão da Serra, SP
          </p>
          <p>
            Entregamos em Taboão da Serra e região. A disponibilidade, o frete e
            o horário de retirada são confirmados a cada pedido.
          </p>
          {phone && (
            <a className="solid" href={"https://wa.me/" + phone}>
              Conversar pelo WhatsApp
            </a>
          )}
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
