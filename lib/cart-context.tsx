"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Cart, CartItem, Product } from "./types"

interface CartContextType {
  cart: Cart
  addToCart: (product: Product, quantity: number, selectedWeight?: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  itemCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({ items: [], total: 0 })

  useEffect(() => {
    const savedCart = localStorage.getItem("mundo-natural-cart")
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("mundo-natural-cart", JSON.stringify(cart))
  }, [cart])

  const calculateTotal = (items: CartItem[]): number => {
    return items.reduce((sum, item) => {
      if (item.product.isGranel && item.selectedWeight) {
        return sum + (item.product.valor_unitario * item.selectedWeight) / 1000
      }
      return sum + item.product.valor_unitario * item.quantity
    }, 0)
  }

  const addToCart = (product: Product, quantity: number, selectedWeight?: number) => {
    setCart((prev) => {
      const existingItemIndex = prev.items.findIndex((item) => item.product.id === product.id)

      let newItems: CartItem[]

      if (existingItemIndex > -1) {
        newItems = [...prev.items]
        newItems[existingItemIndex] = {
          ...newItems[existingItemIndex],
          quantity: newItems[existingItemIndex].quantity + quantity,
          selectedWeight: selectedWeight || newItems[existingItemIndex].selectedWeight,
        }
      } else {
        newItems = [...prev.items, { product, quantity, selectedWeight }]
      }

      return {
        items: newItems,
        total: calculateTotal(newItems),
      }
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const newItems = prev.items.filter((item) => item.product.id !== productId)
      return {
        items: newItems,
        total: calculateTotal(newItems),
      }
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    setCart((prev) => {
      const newItems = prev.items.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item,
      )
      return {
        items: newItems,
        total: calculateTotal(newItems),
      }
    })
  }

  const clearCart = () => {
    setCart({ items: [], total: 0 })
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
