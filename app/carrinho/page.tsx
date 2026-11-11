"use client";
import { useState } from "react";
import { CustomerFields, type Buyer } from "@/components/customer-fields";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { ShopHeader, ShopFooter, money, post } from "@/components/shop-shell";
export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [delivery, choose] = useState("Entrega local"),
    [busy, wait] = useState(false),
    [error, issue] = useState(""),
    [receipt, ready] = useState<{ id: string; url: string } | null>(null);
  const [customer, change] = useState<Buyer>({
      name: "",
      email: "",
      phone: "",
      address: "",
      cep: "",
    }),
    [shipping, quote] = useState<number | null>(null);
  const charge = delivery === "Entrega local" ? shipping : 0;
  async function place() {
    wait(true);
    issue("");
    try {
      const items = cart.items.map((i) => ({
          id: i.product.id,
          qty: i.quantity,
          price: Math.round(i.product.valor_unitario * 100),
        })),
        stamp = JSON.stringify([delivery, items, charge]),
        cached = JSON.parse(sessionStorage.getItem("mn-checkout") || "null"),
        token = cached?.stamp === stamp ? cached.token : crypto.randomUUID();
      sessionStorage.setItem("mn-checkout", JSON.stringify({ stamp, token }));
      const r = await post({
        action: "order",
        items,
        delivery,
        token,
        customer,
        shipping: charge,
      });
      const message = [
        "Olá, Mundo Natural! Quero confirmar o pedido " + r.id,
        ...r.items.map(
          (p: { qty: number; name: string; weight: string; price: number }) =>
            p.qty +
            " × " +
            p.name +
            " " +
            p.weight +
            " — " +
            money(p.price * p.qty),
        ),
        "Frete: " + money(r.shipping || 0),
        "Total: " + money(r.total),
        "Pode me passar o total final e as instruções para pagamento por aqui?",
        r.delivery,
        r.delivery === "Entrega local"
          ? "Quero combinar o endereço, o frete e o prazo."
          : "Quero combinar a retirada.",
      ].join("\n");
      const url =
        "https://wa.me/" + r.phone + "?text=" + encodeURIComponent(message);
      ready({ id: r.id, url });
      clearCart();
      sessionStorage.removeItem("mn-checkout");
      window.location.assign(url);
    } catch (e) {
      issue((e as Error).message);
    } finally {
      wait(false);
    }
  }
  return (
    <div className="mn">
      <ShopHeader />
      <main className="inner">
        <h1>Seu carrinho</h1>
        {receipt ? (
          <section className="mn-panel">
            <h2>Pedido {receipt.id}</h2>
            <p>Envie a mensagem para combinar os detalhes com a loja.</p>
            <a className="solid" href={receipt.url}>
              Abrir o WhatsApp
            </a>
          </section>
        ) : !cart.items.length ? (
          <section className="mn-panel">
            <ShoppingBag />
            <p>Seu carrinho está vazio.</p>
            <Link href="/#catalogo" className="solid">
              Escolher produtos
            </Link>
          </section>
        ) : (
          <>
            <div className="mn-panel">
              {cart.items.map((i) => (
                <div key={i.product.id} className="rowline">
                  <div>
                    <strong>{i.product.nome_produto}</strong>
                    <br />
                    {i.product.peso_produto} ·{" "}
                    {money(Math.round(i.product.valor_unitario * 100))}
                  </div>
                  <div className="actions">
                    <button
                      aria-label="Diminuir"
                      disabled={i.quantity === 1}
                      onClick={() =>
                        updateQuantity(i.product.id, i.quantity - 1)
                      }
                    >
                      <Minus size={16} />
                    </button>
                    {i.quantity}
                    <button
                      aria-label="Aumentar"
                      disabled={i.quantity >= 999}
                      onClick={() =>
                        updateQuantity(i.product.id, i.quantity + 1)
                      }
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      aria-label="Remover"
                      onClick={() => removeFromCart(i.product.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
              <p>
                <strong>
                  Subtotal dos produtos · {money(Math.round(cart.total * 100))}
                </strong>
              </p>
            </div>
            <form
              className="mn-panel"
              onSubmit={(e) => {
                e.preventDefault();
                place();
              }}
            >
              <h2>Como quer receber?</h2>
              <label>
                Forma de recebimento
                <select
                  value={delivery}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option>Entrega local</option>
                  <option>Retirada na loja</option>
                </select>
              </label>
              <p>
                {delivery === "Entrega local"
                  ? "Entrega própria em Taboão da Serra e região. A loja confirma cobertura, frete e prazo pelo WhatsApp."
                  : "Retire na Rua José Duarte Souza, 25, Jardim Saint Morritz. Combine o horário pelo WhatsApp."}
              </p>
              <p>
                Ao continuar, o site registra sua solicitação e abre o WhatsApp.
                A loja confirma o total e envia as instruções de pagamento na
                conversa.
              </p>
              <CustomerFields
                buyer={customer}
                change={change}
                delivery={delivery === "Entrega local"}
                shipping={shipping}
                quote={quote}
              />
              {charge !== null && (
                <p>
                  <strong>
                    Total {money(Math.round(cart.total * 100) + charge)}
                  </strong>
                </p>
              )}
              <p>
                Usamos seus dados para atender e entregar este pedido.{" "}
                <Link href="/privacidade">Ver política de privacidade</Link>
              </p>
              <button className="solid" disabled={busy || charge === null}>
                {busy ? "Registrando…" : "Continuar para o WhatsApp"}
              </button>
              {error && (
                <p role="alert">
                  {error} <Link href="/#catalogo">Voltar ao catálogo</Link>
                </p>
              )}
            </form>
          </>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
