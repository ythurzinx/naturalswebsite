"use client";
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
  const { itemCount } = useCart();
  return (
    <>
      <div className="delivery-strip">
        <MapPin size={14} /> Entrega própria em Taboão da Serra e região
      </div>
      <header className="mn-head">
        <Link href="/" className="wordmark">
          <Sprout size={38} />
          <span>
            Mundo Natural<small>PRODUTOS NATURAIS</small>
          </span>
        </Link>
        <nav>
          <Link href="/#catalogo">Catálogo</Link>
          <Link href="/contato">Nossa loja</Link>
        </nav>
        <Link className="bag" href="/carrinho">
          <ShoppingBag size={18} /> Sacola <b>{itemCount}</b>
        </Link>
      </header>
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
