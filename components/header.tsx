"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  MapPin,
  Heart,
  ShoppingBag,
  Menu,
  ChevronDown,
  MessageCircle,
  Leaf,
  ArrowUpRight,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { groups } from "@/lib/products";
import { whatsappUrl } from "@/lib/store";
import { useShipping } from "@/lib/shipping-context";
export function Header() {
  const { settings: shipping } = useShipping();
  const pathname = usePathname();
  const { itemCount, favorites } = useCart();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  if (pathname.startsWith("/admin"))
    return (
      <header className="admin-brand-bar">
        <Link href="/" aria-label="Voltar à loja Mundo Natural">
          <img
            src="/images/mundo-natural-logo.webp"
            alt="Mundo Natural"
            width="50"
            height="46"
          />{" "}
          Mundo Natural <span>Administração</span>
        </Link>
      </header>
    );
  return (
    <>
      <div className="announcement">
        <div className="shell">
          <span>
            <Leaf size={13} /> O seu mundo mais natural começa aqui.
          </span>
          <Link href={shipping.enabled ? "/carrinho" : "/contato"}>
            {shipping.enabled
              ? "Entrega: calcule o frete pelo CEP"
              : "De Taboão da Serra, com carinho"}{" "}
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
      <header className="site-header">
        <div className="shell header-main">
          <Link href="/" className="brand" aria-label="Mundo Natural — início">
            <img
              src="/images/mundo-natural-logo.webp"
              alt="Mundo Natural · Produtos naturais · Taboão da Serra"
              width="96"
              height="88"
            />
          </Link>
          <form action="/produtos" className="search-form" role="search">
            <label htmlFor="site-search" className="sr-only">
              Buscar produtos
            </label>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="O que faz bem para você hoje?"
              maxLength={120}
              autoComplete="off"
            />
            <button type="submit" aria-label="Buscar">
              <Search size={21} />
            </button>
          </form>
          <div className="header-actions">
            <Link
              href="/favoritos"
              className="header-action"
              aria-label={`Favoritos, ${favorites.length} produtos`}
            >
              <span className="header-icon">
                <Heart size={23} />
                {favorites.length > 0 && <b>{favorites.length}</b>}
              </span>
              <span>Favoritos</span>
            </Link>
            <Link
              href="/carrinho"
              className="header-action cart-action"
              aria-label={`Meu carrinho, ${itemCount} itens`}
            >
              <span className="header-icon">
                <ShoppingBag size={24} />
                <b>{itemCount}</b>
              </span>
              <span>Meu carrinho</span>
            </Link>
          </div>
        </div>
        <div className="nav-border">
          <nav className="shell header-nav" aria-label="Navegação principal">
            <div ref={menuRef} className="category-menu-wrap">
              <button
                ref={menuButton}
                className="category-menu-button"
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
                aria-controls="category-menu"
              >
                <Menu size={18} /> Todas as categorias <ChevronDown size={14} />
              </button>
              {menu && (
                <div id="category-menu" className="category-menu">
                  {groups.slice(1).map((group) => (
                    <Link
                      key={group}
                      href={`/produtos?categoria=${encodeURIComponent(group)}`}
                      onClick={() => setMenu(false)}
                    >
                      {group}
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/produtos">Nossos produtos</Link>
            <Link href="/produtos?selecao=1" className="nav-highlight">
              Escolhas naturais <span>NOVO</span>
            </Link>
            <Link href="/sobre">Nossa história</Link>
            <Link href="/blog">Viver bem</Link>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-help"
            >
              <MessageCircle size={17} /> Precisa de ajuda?
            </a>
          </nav>
        </div>
        <div className="mobile-location">
          <MapPin size={13} /> Sua loja natural em Taboão da Serra{" "}
          <Link href="/contato">
            Conheça <ChevronDown size={12} />
          </Link>
        </div>
      </header>
    </>
  );
}
