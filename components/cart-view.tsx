"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  MessageCircle,
  ShieldCheck,
  PackageCheck,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import { itemKey, lineTotal } from "@/lib/commerce.mjs";
import { referencePriceCents } from "@/lib/pricing.mjs";
import { WeightSelector } from "./weight-selector";
import { ProductImage } from "./product-card";
export function CartView() {
  const {
    cart,
    ready,
    updateQuantity,
    updateWeight,
    removeFromCart,
    itemCount,
    needsWeightReview,
  } = useCart();
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Meu carrinho</span>
      </div>
      <span className="eyebrow">CADA ESCOLHA É UM CUIDADO</span>
      <h1 className="page-title">
        Seu carrinho natural<span>.</span>
      </h1>
      <p className="section-description">
        Um pouquinho de natureza para levar para a sua rotina.
      </p>
      {needsWeightReview && (
        <p className="admin-notice" role="status">
          A venda a granel agora é de 100 em 100 g. As porções antigas com
          outros pesos foram retiradas do carrinho. Escolha novamente o peso
          desses produtos antes de finalizar.
        </p>
      )}
      {!ready ? (
        <p className="empty-state" role="status">
          Preparando seu carrinho…
        </p>
      ) : !cart.items.length ? (
        <div className="empty-state">
          <ShoppingBag size={48} strokeWidth={1} />
          <h2>Seu próximo favorito está esperando.</h2>
          <p>Explore nossos produtos e comece sua seleção.</p>
          <Link href="/produtos" className="button">
            Conhecer os produtos <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div>
            <div className="cart-list-title">
              <h2>Sua seleção</h2>
              <span>
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="cart-items">
              {cart.items.map((item) => (
                <article className="cart-item" key={itemKey(item)}>
                  <ProductImage product={item.product} />
                  <div className="cart-item-info">
                    <h3>{item.product.nome_produto}</h3>
                    <p>
                      {item.product.isGranel
                        ? `${item.selectedWeight} g por porção`
                        : item.product.peso_produto}
                    </p>
                    <span>
                      {formatPrice(referencePriceCents(item.product) / 100)}
                      {item.product.isGranel ? " por 100 g" : " por unidade"}
                    </span>
                    {item.product.isGranel && (
                      <div className="field-label cart-weight-field">
                        Peso por porção
                        <WeightSelector
                          name={item.product.nome_produto}
                          value={item.selectedWeight || 100}
                          onChange={(weight) =>
                            updateWeight(itemKey(item), weight)
                          }
                        />
                      </div>
                    )}
                    <div className="quantity-control">
                      <button
                        aria-label={`Diminuir ${item.product.nome_produto}`}
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          updateQuantity(itemKey(item), item.quantity - 1)
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <span
                        aria-label={
                          item.product.isGranel ? "Porções" : "Quantidade"
                        }
                      >
                        {item.quantity}
                      </span>
                      <button
                        aria-label={`Aumentar ${item.product.nome_produto}`}
                        disabled={item.quantity >= 99}
                        onClick={() =>
                          updateQuantity(itemKey(item), item.quantity + 1)
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-end">
                    <strong>{formatPrice(lineTotal(item))}</strong>
                    <button
                      className="remove-item"
                      aria-label={`Remover ${item.product.nome_produto}, ${item.selectedWeight || item.product.peso_produto}`}
                      onClick={() => removeFromCart(itemKey(item))}
                    >
                      <Trash2 size={16} />
                      <span>Remover</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <Link className="back-link" href="/produtos">
              <ArrowLeft size={16} /> Continuar escolhendo
            </Link>
          </div>
          <aside className="order-summary">
            <h2>Resumo da sua seleção</h2>
            <div>
              <span>Subtotal</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <div>
              <span>Entrega</span>
              <span>A combinar com a loja</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <p>
              Escolha Pix ou cartão pelo Mercado Pago para retirada na loja.
              Para entregas, confirme o frete pelo atendimento antes de pagar.
            </p>
            <Link href="/checkout" className="button full-width">
              Continuar com minha seleção <ArrowRight size={17} />
            </Link>
            <span className="summary-assurance">
              <MessageCircle size={16} /> Pix, cartão ou atendimento
            </span>
            <div className="summary-benefits">
              <span>
                <ShieldCheck size={17} /> Seus dados ficam sob seu controle
              </span>
              <span>
                <PackageCheck size={17} /> Entrega ou retirada a combinar
              </span>
            </div>
          </aside>
          <div className="mobile-purchase-bar">
            <div>
              <small>Total da seleção</small>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <Link href="/checkout" className="button">
              Continuar <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
