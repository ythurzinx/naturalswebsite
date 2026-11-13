"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { MapPin, Truck, Store, CheckCircle2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useShipping } from "@/lib/shipping-context";
import { lineTotal } from "@/lib/commerce.mjs";
import { formatPrice } from "@/lib/products";
import { store, whatsappUrl } from "@/lib/store";
import type { Product } from "@/lib/types";
type Estimate = {
  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  distanceMeters: number;
  withinArea: boolean;
  enabled: boolean;
  feeCents: number | null;
};
export function ShippingPreview({
  product,
  weight = 100,
  quantity = 1,
}: {
  product?: Product;
  weight?: number;
  quantity?: number;
}) {
  const { cart } = useCart(),
    shipping = useShipping();
  const [cep, setCep] = useState(shipping.cep),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Estimate | null>(null);
  const sequence = useRef(0);
  const fingerprint = JSON.stringify(
    product
      ? [
          {
            id: product.id,
            quantity,
            weight: product.isGranel ? weight : undefined,
          },
        ]
      : cart.items.map((i) => ({
          id: i.product.id,
          quantity: i.quantity,
          weight: i.product.isGranel ? i.selectedWeight : undefined,
        })),
  );
  const subtotal = product
    ? Math.round(lineTotal({ product, quantity, selectedWeight: weight }) * 100)
    : Math.round(cart.total * 100);
  useEffect(() => {
    sequence.current++;
    setResult(null);
  }, [fingerprint, subtotal, cep]);
  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const requestId = ++sequence.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const session = await fetch("/api/shipping/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const proof = await session.json();
      if (!session.ok)
        throw Error(proof.error || "Consulte a loja para combinar a entrega.");
      const response = await fetch("/api/shipping/preview", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": proof.csrfToken,
        },
        body: JSON.stringify({
          items: JSON.parse(fingerprint),
          expectedSubtotalCents: subtotal,
          postalCode: cep,
        }),
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error || "Não foi possível consultar este CEP.");
      if (requestId === sequence.current) {
        setResult(value);
        shipping.setCep(cep);
      }
    } catch (e) {
      if (requestId === sequence.current)
        setError(
          e instanceof Error
            ? e.message
            : "Consulte a loja para combinar a entrega.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="shipping-preview">
      <div className="delivery-promise">
        <Truck size={21} />
        <div>
          <h3>Entrega no seu endereço</h3>
          <p>Consulte o valor pelo CEP antes de finalizar.</p>
        </div>
      </div>
      <form onSubmit={calculate} className="shipping-preview-form">
        <label className="field-label">
          CEP para consultar a entrega
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
            value={cep}
            onChange={(e) => {
              setCep(e.target.value.replace(/[^\d-]/g, ""));
              setResult(null);
            }}
            required
            pattern="[0-9]{5}-?[0-9]{3}"
          />
        </label>
        <button className="button button-small" disabled={busy}>
          {busy ? "Consultando…" : "Consultar frete"}
        </button>
      </form>
      {error && (
        <p className="payment-error" role="alert">
          {error}{" "}
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
            Falar com a loja
          </a>
        </p>
      )}
      {result && (
        <div className="shipping-preview-result" role="status">
          <CheckCircle2 size={21} />
          <div>
            <strong>
              {result.withinArea && result.feeCents !== null
                ? result.feeCents === 0
                  ? "Frete grátis nesta seleção"
                  : `Frete estimado: ${formatPrice(result.feeCents / 100)}`
                : "Consulte a equipe para este endereço"}
            </strong>
            <p>
              {result.address.street} · {result.address.neighborhood}
              <br />
              {result.address.city}/{result.address.state}
            </p>
            <small>
              Aproximadamente{" "}
              {(result.distanceMeters / 1000).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}{" "}
              km entre CEPs, em linha reta.
            </small>
          </div>
        </div>
      )}
      <p className="fine-print">
        {product
          ? "Estimativa para este produto e a quantidade selecionada. O carrinho confirma o total e possíveis condições de frete grátis."
          : cart.items.length
            ? "Estimativa para os itens que estão no seu carrinho."
            : "Tarifa de referência. Adicione os produtos para considerar condições de frete grátis."}{" "}
        O prazo é combinado com a loja.
      </p>
      <div className="pickup-preview">
        <Store size={21} />
        <div>
          <strong>Retirada na loja · sem frete</strong>
          <p>{store.address}</p>
          <small>Combine o horário pelo atendimento.</small>
        </div>
      </div>
    </section>
  );
}
