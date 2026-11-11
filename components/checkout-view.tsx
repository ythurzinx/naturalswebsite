"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  MessageCircle,
  ArrowLeft,
  ShieldCheck,
  Check,
  MapPin,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { itemKey, lineTotal } from "@/lib/commerce.mjs";
import { formatPrice } from "@/lib/products";
import { store, whatsappUrl } from "@/lib/store";
export function CheckoutView() {
  const { cart, ready } = useCart();
  const [name, setName] = useState(""),
    [method, setMethod] = useState("pickup"),
    [cep, setCep] = useState(""),
    [neighborhood, setNeighborhood] = useState(""),
    [notes, setNotes] = useState(""),
    [handoff, setHandoff] = useState(false);
  const message = [
    "Olá, Mundo Natural! Gostaria de consultar esta seleção:",
    ...cart.items.map(
      (item) =>
        `• ${item.quantity}x ${item.product.nome_produto} (${item.product.isGranel ? `${item.selectedWeight} g` : item.product.peso_produto}) — referência ${formatPrice(lineTotal(item))}`,
    ),
    `Subtotal de referência: ${formatPrice(cart.total)}`,
    `Nome: ${name.trim()}`,
    method === "pickup"
      ? "Preferência: retirar na loja"
      : `Preferência: entrega — CEP ${cep}, bairro ${neighborhood.trim()}`,
    notes.trim() ? `Observações: ${notes.trim()}` : "",
    "Podem confirmar os preços, a disponibilidade e as condições de entrega/pagamento?",
  ]
    .filter(Boolean)
    .join("\n");
  function submit(event: FormEvent) {
    event.preventDefault();
    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
    setHandoff(true);
  }
  return (
    <main id="conteudo" className="shell page-main">
      <Link href="/carrinho" className="back-link">
        <ArrowLeft size={15} /> Voltar ao carrinho
      </Link>
      <span className="eyebrow">O PRÓXIMO PASSO É UMA BOA CONVERSA</span>
      <h1 className="page-title">
        Vamos cuidar da sua seleção<span>?</span>
      </h1>
      <p className="section-description">
        Envie sua lista para a equipe. Confirme tudo antes de pagar.
      </p>
      {!ready ? (
        <p role="status">Carregando sua seleção…</p>
      ) : !cart.items.length ? (
        <div className="empty-state">
          <h2>Primeiro, escolha seus favoritos.</h2>
          <p>Seu carrinho está vazio.</p>
          <Link href="/produtos" className="button">
            Explorar produtos
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <form onSubmit={submit} className="checkout-form">
            <div className="form-section">
              <h2>
                <span>01</span> Como podemos chamar você?
              </h2>
              <label className="field-label">
                Seu nome
                <input
                  name="name"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome"
                />
              </label>
            </div>
            <div className="form-section">
              <h2>
                <span>02</span> Como prefere receber?
              </h2>
              <div className="delivery-options">
                <label className={method === "pickup" ? "selected" : ""}>
                  <input
                    type="radio"
                    name="method"
                    value="pickup"
                    checked={method === "pickup"}
                    onChange={() => setMethod("pickup")}
                  />
                  <strong>Retirar na loja</strong>
                  <span>Combine o melhor horário com a equipe.</span>
                </label>
                <label className={method === "delivery" ? "selected" : ""}>
                  <input
                    type="radio"
                    name="method"
                    value="delivery"
                    checked={method === "delivery"}
                    onChange={() => setMethod("delivery")}
                  />
                  <strong>Consultar entrega</strong>
                  <span>Área atendida, valor e prazo sob consulta.</span>
                </label>
              </div>
              {method === "delivery" ? (
                <div className="form-row">
                  <label className="field-label">
                    CEP
                    <input
                      name="postal-code"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      pattern="[0-9]{5}-?[0-9]{3}"
                      required
                      maxLength={9}
                      value={cep}
                      onChange={(e) =>
                        setCep(e.target.value.replace(/[^\d-]/g, ""))
                      }
                      placeholder="00000-000"
                    />
                  </label>
                  <label className="field-label">
                    Bairro e cidade
                    <input
                      name="neighborhood"
                      required
                      maxLength={120}
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Seu bairro e cidade"
                    />
                  </label>
                </div>
              ) : (
                <p className="pickup-address">
                  <MapPin size={18} />
                  {store.address}
                </p>
              )}
            </div>
            <div className="form-section">
              <h2>
                <span>03</span> Algum cuidado especial?
              </h2>
              <label className="field-label">
                Observações (opcional)
                <textarea
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Dúvidas sobre os produtos, alergênicos ou sua preferência de entrega…"
                />
              </label>
            </div>
            <p className="privacy-note">
              <ShieldCheck size={18} /> Esses dados não são armazenados pelo
              site. Ao continuar, você abre o WhatsApp e pode revisar a mensagem
              antes de enviá-la. <Link href="/privacidade">Saiba mais</Link>.
            </p>
            <button className="button" type="submit">
              <MessageCircle size={19} /> Continuar no WhatsApp
            </button>
            {handoff && (
              <div className="handoff-message" role="status">
                <Check size={19} />
                <div>
                  <strong>Sua mensagem está pronta.</strong>
                  <p>
                    Envie a mensagem no WhatsApp para iniciar o atendimento. Seu
                    pedido ainda precisa ser confirmado pela loja.
                  </p>
                  <a
                    href={whatsappUrl(message)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir a conversa novamente <MessageCircle size={13} />
                  </a>
                </div>
              </div>
            )}
          </form>
          <aside className="order-summary">
            <h2>Sua seleção</h2>
            {cart.items.map((item) => (
              <div className="checkout-summary-item" key={itemKey(item)}>
                <span>
                  {item.quantity}× {item.product.nome_produto}
                  <small>
                    {item.product.isGranel
                      ? `${item.selectedWeight} g`
                      : item.product.peso_produto}
                  </small>
                </span>
                <strong>{formatPrice(lineTotal(item))}</strong>
              </div>
            ))}
            <div className="summary-total">
              <span>Subtotal de referência</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <p>
              Frete a combinar. O atendimento confirmará o preço atualizado, a
              disponibilidade e a forma de pagamento. A seleção permanece no
              carrinho.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
