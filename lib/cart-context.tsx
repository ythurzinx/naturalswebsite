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
import { products as baseProducts } from "./products";
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
  catalog: Product[];
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
export function CartProvider({
  children,
  initialCatalog,
}: {
  children: ReactNode;
  initialCatalog?: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(
    initialCatalog || baseProducts,
  );
  const catalogRef = useRef(products);
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
        setItems(hydrateCart(event.newValue, catalogRef.current));
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
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/catalog", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (
          !Array.isArray(data.products) ||
          data.products.length > 5000 ||
          data.products.some(
            (p: Product) =>
              typeof p.id !== "string" ||
              typeof p.nome_produto !== "string" ||
              !Number.isFinite(p.valor_unitario) ||
              p.valor_unitario <= 0,
          )
        )
          return;
        catalogRef.current = data.products;
        setProducts(data.products);
        setItems((current) =>
          hydrateCart(serializeCart(current), data.products),
        );
        setFavorites((current) =>
          current.filter((id) =>
            data.products.some((p: Product) => p.id === id),
          ),
        );
      } catch {}
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
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
        catalog: products,
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
