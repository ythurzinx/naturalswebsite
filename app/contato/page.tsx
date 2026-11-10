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
            A nossa loja de família nasceu da iniciativa de duas irmãs. Em
            Taboão da Serra, reunimos grãos a granel, especiarias e suplementos,
            com atendimento de perto.
          </p>
          <p>
            Rua José Duarte Souza, 25 · Jardim Saint Morritz
            <br />
            Taboão da Serra, SP
          </p>
          <p>
            Entregamos em Taboão da Serra e região. A disponibilidade, o frete e
            o horário de retirada são confirmados a cada pedido.
          </p>
          <p>Segunda a sexta, das 8h às 18h. Sábado, das 8h às 14h.</p>
          <p>
            <a
              href="https://www.instagram.com/_mundonatural10/"
              rel="noreferrer"
            >
              Instagram · @_mundonatural10
            </a>
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
