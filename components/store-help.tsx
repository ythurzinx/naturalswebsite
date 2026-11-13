"use client";
import Link from "next/link";
import {
  Leaf,
  ShieldCheck,
  Truck,
  MessageSquareText,
  ArrowRight,
} from "lucide-react";
export function StoreHelp() {
  return (
    <section className="shell store-help-section">
      <div className="store-help-grid">
        <div>
          <span className="eyebrow">COMPRAR BEM TAMBÉM É SABER</span>
          <h2>Seu natural, sem complicação.</h2>
          <p>
            Da escolha do ingrediente até a sua cozinha, encontre o que precisa
            para montar seu pedido.
          </p>
          <div className="store-help-badges">
            <span>
              <Leaf size={17} />
              Porções de 100 em 100 g
            </span>
            <span>
              <Truck size={17} />
              Frete consultado pelo CEP
            </span>
            <span>
              <ShieldCheck size={17} />
              Pix e cartão via Mercado Pago
            </span>
          </div>
        </div>
        <div className="store-faq">
          <details>
            <summary>Como funcionam os preços a granel?</summary>
            <p>
              O preço exibido é para 100 g. Abra o produto e escolha 100 g, 200
              g, 300 g ou outra porção em passos de 100 g. A ficha e o carrinho
              mostram o valor exato da sua seleção.
            </p>
          </details>
          <details>
            <summary>Posso calcular a entrega antes de comprar?</summary>
            <p>
              Sim. Toque em “Consulte seu CEP” no topo ou abra a aba Entrega do
              produto. A distância é uma estimativa entre CEPs e o valor final é
              confirmado no carrinho.
            </p>
          </details>
          <details>
            <summary>Onde encontro composição e alergênicos?</summary>
            <p>
              A aba Detalhes traz orientações sobre o ingrediente. A composição
              exata, os possíveis traços e a validade dependem do lote e devem
              ser confirmados com a loja antes da compra.
            </p>
          </details>
          <details>
            <summary>Como acompanho meu pedido?</summary>
            <p>
              Consulte o status pelo mesmo navegador usado no pagamento. Guarde
              o número do pedido para falar com nossa equipe.
            </p>
            <Link href="/pagamento/retorno">Acompanhar pedido</Link>
          </details>
          <details>
            <summary>Como funcionam as avaliações?</summary>
            <p>
              Quem recebeu um pedido concluído pode avaliar seus produtos pelo
              navegador da compra. Só publicamos avaliações de compras
              verificadas, após análise do conteúdo.
            </p>
            <Link href="/avaliacoes">Conhecer as avaliações</Link>
          </details>
          <details>
            <summary>Preciso de ajuda com trocas ou com a compra?</summary>
            <p>
              Nossa equipe atende pelo WhatsApp. Confira também as condições e
              orientações da loja.
            </p>
            <Link href="/termos">Condições de compra</Link>
          </details>
        </div>
      </div>
      <Link className="store-review-banner" href="/avaliacoes">
        <MessageSquareText size={28} />
        <div>
          <strong>Sua experiência ajuda a próxima escolha.</strong>
          <span>
            Conte como foi sua compra ou conheça as avaliações de clientes.
          </span>
        </div>
        <ArrowRight size={20} />
      </Link>
    </section>
  );
}
