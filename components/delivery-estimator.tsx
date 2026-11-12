"use client";
import { MapPin, Truck, Store, CheckCircle2 } from "lucide-react";
import { useShipping } from "@/lib/shipping-context";
import { formatPrice } from "@/lib/products";
import { store } from "@/lib/store";
export function DeliveryEstimator({ details = false }: { details?: boolean }) {
  const shipping = useShipping();
  return (
    <div className="delivery-estimator">
      <div className="delivery-options">
        <label className={shipping.method === "pickup" ? "selected" : ""}>
          <input
            type="radio"
            name="fulfillment"
            checked={shipping.method === "pickup"}
            onChange={() => shipping.setMethod("pickup")}
          />
          <Store size={20} />
          <strong>Retirar na loja</strong>
          <span>Sem frete</span>
        </label>
        <label className={shipping.method === "delivery" ? "selected" : ""}>
          <input
            type="radio"
            name="fulfillment"
            checked={shipping.method === "delivery"}
            onChange={() => shipping.setMethod("delivery")}
          />
          <Truck size={20} />
          <strong>Receber em casa</strong>
          <span>
            {shipping.settings.enabled
              ? "Calcule pelo seu CEP"
              : "Consulte a equipe"}
          </span>
        </label>
      </div>
      {shipping.method === "pickup" ? (
        <p className="pickup-address">
          <MapPin size={18} />
          {store.address}
        </p>
      ) : (
        <>
          <div className="shipping-cep-row">
            <label className="field-label">
              CEP de entrega
              <input
                name="postal-code"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={9}
                value={shipping.cep}
                onChange={(e) =>
                  shipping.setCep(e.target.value.replace(/[^\d-]/g, ""))
                }
                placeholder="00000-000"
              />
            </label>
            <button
              type="button"
              className="button button-small"
              disabled={
                !shipping.settings.enabled ||
                shipping.busy ||
                !/^\d{5}-?\d{3}$/.test(shipping.cep)
              }
              onClick={() => void shipping.calculate()}
            >
              {shipping.busy ? "Calculando…" : "Calcular frete"}
            </button>
          </div>
          {!shipping.settings.enabled && (
            <p className="privacy-note">
              A entrega online está em configuração. Combine o frete com a
              equipe pelo WhatsApp.
            </p>
          )}
          {shipping.error && (
            <p className="payment-error" role="alert">
              {shipping.error}
            </p>
          )}
          {shipping.quote && (
            <div className="shipping-result" role="status">
              <CheckCircle2 size={20} />
              <div>
                <strong>
                  {shipping.quote.feeCents === 0
                    ? "Frete grátis"
                    : `Frete: ${formatPrice(shipping.quote.feeCents / 100)}`}
                </strong>
                <p>
                  <span className="fine-print">
                    Endereço encontrado pelo CEP
                  </span>
                  <br />
                  {shipping.quote.address.street} ·{" "}
                  {shipping.quote.address.neighborhood}
                  <br />
                  {shipping.quote.address.city} / {shipping.quote.address.state}
                </p>
                <small>
                  Aprox.{" "}
                  {(shipping.quote.distanceMeters / 1000).toLocaleString(
                    "pt-BR",
                    { maximumFractionDigits: 1 },
                  )}{" "}
                  km entre CEPs, em linha reta. Cotação válida por 10 minutos.
                </small>
              </div>
            </div>
          )}
          {details && (
            <>
              <div className="form-row">
                <label className="field-label">
                  Número ou s/n
                  <input
                    required
                    maxLength={20}
                    autoComplete="address-line2"
                    value={shipping.number}
                    onChange={(e) => shipping.setNumber(e.target.value)}
                    placeholder="Ex.: 123"
                  />
                </label>
                <label className="field-label">
                  Complemento (opcional)
                  <input
                    maxLength={120}
                    value={shipping.complement}
                    onChange={(e) => shipping.setComplement(e.target.value)}
                    placeholder="Apartamento, bloco…"
                  />
                </label>
              </div>
              <label className="field-label">
                Telefone para a entrega
                <input
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={20}
                  value={shipping.phone}
                  onChange={(e) => shipping.setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </label>
              <p className="privacy-note">
                Confira se a rua retornada corresponde ao seu endereço. Se não
                corresponder, fale com a equipe antes de pagar.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
