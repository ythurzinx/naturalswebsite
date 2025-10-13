import { useState } from "react"

export function useCart() {
  const [items, setItems] = useState<{ id: string; name: string; price: number }[]>([])
  const [total, setTotal] = useState(0)

  const clearCart = () => {
    setItems([])
    setTotal(0)
  }

  return {
    items,
    total,
    setItems,
    setTotal,
    clearCart,
  }
}
