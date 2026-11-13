"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, ArrowUpRight, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { findProducts } from "@/lib/search.mjs";
import { referencePriceCents } from "@/lib/pricing.mjs";
import { formatPrice } from "@/lib/products";
import type { Product } from "@/lib/types";
const QuickView = dynamic(() =>
  import("./product-quick-view").then((m) => m.ProductQuickView),
);
export function SearchAutocomplete({
  value,
  onChange,
  compact = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  compact?: boolean;
}) {
  const { catalog } = useCart(),
    router = useRouter();
  const [internal, setInternal] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [selected, setSelected] = useState<Product | null>(null);
  const query = value ?? internal,
    id = useId(),
    input = useRef<HTMLInputElement>(null),
    root = useRef<HTMLDivElement>(null);
  const found = useMemo(
    () => findProducts(catalog, query, 7) as Product[],
    [catalog, query],
  );
  function change(next: string) {
    setInternal(next);
    onChange?.(next);
    setOpen(true);
    setActive(-1);
  }
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function choose(product: Product) {
    setOpen(false);
    setSelected(product);
  }
  function submit() {
    setOpen(false);
    if (onChange) input.current?.blur();
    else router.push(`/produtos?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <div
      ref={root}
      className={`search-autocomplete ${compact ? "search-compact" : ""}`}
    >
      <form
        action="/produtos"
        className="search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Search size={19} className="search-leading-icon" />
        <label htmlFor={id} className="sr-only">
          {compact ? "Buscar neste catálogo" : "Buscar produtos"}
        </label>
        <input
          ref={input}
          id={id}
          name="q"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && query.trim().length > 0}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={
            active >= 0 ? `${id}-option-${active}` : undefined
          }
          value={query}
          maxLength={120}
          autoComplete="off"
          placeholder="Busque castanhas, psyllium, temperos…"
          onChange={(e) => change(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
              return;
            }
            if (
              (e.key === "ArrowDown" || e.key === "ArrowUp") &&
              query.trim()
            ) {
              e.preventDefault();
              setOpen(true);
              setActive((a) =>
                e.key === "ArrowDown"
                  ? Math.min(found.length - 1, a + 1)
                  : Math.max(0, a - 1),
              );
            }
            if (e.key === "Enter" && open && active >= 0 && found[active]) {
              e.preventDefault();
              choose(found[active]);
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Limpar busca"
            onClick={() => {
              change("");
              input.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
        <button type="submit" aria-label="Buscar">
          <Search size={20} />
        </button>
      </form>
      {open && query.trim() && (
        <div className="search-suggestions">
          <div className="suggestions-heading">
            <span>Resultados para “{query}”</span>
            <small>
              {found.length
                ? "Toque para conhecer"
                : "Tente outro nome ou ingrediente"}
            </small>
          </div>
          <ul
            id={`${id}-suggestions`}
            role="listbox"
            aria-label="Sugestões de produtos"
          >
            {found.map((product, i) => (
              <li
                key={product.id}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={active === i}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(product)}
                  onMouseEnter={() => setActive(i)}
                >
                  {product.imagem &&
                  /^\/(?:images\/products\/[a-z0-9-]+\.webp|api\/product-images\/[a-f0-9]{64})$/.test(
                    product.imagem,
                  ) ? (
                    <img src={product.imagem} width={48} height={48} alt="" />
                  ) : (
                    <Search size={22} />
                  )}
                  <span>
                    <strong>{product.nome_produto}</strong>
                    <small>
                      {formatPrice(referencePriceCents(product) / 100)} ·{" "}
                      {product.isGranel
                        ? "100 g"
                        : product.combo
                          ? "combo"
                          : "unidade"}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="suggestions-all" onClick={submit}>
            Ver resultados no catálogo <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      {selected && (
        <QuickView
          product={selected}
          onClose={() => {
            setSelected(null);
            input.current?.focus();
          }}
        />
      )}
    </div>
  );
}
