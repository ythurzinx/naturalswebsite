"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Cart, CartItem, Product } from "./types";
import { products } from "./products";
import {
  CART_KEY,
  hydrateCart,
  serializeCart,
  cartTotal,
  itemKey,
  normalizeQuantity,
  normalizeWeight,
} from "./commerce.mjs";
import {
  CONSENT_EVENT,
  CONSENT_KEY,
  FAVORITES_KEY,
  readConsent,
} from "./privacy.mjs";
interface StoreContext {
  cart: Cart;
  ready: boolean;
  itemCount: number;
  favorites: string[];
  addToCart: (product: Product, quantity: number, weight?: number) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (id: string) => void;
}
const Context = createContext<StoreContext | undefined>(undefined);
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]),
    [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]),
    [remember, setRemember] = useState(false);
  const skipNextWrite = useRef(false);
  useEffect(() => {
    try {
      setItems(hydrateCart(localStorage.getItem(CART_KEY), products));
      const consent = readConsent();
      setRemember(!!consent?.preferences);
      if (consent?.preferences) {
        const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        if (Array.isArray(value))
          setFavorites(
            value
              .filter(
                (id: unknown) =>
                  typeof id === "string" && products.some((p) => p.id === id),
              )
              .slice(0, 100),
          );
      } else localStorage.removeItem(FAVORITES_KEY);
    } catch {}
    setReady(true);
    const onConsent = () => {
      const enabled = !!readConsent()?.preferences;
      setRemember(enabled);
      if (!enabled) {
        setFavorites([]);
        try {
          localStorage.removeItem(FAVORITES_KEY);
        } catch {}
      }
    };
    const sync = (event: StorageEvent) => {
      if (event.key === CART_KEY) {
        skipNextWrite.current = true;
        setItems(hydrateCart(event.newValue, products));
      }
      if (event.key === CONSENT_KEY) onConsent();
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    if (ready)
      try {
        if (items.length) localStorage.setItem(CART_KEY, serializeCart(items));
        else localStorage.removeItem(CART_KEY);
      } catch {}
  }, [items, ready]);
  useEffect(() => {
    if (ready && remember)
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      } catch {}
  }, [favorites, ready, remember]);
  function addToCart(product: Product, quantity: number, weight?: number) {
    const canonical = products.find((p) => p.id === product.id);
    if (!canonical) return;
    const entry: CartItem = {
      product: canonical,
      quantity: normalizeQuantity(quantity),
      selectedWeight: canonical.isGranel ? normalizeWeight(weight) : undefined,
    };
    setItems((previous) => {
      const key = itemKey(entry),
        found = previous.find((item) => itemKey(item) === key);
      return found
        ? previous.map((item) =>
            itemKey(item) === key
              ? {
                  ...item,
                  quantity: normalizeQuantity(item.quantity + entry.quantity),
                }
              : item,
          )
        : previous.length < 100
          ? [...previous, entry]
          : previous;
    });
  }
  return (
    <Context.Provider
      value={{
        cart: { items, total: cartTotal(items) },
        ready,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        favorites,
        addToCart,
        removeFromCart: (key) =>
          setItems((items) => items.filter((item) => itemKey(item) !== key)),
        updateQuantity: (key, quantity) =>
          setItems((items) =>
            items.map((item) =>
              itemKey(item) === key
                ? { ...item, quantity: normalizeQuantity(quantity) }
                : item,
            ),
          ),
        clearCart: () => setItems([]),
        toggleFavorite: (id) =>
          setFavorites((ids) =>
            ids.includes(id)
              ? ids.filter((item) => item !== id)
              : ids.length < 100
                ? [...ids, id]
                : ids,
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCart() {
  const context = useContext(Context);
  if (!context) throw new Error("Carrinho indisponível");
  return context;
}
