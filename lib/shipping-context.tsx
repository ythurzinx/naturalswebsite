"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useCart } from "./cart-context";
export type ShippingSettings = {
  enabled: boolean;
  originPostalCode: string;
  pricePerKmCents: number;
  baseFeeCents: number;
  minimumFeeCents: number;
  maxDistanceMeters: number;
  freeAboveCents: number | null;
  revision: number;
};
export type ShippingQuote = {
  quoteToken: string;
  feeCents: number;
  distanceMeters: number;
  subtotalCents: number;
  revision: number;
  expiresAt: number;
  address: {
    postalCode: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  };
};
const defaults: ShippingSettings = {
  enabled: false,
  originPostalCode: "",
  pricePerKmCents: 0,
  baseFeeCents: 0,
  minimumFeeCents: 0,
  maxDistanceMeters: 10000,
  freeAboveCents: null,
  revision: 0,
};
function useShippingState() {
  const { cart } = useCart();
  const pathname = usePathname();
  const [settings, setSettings] = useState(defaults),
    [method, setMethod] = useState("pickup"),
    [cep, setCep] = useState(""),
    [quote, setQuote] = useState<ShippingQuote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [number, setNumber] = useState(""),
    [complement, setComplement] = useState(""),
    [phone, setPhone] = useState("");
  const fingerprint = JSON.stringify(
    cart.items.map((i) => [
      i.product.id,
      i.quantity,
      i.selectedWeight,
      i.product.valor_unitario,
      i.product.combo,
    ]),
  );
  const current = useRef({ fingerprint, cep });
  current.current = { fingerprint, cep };
  const subtotalCents = Math.round(cart.total * 100);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/shipping/settings", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw Error();
      setSettings(await response.json());
    } catch {
      setSettings((prior) => ({ ...prior, enabled: false }));
    }
  }, []);
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, pathname]);
  useEffect(() => {
    setQuote(null);
  }, [fingerprint, cep]);
  useEffect(() => {
    if (quote && (!settings.enabled || quote.revision !== settings.revision))
      setQuote(null);
  }, [settings, quote]);
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(
      () => {
        setQuote(null);
        setError("O frete expirou. Calcule novamente antes de pagar.");
      },
      Math.max(0, quote.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [quote]);
  async function calculate() {
    if (busy) return;
    setBusy(true);
    setError("");
    setQuote(null);
    const attempt = { fingerprint, cep };
    try {
      const session = await fetch("/api/shipping/session", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!session.ok)
        throw Error("O cálculo está indisponível. Fale com a equipe.");
      const { csrfToken } = await session.json();
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          postalCode: cep,
          expectedSubtotalCents: subtotalCents,
          items: cart.items.map((i) => ({
            id: i.product.id,
            quantity: i.quantity,
            ...(i.product.isGranel ? { weight: i.selectedWeight } : {}),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Não foi possível calcular o frete.");
      if (
        current.current.fingerprint !== attempt.fingerprint ||
        current.current.cep !== attempt.cep
      )
        return;
      setSettings((prior) => ({ ...prior, revision: result.revision }));
      setQuote(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Falha ao consultar o CEP.",
      );
    } finally {
      setBusy(false);
    }
  }
  const validQuote =
    quote &&
    quote.subtotalCents === subtotalCents &&
    quote.revision === settings.revision &&
    quote.expiresAt > Date.now()
      ? quote
      : null;
  return {
    settings,
    method,
    setMethod,
    cep,
    setCep,
    quote: validQuote,
    busy,
    error,
    calculate,
    number,
    setNumber,
    complement,
    setComplement,
    phone,
    setPhone,
    totalCents:
      subtotalCents +
      (method === "delivery" && validQuote ? validQuote.feeCents : 0),
    canPay: method === "pickup" || !!validQuote,
  };
}
const ShippingContext = createContext<ReturnType<
  typeof useShippingState
> | null>(null);
export function ShippingProvider({ children }: { children: ReactNode }) {
  const value = useShippingState();
  return (
    <ShippingContext.Provider value={value}>
      {children}
    </ShippingContext.Provider>
  );
}
export function useShipping() {
  const value = useContext(ShippingContext);
  if (!value) throw Error("ShippingProvider ausente");
  return value;
}
