"use client";
import { useEffect, useState } from "react";
import {
  Check,
  ShoppingBag,
  BookOpen,
  Leaf,
  Truck,
  Star,
  Share2,
  PackageCheck,
  ShieldCheck,
  Clock3,
  Utensils,
} from "lucide-react";
import { Modal } from "./modal";
import { ProductImage } from "./product-image";
import { WeightSelector } from "./weight-selector";
import { ShippingPreview } from "./shipping-preview";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import { lineTotal, normalizeQuantity } from "@/lib/commerce.mjs";
import { referencePriceCents } from "@/lib/pricing.mjs";
import type { Product, ProductContent } from "@/lib/types";
import { ProductReviews } from "./product-reviews";

export function ProductQuickView({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { addToCart } = useCart();
  const [weight, setWeight] = useState(100),
    [quantity, setQuantity] = useState(1),
    [added, setAdded] = useState(false),
    [tab, setTab] = useState("details"),
    [content, setContent] = useState<ProductContent | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [shared, setShared] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    fetch(`/api/products/${encodeURIComponent(product.id)}/content`, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (!d.content) throw Error();
        setContent(d.content);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            "Não foi possível carregar as informações. Tente abrir o produto novamente ou fale com a loja.",
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [product.id]);
  async function share() {
    const url = `${location.origin}/produtos?produto=${encodeURIComponent(product.id)}`;
    try {
      if (navigator.share)
        await navigator.share({ title: product.nome_produto, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared("Link copiado!");
      }
    } catch {
      setShared(url);
    }
  }
  const tabs = [
    { id: "details", label: "Detalhes", Icon: Leaf },
    {
      id: "recipe",
      label: content?.kind && content.kind !== "food" ? "Como usar" : "Receita",
      Icon: BookOpen,
    },
    { id: "delivery", label: "Entrega", Icon: Truck },
    { id: "reviews", label: "Avaliações", Icon: Star },
  ];
  const amount = lineTotal({ product, quantity, selectedWeight: weight });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={product.nome_produto}
      wide
      className="product-quick-view"
    >
      <div className="quick-product-top">
        <ProductImage product={product} />
        <div className="quick-product-summary">
          <span className="eyebrow">
            {product.combo
              ? "COMBO DA LOJA"
              : product.isGranel
                ? "A GRANEL · NA SUA MEDIDA"
                : product.categoria}
          </span>
          <strong className="detail-price">
            {formatPrice(referencePriceCents(product) / 100)}
            <small>
              {product.isGranel
                ? "/ 100 g"
                : product.combo
                  ? "/ combo"
                  : "/ unidade"}
            </small>
          </strong>
          {product.originalPriceCents && (
            <p className="detail-saving">
              De <del>{formatPrice(product.originalPriceCents / 100)}</del>
            </p>
          )}
          <p className="quick-summary-description">
            {product.description ||
              content?.description ||
              "Escolha a porção que combina com sua rotina."}
          </p>
          <div className="quick-trust">
            <span>
              <PackageCheck size={15} />
              Separado pela loja
            </span>
            <span>
              <ShieldCheck size={15} />
              Pagamento via Mercado Pago
            </span>
          </div>
          <button
            className="text-button product-share"
            onClick={() => void share()}
          >
            <Share2 size={16} />
            Compartilhar produto
          </button>
          {shared && (
            <p className="fine-print" role="status">
              {shared}
            </p>
          )}
        </div>
      </div>
      {product.combo && (
        <div className="combo-ingredients">
          <h3>O que vem no combo</h3>
          <ul>
            {product.combo.map((c) => (
              <li key={c.productId}>
                <span>{c.name}</span>
                <strong>{c.weight} g</strong>
              </li>
            ))}
          </ul>
          <p className="fine-print">Ingredientes embalados separadamente.</p>
        </div>
      )}
      <div className="quick-selection">
        <div className="field-label">
          {product.isGranel
            ? "Escolha o peso (de 100 em 100 g)"
            : "Apresentação"}
          {product.isGranel ? (
            <WeightSelector
              name={product.nome_produto}
              value={weight}
              onChange={(n) => {
                setWeight(n);
                setAdded(false);
              }}
            />
          ) : (
            <p>{product.peso_produto}</p>
          )}
        </div>
        <label className="field-label">
          {product.isGranel ? "Quantidade de porções" : "Quantidade"}
          <input
            type="number"
            min={1}
            max={20}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              setQuantity(
                Math.min(20, normalizeQuantity(Number(e.target.value))),
              );
              setAdded(false);
            }}
          />
        </label>
      </div>
      <div
        className="product-detail-tabs"
        role="tablist"
        aria-label="Informações do produto"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const current = tabs.findIndex((t) => t.id === tab);
          const index =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? tabs.length - 1
                : (current + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length;
          setTab(tabs[index].id);
          document.getElementById(`product-tab-${tabs[index].id}`)?.focus();
        }}
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            role="tab"
            type="button"
            id={`product-tab-${id}`}
            key={id}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            aria-controls={`product-panel-${id}`}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div
        className="product-guide-panel"
        id={`product-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`product-tab-${tab}`}
      >
        {(tab === "details" || tab === "recipe") && loading && (
          <p className="guide-loading" role="status">
            Carregando informações do produto…
          </p>
        )}
        {(tab === "details" || tab === "recipe") && error && (
          <p className="payment-error">{error}</p>
        )}
        {tab === "details" && content && (
          <>
            <p className="product-description-full">{content.description}</p>
            <h3>Benefícios e características</h3>
            <ul className="product-highlights">
              {content.highlights.map((s) => (
                <li key={s}>
                  <Check size={17} />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <h3>Como aproveitar</h3>
            <p>{content.usage}</p>
            {content.notes.length > 0 && (
              <div className="product-care-note">
                {content.notes.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
            )}
            <details open className="guide-accordion">
              <summary>Ingredientes e alergênicos</summary>
              <p>{content.allergens}</p>
            </details>
            <details className="guide-accordion">
              <summary>Como conservar</summary>
              <p>{content.storage}</p>
            </details>
            <details className="guide-accordion">
              <summary>Referências das informações</summary>
              <p>
                Informações gerais do ingrediente, sem substituir o rótulo do
                lote. Receitas são sugestões culinárias da loja.
              </p>
              <ul>
                {content.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        {tab === "recipe" &&
          content &&
          (content.recipe ? (
            <article className="recipe-card">
              <span className="eyebrow">IDEIA PARA SUA COZINHA</span>
              <h3>{content.recipe.title}</h3>
              <div className="recipe-meta">
                <span>
                  <Clock3 size={16} />
                  {content.recipe.minutes} min
                </span>
                <span>
                  <Utensils size={16} />
                  {content.recipe.servings}
                </span>
              </div>
              <h4>Ingredientes</h4>
              <ul>
                {content.recipe.ingredients.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <h4>Modo de preparo</h4>
              <ol>
                {content.recipe.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="fine-print">
                Tempo aproximado. Confira os ingredientes da receita em caso de
                alergias ou restrições alimentares.
              </p>
            </article>
          ) : (
            <div className="recipe-card">
              <BookOpen size={28} />
              <h3>Orientações de uso</h3>
              <p>{content.usage}</p>
              {content.notes.map((s) => (
                <p className="fine-print" key={s}>
                  {s}
                </p>
              ))}
              <p className="fine-print">
                Este item não recebeu receita de ingestão automática. Confirme a
                finalidade e as orientações do fabricante com a loja.
              </p>
            </div>
          ))}
        {tab === "delivery" && (
          <ShippingPreview
            product={product}
            weight={weight}
            quantity={quantity}
          />
        )}
        {tab === "reviews" && <ProductReviews productId={product.id} />}
      </div>
      <p className="quick-image-note">
        {product.imagemLegenda ||
          "Imagem ilustrativa. A apresentação pode variar."}
      </p>
      <div className="quick-purchase-bar">
        <p className="detail-selection-total">
          <span>
            Total da seleção
            {product.isGranel &&
              ` · ${(weight * quantity).toLocaleString("pt-BR")} g`}
          </span>
          <strong>{formatPrice(amount)}</strong>
        </p>
        <button
          className="button"
          onClick={() => {
            addToCart(product, quantity, weight);
            setAdded(true);
          }}
        >
          {added ? <Check size={19} /> : <ShoppingBag size={19} />}
          <span>
            {added ? "Adicionado ao carrinho" : "Adicionar ao carrinho"}
          </span>
        </button>
      </div>
    </Modal>
  );
}
