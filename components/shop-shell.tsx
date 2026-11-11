"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Leaf,
  MapPin,
  ShoppingBag,
  Sprout,
  Store,
  SlidersHorizontal,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
export function ShopHeader() {
  const [logo, setLogo] = useState(""),
    [cookies, show] = useState(false);
  useEffect(() => {
    fetch("/api/loja?view=brand")
      .then((r) => r.json())
      .then((d) => setLogo(d.logo || ""))
      .catch(() => {});
    try {
      show(!localStorage.getItem("mn-cookie-choice"));
    } catch {}
    const open = () => show(true);
    window.addEventListener("mn-cookies", open);
    return () => window.removeEventListener("mn-cookies", open);
  }, []);
  function consent(remember: boolean) {
    try {
      localStorage.setItem(
        "mn-cookie-choice",
        remember ? "remember" : "essential",
      );
      if (!remember) localStorage.removeItem("mundo-natural-cart");
    } catch {}
    window.dispatchEvent(new Event("mn-cart-choice"));
    show(false);
  }
  const { itemCount } = useCart();
  return (
    <>
      <div className="delivery-strip">
        <MapPin size={14} /> Entrega própria em Taboão da Serra e região
      </div>
      <header className="mn-head">
        <Link href="/" className="wordmark">
          {logo ? (
            <img className="brand-logo" src={logo} alt="Logo Mundo Natural" />
          ) : (
            <Sprout size={38} />
          )}
          <span>
            Mundo Natural<small>PRODUTOS NATURAIS</small>
          </span>
        </Link>
        <form className="market-search" action="/#catalogo">
          <input
            type="search"
            name="q"
            aria-label="Pesquisar na loja"
            placeholder="Buscar produtos, marcas e ingredientes"
          />
          <button aria-label="Buscar">Buscar</button>
        </form>
        <nav>
          <Link href="/#combos">Combos</Link>
          <Link href="/#catalogo">Produtos</Link>
          <Link href="/suporte">Suporte</Link>
        </nav>
        <Link className="bag" href="/carrinho">
          <ShoppingBag size={18} /> Carrinho <b>{itemCount}</b>
        </Link>
      </header>
      {cookies && (
        <aside className="cookie-panel" aria-label="Preferências de cookies">
          <strong>Cookies e carrinho</strong>
          <p>
            Usamos armazenamento essencial durante a visita. Você pode permitir
            que o carrinho seja lembrado quando voltar.
          </p>
          <a href="/privacidade">Privacidade</a>{" "}
          <button onClick={() => consent(false)}>Só essenciais</button>{" "}
          <button onClick={() => consent(true)}>Lembrar carrinho</button>
        </aside>
      )}
    </>
  );
}
export function ShopFooter() {
  return (
    <footer className="mn-footer">
      <div>
        <Leaf size={19} /> Mundo Natural · Taboão da Serra
      </div>
      <Link href="/contato">
        <Store size={15} /> Nossa loja
      </Link>
      <Link href="/privacidade">Privacidade e cookies</Link>
      <button onClick={() => window.dispatchEvent(new Event("mn-cookies"))}>
        Preferências de cookies
      </button>
      <Link href="/suporte">Suporte</Link>
      <Link href="/admin">
        <SlidersHorizontal size={15} /> Administração
      </Link>
    </footer>
  );
}
export const money = (cent: number) =>
  (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export async function post(body: object) {
  const r = await fetch("/api/loja", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}
