import type { Product } from "./types"

const CSV_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/produtos_mundo_natural-oXa503E35YnbJNXiAjOLNrfB9SkkXM.csv"

export async function fetchProducts(): Promise<Product[]> {
  try {
    const response = await fetch(CSV_URL)
    const csvText = await response.text()

    const lines = csvText.split("\n")
    const headers = lines[0].split(",")

    const products: Product[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(",")

      if (values[0] === "Total Geral") continue

      const nome_produto = values[0]?.trim() || ""
      const peso_produto = values[1]?.trim() || ""
      const isGranel =
        peso_produto.toLowerCase().includes("granel") ||
        peso_produto.toLowerCase().includes("kg") ||
        nome_produto.toLowerCase().includes("granel")

      const product: Product = {
        id: `prod-${i}`,
        nome_produto,
        peso_produto,
        quantidade: Number.parseInt(values[2]) || 0,
        valor_unitario: Number.parseFloat(values[4]?.replace("R$", "").replace(",", ".").trim()) || 0,
        total_unitario: Number.parseFloat(values[5]?.replace("R$", "").replace(",", ".").trim()) || 0,
        estoque_minimo: Number.parseFloat(values[6]?.replace("R$", "").replace(",", ".").trim()) || 0,
        status_estoque: values[7]?.trim() || "OK",
        categoria: values[8]?.trim() || "Diversos",
        isGranel,
      }

      products.push(product)
    }

    return products
  } catch (error) {
    console.error("[v0] Error fetching products:", error)
    return []
  }
}

export function getCategories(products: Product[]): string[] {
  const categories = new Set(products.map((p) => p.categoria))
  return Array.from(categories).sort()
}

export function getProductsByCategory(products: Product[], category: string): Product[] {
  return products.filter((p) => p.categoria === category)
}

export function searchProducts(products: Product[], query: string): Product[] {
  const lowerQuery = query.toLowerCase()
  return products.filter(
    (p) => p.nome_produto.toLowerCase().includes(lowerQuery) || p.categoria.toLowerCase().includes(lowerQuery),
  )
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price)
}
