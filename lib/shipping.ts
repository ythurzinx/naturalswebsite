interface ShippingCalculation {
  distance: number // in kilometers
  duration: number // in minutes
  cost: number // in BRL
  address: string
}

function getShippingEndpoint() {
  if (typeof window !== "undefined") {
    return "/api/calculate-shipping"
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_URL || process.env.VERCEL_URL
  if (base) {
    const normalizedBase = base.startsWith("http") ? base : `https://${base}`
    return `${normalizedBase.replace(/\/$/, "")}/api/calculate-shipping`
  }

  return "http://localhost:3000/api/calculate-shipping"
}

export async function calculateShipping(cep: string): Promise<ShippingCalculation> {
  try {
    const cleanCep = cep.replace(/\D/g, "")

    const response = await fetch(getShippingEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cep: cleanCep }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || "Erro ao calcular frete")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[v0] Shipping calculation error:", error)
    throw error
  }
}

export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}
