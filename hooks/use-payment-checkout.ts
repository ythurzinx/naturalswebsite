"use client";
import { useEffect, useRef, useState } from "react";
import type { Cart } from "@/lib/types";

export function usePaymentCheckout() {
  const [available, setAvailable] = useState(false),
    [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [testMode, setTestMode] = useState(false);
  const csrf = useRef(""),
    submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/checkout/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((data) => {
        csrf.current = typeof data.csrfToken === "string" ? data.csrfToken : "";
        setAvailable(data.available === true && !!csrf.current);
        setTestMode(data.testMode === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, []);
  async function pay(
    cart: Cart,
    name: string,
    email: string,
    fulfillment: string,
    options: {
      totalCents?: number;
      notes?: string;
      phone?: string;
      delivery?: { quoteToken: string; number: string; complement: string };
    } = {},
  ) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!available || !csrf.current)
        throw Error(
          "Pagamento online indisponível. Atualize a página ou fale com a equipe.",
        );
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf.current,
        },
        body: JSON.stringify({
          items: cart.items.map((item) => ({
            id: item.product.id,
            quantity: item.quantity,
            ...(item.product.isGranel ? { weight: item.selectedWeight } : {}),
          })),
          name,
          email,
          fulfillment,
          expectedTotalCents:
            options.totalCents ?? Math.round(cart.total * 100),
          ...(options.notes ? { notes: options.notes } : {}),
          ...(options.phone ? { phone: options.phone } : {}),
          ...(options.delivery ? { delivery: options.delivery } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          typeof result.error === "string"
            ? result.error
            : "Não foi possível iniciar o pagamento.",
        );
      const url = new URL(result.checkoutUrl);
      if (
        url.protocol !== "https:" ||
        !["www.mercadopago.com.br", "mercadopago.com.br"].includes(
          url.hostname,
        ) ||
        url.username ||
        url.password ||
        url.port ||
        url.pathname !== "/checkout/v1/redirect"
      )
        throw Error("Endereço de pagamento inválido. Fale com a loja.");
      window.location.assign(url.toString());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o pagamento.",
      );
      setBusy(false);
      submitting.current = false;
    }
  }
  return { available, checking, busy, error, pay, testMode };
}
