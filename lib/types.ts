export interface Product {
  id: string
  nome_produto: string
  peso_produto: string
  quantidade: number
  valor_unitario: number
  total_unitario: number
  estoque_minimo: number
  status_estoque: string
  categoria: string
  isGranel: boolean
  imagem?: string
  validade?: string
  isFeatured?: boolean
}

export interface CartItem {
  product: Product
  quantity: number
  selectedWeight?: number // For "a granel" products in grams
}

export interface Cart {
  items: CartItem[]
  total: number
}

export interface ShippingInfo {
  cep: string
  address: string
  cost: number
}

export interface Coupon {
  id: string
  code: string
  discountType: "percentage" | "fixed"
  discount: number
  minPurchase?: number
  expiryDate?: string
  usageLimit?: number
  usedCount: number
  isActive: boolean
}
