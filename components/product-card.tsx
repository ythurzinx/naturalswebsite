"use client";
import { useState } from "react";
import { Heart, Plus, Check, ShoppingBag, Package, Leaf } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice, productTile } from "@/lib/products";
import type { Product } from "@/lib/types";
import { Modal } from "./modal";
import { lineTotal } from "@/lib/commerce.mjs";
export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const packaged = /Suplementos|Fitoterápicos/.test(product.categoria);
  if (
    product.imagem &&
    /^\/api\/product-images\/[a-f0-9]{64}$/.test(product.imagem)
  )
    return (
      <div className={`product-photo product-custom-photo ${className}`}>
        <img src={product.imagem} alt={product.nome_produto} loading="lazy" />
      </div>
    );
  return (
    <div
      className={`product-photo tile-${productTile(product)} ${packaged ? "packaged-photo" : ""} ${className}`}
      role="img"
      aria-label={`Imagem ilustrativa de ${product.nome_produto}`}
    >
      {packaged && <Package size={60} strokeWidth={1} />}
    </div>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const { addToCart, favorites, toggleFavorite } = useCart();
  const [open, setOpen] = useState(false),
    [weight, setWeight] = useState(250),
    [quantity, setQuantity] = useState(1),
    [added, setAdded] = useState(false);
  const favorite = favorites.includes(product.id);
  function add() {
    addToCart(product, quantity, weight);
    setAdded(true);
  }
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
            {product.isGranel ? "A GRANEL" : "NOSSO CATÁLOGO"}
          </span>
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
            {product.isGranel ? "Porção de 250 g" : product.peso_produto}
          </div>
          <div className="product-price-row">
            <div>
              <strong className="product-price">
                {formatPrice(
                  product.valor_unitario * (product.isGranel ? 0.25 : 1),
                )}
              </strong>
              <small>{product.isGranel ? "por porção" : "por unidade"}</small>
            </div>
            <button
              className={`add-button ${added ? "added" : ""}`}
              onClick={() => {
                addToCart(product, 1, 250);
                setAdded(true);
              }}
              aria-label={`Adicionar ${product.nome_produto} ao carrinho`}
            >
              {added ? <Check size={21} /> : <Plus size={22} />}
            </button>
          </div>
          <p className="product-availability">
            <Leaf size={12} /> Disponibilidade pelo atendimento
          </p>
          <span className="sr-only" role="status">
            {added ? `${product.nome_produto} adicionado ao carrinho` : ""}
          </span>
        </div>
      </article>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={product.nome_produto}
        wide
      >
        <div className="product-detail">
          <ProductImage product={product} />
          <div>
            <span className="eyebrow">
              {product.isGranel ? "A granel, do seu jeito" : product.categoria}
            </span>
            <p className="detail-intro">
              Monte sua seleção e confirme preço, disponibilidade, ingredientes
              e informações de alergênicos com a nossa equipe.
            </p>
            <strong className="detail-price">
              {formatPrice(
                lineTotal({ product, quantity, selectedWeight: weight }),
              )}
            </strong>
            <p className="muted">
              Preço da seleção{" "}
              {product.isGranel &&
                `· ${formatPrice(product.valor_unitario)}/kg`}
            </p>
            {product.isGranel ? (
              <label className="field-label">
                Escolha sua porção
                <select
                  value={weight}
                  onChange={(e) => {
                    setWeight(Number(e.target.value));
                    setAdded(false);
                  }}
                >
                  {[100, 250, 500, 1000].map((w) => (
                    <option key={w} value={w}>
                      {w === 1000 ? "1 kg" : `${w} g`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>{product.peso_produto}</p>
            )}
            <label className="field-label">
              Quantidade
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => {
                  setQuantity(
                    Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                  );
                  setAdded(false);
                }}
              />
            </label>
            <button className="button full-width" onClick={add}>
              {added ? <Check size={18} /> : <ShoppingBag size={18} />}
              {added ? "Adicionado ao carrinho" : "Adicionar ao carrinho"}
            </button>
            <p className="fine-print">
              Imagem ilustrativa. A seleção não reserva estoque. Confira
              ingredientes e alergênicos com a loja antes de pagar.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
