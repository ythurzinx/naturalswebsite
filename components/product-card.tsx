"use client";
import { useState } from "react";
import { Heart, Plus, Check, ShoppingBag, Package, Leaf } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice, productTile } from "@/lib/products";
import type { Product } from "@/lib/types";
import { Modal } from "./modal";
import { WeightSelector } from "./weight-selector";
import { lineTotal, normalizeQuantity } from "@/lib/commerce.mjs";
import { BULK_STEP_GRAMS, referencePriceCents } from "@/lib/pricing.mjs";
export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const packaged = /Suplementos|Fitoterápicos/.test(product.categoria);
  if (product.combo)
    return (
      <div
        className={`product-photo combo-photo ${className}`}
        role="img"
        aria-label={`Ingredientes de ${product.nome_produto}`}
      >
        {product.combo.slice(0, 4).map((component) => (
          <div key={component.productId}>
            {component.imagem &&
            /^\/(?:images\/products\/[a-z0-9-]+\.webp|api\/product-images\/[a-f0-9]{64})$/.test(
              component.imagem,
            ) ? (
              <img
                src={component.imagem}
                alt=""
                loading="lazy"
                width={320}
                height={320}
              />
            ) : (
              <Leaf size={30} />
            )}
            <span>{component.weight} g</span>
          </div>
        ))}
      </div>
    );
  if (
    product.imagem &&
    /^\/(?:images\/products\/[a-z0-9-]+\.webp|api\/product-images\/[a-f0-9]{64})$/.test(
      product.imagem,
    )
  )
    return (
      <div className={`product-photo product-custom-photo ${className}`}>
        <img
          src={product.imagem}
          alt={`${product.imagemLegenda || "Imagem ilustrativa"} — ${product.nome_produto}`}
          loading="lazy"
          decoding="async"
          width={640}
          height={640}
        />
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
    [weight, setWeight] = useState(BULK_STEP_GRAMS),
    [quantity, setQuantity] = useState(1),
    [added, setAdded] = useState(false);
  const favorite = favorites.includes(product.id);
  const price = referencePriceCents(product);
  const saving = product.originalPriceCents
    ? product.originalPriceCents - price
    : 0;
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
              {product.description ||
                "Escolha a quantidade ideal para suas receitas. Consulte ingredientes e informações de alergênicos com a nossa equipe."}
            </p>
            {saving > 0 && (
              <p className="detail-saving">
                <del>{formatPrice(product.originalPriceCents! / 100)}</del>{" "}
                Economize {formatPrice(saving / 100)}
              </p>
            )}
            <strong className="detail-price">
              {formatPrice(referencePriceCents(product) / 100)}
            </strong>
            <p className="muted">
              {product.combo
                ? "Preço do combo completo"
                : product.isGranel
                  ? "Preço por 100 g"
                  : "Preço por unidade"}
            </p>
            {product.combo && (
              <div className="combo-ingredients">
                <h3>O que vem no combo</h3>
                <ul>
                  {product.combo.map((component) => (
                    <li key={component.productId}>
                      <span>{component.name}</span>
                      <strong>{component.weight} g</strong>
                    </li>
                  ))}
                </ul>
                <p className="fine-print">
                  Cada ingrediente é embalado separadamente. As imagens são
                  ilustrativas; confira ingredientes e alergênicos.
                </p>
              </div>
            )}
            {product.isGranel ? (
              <div className="field-label">
                Escolha o peso (de 100 em 100 g)
                <WeightSelector
                  name={product.nome_produto}
                  value={weight}
                  onChange={(nextWeight) => {
                    setWeight(nextWeight);
                    setAdded(false);
                  }}
                />
              </div>
            ) : (
              <p>{product.peso_produto}</p>
            )}
            <label className="field-label">
              {product.isGranel ? "Quantidade de porções" : "Quantidade"}
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => {
                  setQuantity(normalizeQuantity(Number(e.target.value)));
                  setAdded(false);
                }}
              />
            </label>
            <p className="detail-selection-total">
              <span>
                Total da seleção
                {product.isGranel &&
                  ` · ${(weight * quantity).toLocaleString("pt-BR")} g`}
              </span>
              <strong>
                {formatPrice(
                  lineTotal({ product, quantity, selectedWeight: weight }),
                )}
              </strong>
            </p>
            <button className="button full-width" onClick={add}>
              {added ? <Check size={18} /> : <ShoppingBag size={18} />}
              {added ? "Adicionado ao carrinho" : "Adicionar ao carrinho"}
            </button>
            <p className="fine-print">
              {product.imagemLegenda ||
                "Fotos ilustrativas do produto ou de seus ingredientes."}{" "}
              A seleção não reserva estoque. Confira ingredientes e alergênicos
              com a loja antes de pagar.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
