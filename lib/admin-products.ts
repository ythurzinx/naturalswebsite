import { fetchProducts } from "./products"
import type { Product } from "./types"

const STORAGE_KEY = "mundo-natural.admin.products"

function isBrowser() {
  return typeof window !== "undefined"
}

function readStoredProducts(): Product[] | null {
  if (!isBrowser()) return null

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Product[]
    return Array.isArray(parsed) ? parsed : null
  } catch (error) {
    console.warn("[admin-products] Failed to parse stored products", error)
    return null
  }
}

function writeStoredProducts(products: Product[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

export async function getAdminProducts(): Promise<Product[]> {
  const storedProducts = readStoredProducts()
  if (storedProducts) {
    return storedProducts
  }

  const fetched = await fetchProducts()
  if (isBrowser()) {
    writeStoredProducts(fetched)
  }
  return fetched
}

export function saveProductOverride(product: Product) {
  if (!isBrowser()) return

  const products = readStoredProducts() ?? []
  const index = products.findIndex((item) => item.id === product.id)

  const enrichedProduct: Product = {
    ...product,
    imagem: product.imagem,
    validade: product.validade,
    isFeatured: product.isFeatured ?? false,
  }

  if (index >= 0) {
    products[index] = enrichedProduct
  } else {
    products.push(enrichedProduct)
  }

  writeStoredProducts(products)
}

export function deleteProduct(productId: string) {
  if (!isBrowser()) return

  const products = readStoredProducts() ?? []
  const filtered = products.filter((product) => product.id !== productId)
  writeStoredProducts(filtered)
}

export function createNewProduct(): Product {
  return {
    id: `new-${Date.now()}`,
    nome_produto: "",
    peso_produto: "",
    quantidade: 0,
    valor_unitario: 0,
    total_unitario: 0,
    estoque_minimo: 0,
    status_estoque: "",
    categoria: "",
    isGranel: false,
    imagem: undefined,
    validade: undefined,
    isFeatured: false,
  }
}
