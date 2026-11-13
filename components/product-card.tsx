"use client";
import { useState } from "react";
import { Heart, Plus, Check, Leaf } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import type { Product } from "@/lib/types";
import dynamic from "next/dynamic";
import { ProductImage } from "./product-image";
export { ProductImage } from "./product-image";
const ProductQuickView = dynamic(() =>
  import("./product-quick-view").then((m) => m.ProductQuickView),
);
import { BULK_STEP_GRAMS, referencePriceCents } from "@/lib/pricing.mjs";
export function ProductCard({ product }: { product: Product }) {
  const { addToCart, favorites, toggleFavorite } = useCart();
  const [open, setOpen] = useState(false),
    [added, setAdded] = useState(false);
  const favorite = favorites.includes(product.id);
  const price = referencePriceCents(product);
  const saving = product.originalPriceCents
    ? product.originalPriceCents - price
    : 0;
  return (
    <>
      <article className="product-card">
        <div className="product-image-wrap">
          <button
            onClick={() => setOpen(true)}
            className="product-image-button"
            aria-label={`Ver detalhes de ${product.nome_produto}`}
          >
            <ProductImage product={product} />
          </button>
          <span className="product-label">
            {product.combo
              ? "COMBO"
              : product.isGranel
                ? "A GRANEL"
                : "NOSSO CATÁLOGO"}
          </span>
          {saving > 0 && <span className="offer-badge">OFERTA</span>}
          <button
            className={`favorite-button ${favorite ? "is-favorite" : ""}`}
            aria-label={`${favorite ? "Remover" : "Salvar"} ${product.nome_produto} ${favorite ? "dos" : "nos"} favoritos`}
            aria-pressed={favorite}
            onClick={() => toggleFavorite(product.id)}
          >
            <Heart size={18} fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="product-info">
          <span className="product-category">
            {product.isGranel
              ? "NATUREZA NA MEDIDA CERTA"
              : product.categoria.split(" / ")[0]}
          </span>
          <button className="product-name" onClick={() => setOpen(true)}>
            {product.nome_produto}
          </button>
          <div className="product-weight">
            {product.isGranel
              ? "Escolha de 100 em 100 g"
              : product.peso_produto}
          </div>
          <div className="product-price-row">
            <div>
              {saving > 0 && (
                <del className="product-old-price" aria-label="Preço anterior">
                  {formatPrice(product.originalPriceCents! / 100)}
                </del>
              )}
              <strong className="product-price">
                {formatPrice(referencePriceCents(product) / 100)}
              </strong>
              <small>
                {product.combo
                  ? "por combo"
                  : product.isGranel
                    ? "por 100 g"
                    : "por unidade"}
              </small>
            </div>
            <button
              className={`add-button ${added ? "added" : ""}`}
              onClick={() => {
                addToCart(product, 1, BULK_STEP_GRAMS);
                setAdded(true);
              }}
              aria-label={`Adicionar ${product.isGranel ? "100 g de " : ""}${product.nome_produto} ao carrinho`}
            >
              {added ? <Check size={21} /> : <Plus size={22} />}
            </button>
          </div>
          <p className="product-availability">
            <Leaf size={12} />{" "}
            {product.combo
              ? "Porções em embalagens separadas"
              : "Selecionado e embalado na loja"}
          </p>
          <span className="sr-only" role="status">
            {added ? `${product.nome_produto} adicionado ao carrinho` : ""}
          </span>
        </div>
      </article>
      {open && (
        <ProductQuickView product={product} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
