import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const STORE_ADDRESS = "Rua José Duarte Souza, 21, Jardim das Margaridas, Taboão da Serra, SP"
const BASE_RATE = 8.0
const RATE_PER_KM = 1.5
const VIA_CEP_TIMEOUT_MS = 8000
const GOOGLE_TIMEOUT_MS = 8000
const SAME_CITY_KEYWORD = "taboao da serra"

const requestSchema = z.object({
  cep: z.string({ required_error: "CEP é obrigatório" }).min(1, "CEP é obrigatório"),
})

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

type DistanceMatrixResponse = {
  status?: string
  rows?: Array<{
    elements?: Array<{
      status?: string
      distance?: { value?: number }
      duration?: { value?: number }
    }>
  }>
}

class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FetchTimeoutError"
  }
}

function round(value: number, precision: number): number {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

function normalizeCityName(city?: string): string {
  if (!city) return ""
  return city
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function buildAddress(data: ViaCepResponse, fallback: string): string {
  const parts = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean)
  return parts.join(", ") || fallback
}

function createFallbackResult(city: string, address: string) {
  const isSameCity = normalizeCityName(city).includes(SAME_CITY_KEYWORD)
  const distance = isSameCity ? 5 : 15
  const duration = isSameCity ? 20 : 45
  const cost = BASE_RATE + distance * RATE_PER_KM

  return {
    distance: round(distance, 1),
    duration,
    cost: round(cost, 2),
    address,
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new FetchTimeoutError(`Tempo limite excedido ao acessar ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: NextRequest) {
  try {
    let parsedBody: unknown

    try {
      parsedBody = await request.json()
    } catch (error) {
      console.error("Falha ao ler corpo da requisição: ", error)
      return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
    }

    const validation = requestSchema.safeParse(parsedBody)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message ?? "CEP inválido" }, { status: 400 })
    }

    const cleanCep = validation.data.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) {
      return NextResponse.json({ error: "CEP deve conter 8 dígitos" }, { status: 400 })
    }

    const viaCepResponse = await fetchWithTimeout(
      `https://viacep.com.br/ws/${cleanCep}/json/`,
      { cache: "no-store" },
      VIA_CEP_TIMEOUT_MS,
    )

    if (!viaCepResponse.ok) {
      return NextResponse.json({ error: "CEP não encontrado" }, { status: viaCepResponse.status === 404 ? 404 : 502 })
    }

    const cepData = (await viaCepResponse.json()) as ViaCepResponse
    if (cepData.erro) {
      return NextResponse.json({ error: "CEP inválido" }, { status: 400 })
    }

    const destinationAddress = buildAddress(cepData, cleanCep)

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(createFallbackResult(cepData.localidade ?? "", destinationAddress))
    }

    const mapsUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
    mapsUrl.searchParams.append("origins", STORE_ADDRESS)
    mapsUrl.searchParams.append("destinations", destinationAddress)
    mapsUrl.searchParams.append("key", apiKey)
    mapsUrl.searchParams.append("mode", "driving")
    mapsUrl.searchParams.append("language", "pt-BR")

    const mapsResponse = await fetchWithTimeout(
      mapsUrl.toString(),
      { cache: "no-store" },
      GOOGLE_TIMEOUT_MS,
    )

    if (!mapsResponse.ok) {
      return NextResponse.json(createFallbackResult(cepData.localidade ?? "", destinationAddress))
    }

    const mapsData = (await mapsResponse.json()) as DistanceMatrixResponse
    const element = mapsData.rows?.[0]?.elements?.[0]

    if (
      mapsData.status !== "OK" ||
      !element ||
      element.status !== "OK" ||
      typeof element.distance?.value !== "number" ||
      typeof element.duration?.value !== "number"
    ) {
      return NextResponse.json(createFallbackResult(cepData.localidade ?? "", destinationAddress))
    }

    const distanceInMeters = element.distance.value
    const durationInSeconds = element.duration.value

    const distance = distanceInMeters / 1000
    const duration = Math.ceil(durationInSeconds / 60)
    const cost = BASE_RATE + distance * RATE_PER_KM

    return NextResponse.json({
      distance: round(distance, 1),
      duration,
      cost: round(cost, 2),
      address: destinationAddress,
    })
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      console.error("Shipping calculation timeout:", error)
      return NextResponse.json(
        { error: "Tempo de resposta excedido. Tente novamente em instantes." },
        { status: 504 },
      )
    }

    console.error("Shipping calculation error:", error)
    return NextResponse.json({ error: "Erro ao calcular frete. Tente novamente mais tarde." }, { status: 500 })
  }
}
