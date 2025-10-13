root@fc3300ec3064:/workspace/naturalswebsite# nl -ba app/api/calculate-shipping/route.ts | sed -n '1,220p'
     1  import { type NextRequest, NextResponse } from "next/server"
     2  import { z } from "zod"
     3
     4  const STORE_ADDRESS = "Rua José Duarte Souza, 21, Jardim das Margaridas, Taboão da Serra, SP"
     5  const BASE_RATE = 8.0
     6  const RATE_PER_KM = 1.5
     7  const VIA_CEP_TIMEOUT_MS = 8000
     8  const GOOGLE_TIMEOUT_MS = 8000
     9  const SAME_CITY_KEYWORD = "taboao da serra"
    10
    11  const requestSchema = z.object({
    12    cep: z.string({ required_error: "CEP é obrigatório" }).min(1, "CEP é obrigatório"),
    13  })
    14
    15  type ViaCepResponse = {
    16    erro?: boolean
    17    logradouro?: string
    18    bairro?: string
    19    localidade?: string
    20    uf?: string
    21  }
    22
    23  type DistanceMatrixResponse = {
    24    status?: string
    25    rows?: Array<{
    26      elements?: Array<{
    27        status?: string
    28        distance?: { value?: number }
    29        duration?: { value?: number }
    30      }>
    31    }>
    32  }
    33
    34  class FetchTimeoutError extends Error {
    35    constructor(message: string) {
    36      super(message)
    37      this.name = "FetchTimeoutError"
    38    }
    39  }
    40
    41  function round(value: number, precision: number): number {
    42    const multiplier = 10 ** precision
    43    return Math.round(value * multiplier) / multiplier
    44  }
    45
    46  function normalizeCityName(city?: string): string {
    47    if (!city) return ""
    48    return city
    49      .normalize("NFD")
    50      .replace(/\p{Diacritic}/gu, "")
    51      .toLowerCase()
    52  }
    53
    54  function buildAddress(data: ViaCepResponse, fallback: string): string {
    55    const parts = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean)
    56    return parts.join(", ") || fallback
    57  }
    58
    59  function createFallbackResult(city: string, address: string) {
    60    const isSameCity = normalizeCityName(city).includes(SAME_CITY_KEYWORD)
    61    const distance = isSameCity ? 5 : 15
    62    const duration = isSameCity ? 20 : 45
    63    const cost = BASE_RATE + distance * RATE_PER_KM
    64
    65    return {
    66      distance: round(distance, 1),
    67      duration,
    68      cost: round(cost, 2),
    69      address,
    70    }
    71  }
    72
    73  async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    74    const controller = new AbortController()
    75    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    76
    77    try {
    78      return await fetch(url, { ...init, signal: controller.signal })
    79    } catch (error) {
    80      if ((error as Error).name === "AbortError") {
    81        throw new FetchTimeoutError(`Tempo limite excedido ao acessar ${url}`)
    82      }
    83      throw error
    84    } finally {
    85      clearTimeout(timeout)
    86    }
    87  }
    88
    89  export async function POST(request: NextRequest) {
    90    try {
    91      let parsedBody: unknown
    92
    93      try {
    94        parsedBody = await request.json()
    95      } catch (error) {
    96        console.error("Falha ao ler corpo da requisição: ", error)
    97        return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
    98      }
    99
   100      const validation = requestSchema.safeParse(parsedBody)
   101      if (!validation.success) {
   102        return NextResponse.json({ error: validation.error.errors[0]?.message ?? "CEP inválido" }, { status: 400 })
   103      }
   104
   105      const cleanCep = validation.data.cep.replace(/\D/g, "")
   106      if (cleanCep.length !== 8) {
   107        return NextResponse.json({ error: "CEP deve conter 8 dígitos" }, { status: 400 })
   108      }
   109
   110      const viaCepResponse = await fetchWithTimeout(
   111        `https://viacep.com.br/ws/${cleanCep}/json/`,
   112        { cache: "no-store" },
   113        VIA_CEP_TIMEOUT_MS,
   114      )
   115
   116      if (!viaCepResponse.ok) {
   117        return NextResponse.json({ error: "CEP não encontrado" }, { status: viaCepResponse.status === 404 ? 404 : 502 })
   118      }
   119
   120      const cepData = (await viaCepResponse.json()) as ViaCepResponse
   121      if (cepData.erro) {
   122        return NextResponse.json({ error: "CEP inválido" }, { status: 400 })
   123      }
   124
   125      const destinationAddress = buildAddress(cepData, cleanCep)
   126
   127      const apiKey = process.env.GOOGLE_MAPS_API_KEY
   128      if (!apiKey) {
   129        return NextResponse.json(createFallbackResult(cepData.localidade ?? "", destinationAddress))
   130      }
   131
   132      const mapsUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
   133      mapsUrl.searchParams.append("origins", STORE_ADDRESS)
   134      mapsUrl.searchParams.append("destinations", destinationAddress)
   135      mapsUrl.searchParams.append("key", apiKey)
   136      mapsUrl.searchParams.append("mode", "driving")
   137      mapsUrl.searchParams.append("language", "pt-BR")
   138
   139      const mapsResponse = await fetchWithTimeout(
   140        mapsUrl.toString(),
   141        { cache: "no-store" },
   142        GOOGLE_TIMEOUT_MS,
   143      )
   144
   145      if (!mapsResponse.ok) {
   146        return NextResponse.json(createFallbackResult(cepData.localidade ?? "", destinationAddress))
   147      }
   148
   149      const mapsData = (await mapsResponse.json()) as DistanceMatrixResponse
   150      const element = mapsData.rows?.[0]?.elements?.[0]
   151
   152      if (
   153        mapsData.status !== "OK" ||
   154        !element ||
   155        element.status !== "OK" ||
   156        typeof element.distance?.value !== "number" ||
   157        typeof element.duration?.value !== "number"
   158      ) {
   159        return NextResponse.json(createFallbackResult(cepData.localidade ?? "", destinationAddress))
   160      }
   161
   162      const distanceInMeters = element.distance.value
   163      const durationInSeconds = element.duration.value
   164
   165      const distance = distanceInMeters / 1000
   166      const duration = Math.ceil(durationInSeconds / 60)
   167      const cost = BASE_RATE + distance * RATE_PER_KM
   168
   169      return NextResponse.json({
   170        distance: round(distance, 1),
   171        duration,
   172        cost: round(cost, 2),
   173        address: destinationAddress,
   174      })
   175    } catch (error) {
   176      if (error instanceof FetchTimeoutError) {
   177        console.error("Shipping calculation timeout:", error)
   178        return NextResponse.json(
   179          { error: "Tempo de resposta excedido. Tente novamente em instantes." },
   180          { status: 504 },
   181        )
   182      }
   183
   184      console.error("Shipping calculation error:", error)
   185      return NextResponse.json({ error: "Erro ao calcular frete. Tente novamente mais tarde." }, { status: 500 })
   186    }
   187  }
