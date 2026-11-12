"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  MessageCircle,
  ArrowLeft,
  ShieldCheck,
  Check,
  CreditCard,
  QrCode,
  LockKeyhole,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { itemKey, lineTotal } from "@/lib/commerce.mjs";
import { referencePriceCents } from "@/lib/pricing.mjs";
import { formatPrice } from "@/lib/products";
import { whatsappUrl } from "@/lib/store";
import { usePaymentCheckout } from "@/hooks/use-payment-checkout";
import { useShipping } from "@/lib/shipping-context";
import { DeliveryEstimator } from "./delivery-estimator";
export function CheckoutView() {
  const { cart, ready, needsWeightReview } = useCart();
  const payment = usePaymentCheckout();
  const shipping = useShipping();
  const { method } = shipping;
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [paymentMethod, setPaymentMethod] = useState("mercadopago"),
    [notes, setNotes] = useState(""),
    [whatsappOptIn, setWhatsappOptIn] = useState(false),
    [handoff, setHandoff] = useState(false);
  useEffect(() => {
    if (!payment.checking && !payment.available) setPaymentMethod("whatsapp");
  }, [payment.checking, payment.available]);
  const online = paymentMethod === "mercadopago";
  const message = [
    "Olá, Mundo Natural! Gostaria de consultar esta seleção:",
    ...cart.items.map(
      (item) =>
        `• ${item.quantity}x ${item.product.nome_produto} (${item.product.isGranel ? `${item.selectedWeight} g` : item.product.peso_produto}) — ${formatPrice(lineTotal(item))}`,
    ),
    `Subtotal: ${formatPrice(cart.total)}`,
    `Nome: ${name.trim()}`,
    method === "pickup"
      ? "Preferência: retirar na loja"
      : `Preferência: entrega — CEP ${shipping.cep}${shipping.quote ? `, ${shipping.quote.address.street}, ${shipping.number}, ${shipping.complement} · ${shipping.quote.address.neighborhood} · ${shipping.quote.address.city}/${shipping.quote.address.state} · Frete ${formatPrice(shipping.quote.feeCents / 100)}` : " · frete a confirmar"}`,
    shipping.phone ? `Telefone: ${shipping.phone}` : "",
    notes.trim() ? `Observações: ${notes.trim()}` : "",
    "Podem confirmar a disponibilidade e as condições de entrega/pagamento?",
  ]
    .filter(Boolean)
    .join("\n");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (online)
      await payment.pay(cart, name, email, method, {
        totalCents: shipping.totalCents,
        notes,
        phone: shipping.phone,
        whatsappOptIn,
        ...(method === "delivery" && shipping.quote
          ? {
              delivery: {
                quoteToken: shipping.quote.quoteToken,
                number: shipping.number,
                complement: shipping.complement,
              },
            }
          : {}),
      });
    else {
      window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
      setHandoff(true);
    }
  }
  return (
    <main id="conteudo" className="shell page-main">
      <Link href="/carrinho" className="back-link">
        <ArrowLeft size={15} /> Voltar ao carrinho
      </Link>
      <span className="eyebrow">CADA ESCOLHA É UM CUIDADO</span>
      <h1 className="page-title">
        Finalize sua compra<span>.</span>
      </h1>
      <p className="section-description">
        Pague com Pix ou cartão pelo Mercado Pago, ou converse com nossa equipe.
      </p>
      {needsWeightReview && (
        <p className="admin-notice" role="status">
          As porções antigas fora dos múltiplos de 100 g foram retiradas.
          <Link href="/carrinho"> Revise os pesos no carrinho</Link> antes de
          pagar.
        </p>
      )}
      {payment.testMode && (
        <p className="payment-error">
          Ambiente de testes: esta compra não é uma venda de produção.
        </p>
      )}
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
          <form id="checkout-form" onSubmit={submit} className="checkout-form">
            <fieldset disabled={payment.busy} className="checkout-fieldset">
              <div className="form-section">
                <h2>
                  <span>01</span> Como podemos chamar você?
                </h2>
                <label className="field-label">
                  Seu nome
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Digite seu nome"
                  />
                </label>
                {online && (
                  <label className="field-label">
                    E-mail para o pagamento
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={180}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com.br"
                    />
                  </label>
                )}
                <label className="field-label">
                  Telefone para contato
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    minLength={10}
                    maxLength={20}
                    value={shipping.phone}
                    onChange={(e) => shipping.setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    aria-describedby="checkout-phone-help"
                  />
                </label>
                <p id="checkout-phone-help" className="fine-print">
                  Inclua o DDD. A loja usa este contato para cuidar do seu
                  pedido, inclusive na retirada.
                </p>
                {online && (
                  <label className="checkout-contact-consent">
                    <input
                      type="checkbox"
                      checked={whatsappOptIn}
                      onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    />
                    <span>
                      Quero receber atualizações deste pedido pelo WhatsApp.
                      <small>
                        Opcional. Aprovação, separação e saída para entrega, sem
                        mensagens promocionais.
                      </small>
                    </span>
                  </label>
                )}
              </div>
              <div className="form-section">
                <h2>
                  <span>02</span> Como prefere receber?
                </h2>
                <DeliveryEstimator details />
              </div>
              <div className="form-section">
                <h2>
                  <span>03</span> Escolha como pagar
                </h2>
                {payment.checking && (
                  <p className="muted" role="status">
                    Consultando os meios de pagamento…
                  </p>
                )}
                <div className="payment-methods">
                  <label
                    className={`${online ? "selected" : ""} ${!payment.available || !shipping.canPay ? "unavailable" : ""}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="mercadopago"
                      checked={online}
                      disabled={!payment.available || !shipping.canPay}
                      onChange={() => setPaymentMethod("mercadopago")}
                    />
                    <span>
                      <CreditCard size={22} />
                      <QrCode size={21} />
                    </span>
                    <div>
                      <strong>Pix ou cartão</strong>
                      <p>
                        Pagamento no ambiente protegido do Mercado Pago. Entrega
                        com frete calculado ou retirada na loja.
                      </p>
                    </div>
                  </label>
                  <label className={!online ? "selected" : ""}>
                    <input
                      type="radio"
                      name="payment"
                      value="whatsapp"
                      checked={!online}
                      onChange={() => setPaymentMethod("whatsapp")}
                    />
                    <span>
                      <MessageCircle size={23} />
                    </span>
                    <div>
                      <strong>Combinar com a equipe</strong>
                      <p>
                        Envie sua lista pelo WhatsApp e confirme os detalhes da
                        compra.
                      </p>
                    </div>
                  </label>
                </div>
                {!payment.checking && !payment.available && (
                  <p className="privacy-note">
                    O pagamento online está temporariamente indisponível. Nossa
                    equipe pode ajudar pelo atendimento.
                  </p>
                )}
                {online && (
                  <p className="payment-assurance">
                    <LockKeyhole size={17} /> Você escolherá Pix ou cartão na
                    próxima etapa. A loja não recebe nem armazena o número do
                    seu cartão.
                  </p>
                )}
                <label className="field-label">
                  Observações (opcional)
                  <textarea
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Dúvidas sobre produtos, alergênicos ou entrega…"
                  />
                </label>
              </div>
              <p className="privacy-note">
                <ShieldCheck size={18} />{" "}
                {online
                  ? "Seu nome, e-mail e os itens da compra serão enviados ao Mercado Pago para o pagamento. A loja recebe seu telefone para cuidar do pedido e, na entrega, seu endereço. Atualizações pelo WhatsApp dependem da sua escolha acima. Cookies essenciais protegem sua sessão e o acesso ao pedido."
                  : "Ao continuar, você abre o WhatsApp e pode revisar a mensagem antes de enviá-la."}{" "}
                <Link href="/privacidade">Saiba mais</Link>.
              </p>
              {payment.error && online && (
                <p className="payment-error" role="alert">
                  {payment.error}
                </p>
              )}
              <button
                className="button full-width"
                type="submit"
                disabled={
                  payment.busy ||
                  (online &&
                    (payment.checking ||
                      !payment.available ||
                      !shipping.canPay))
                }
              >
                {online ? (
                  <>
                    <LockKeyhole size={18} />
                    {payment.busy
                      ? "Preparando pagamento…"
                      : `Pagar ${formatPrice(shipping.totalCents / 100)} com Mercado Pago`}
                  </>
                ) : (
                  <>
                    <MessageCircle size={19} /> Continuar no WhatsApp
                  </>
                )}
              </button>
            </fieldset>
            {handoff && !online && (
              <div className="handoff-message" role="status">
                <Check size={19} />
                <div>
                  <strong>Sua mensagem está pronta.</strong>
                  <p>
                    Envie a mensagem no WhatsApp para iniciar o atendimento. A
                    compra ainda precisa ser confirmada pela loja.
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
                      ? `${item.selectedWeight} g por porção · ${formatPrice(referencePriceCents(item.product) / 100)} por 100 g`
                      : item.product.peso_produto}
                  </small>
                </span>
                <strong>{formatPrice(lineTotal(item))}</strong>
              </div>
            ))}
            <div>
              <span>Recebimento</span>
              <span>
                {method === "pickup"
                  ? "Retirada na loja · sem frete"
                  : shipping.quote
                    ? `Entrega · ${formatPrice(shipping.quote.feeCents / 100)}`
                    : "Entrega · calcule o frete"}
              </span>
            </div>
            <div className="summary-total">
              <span>{shipping.canPay ? "Total" : "Subtotal sem frete"}</span>
              <strong>{formatPrice(shipping.totalCents / 100)}</strong>
            </div>
            <p>
              {online
                ? "O pagamento só é confirmado após consulta ao Mercado Pago. A equipe prepara o pedido após a aprovação; combine o prazo de entrega ou retirada."
                : "Envie a seleção e confirme disponibilidade, frete e pagamento com a equipe."}
            </p>
            <span className="summary-assurance">
              <ShieldCheck size={16} /> Confira os itens antes de confirmar
            </span>
          </aside>
          <div className="mobile-purchase-bar">
            <div>
              <small>{online ? "Total a pagar" : "Sua seleção"}</small>
              <strong>{formatPrice(shipping.totalCents / 100)}</strong>
            </div>
            <button
              form="checkout-form"
              type="submit"
              className="button"
              disabled={
                payment.busy ||
                (online &&
                  (payment.checking || !payment.available || !shipping.canPay))
              }
            >
              {payment.busy
                ? "Aguarde…"
                : online
                  ? "Pagar agora"
                  : "Ir ao WhatsApp"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
