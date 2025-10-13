import { type NextRequest, NextResponse } from "next/server"

const STORE_ADDRESS = "Rua José Duarte Souza, 21, Jardim das Margaridas, Taboão da Serra, SP"
const BASE_RATE = 8.0
const RATE_PER_KM = 1.5

export async function POST(request: NextRequest) {
  try {
    const { cep } = await request.json()

    if (!cep || cep.length !== 8) {
      return NextResponse.json({ error: "CEP inválido" }, { status: 400 })
    }

    // Get address from CEP using ViaCEP API
    const cepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (!cepResponse.ok) {
      return NextResponse.json({ error: "CEP não encontrado" }, { status: 404 })
    }

    const cepData = await cepResponse.json()
    if (cepData.erro) {
      return NextResponse.json({ error: "CEP inválido" }, { status: 400 })
    }

    const destinationAddress = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade}, ${cepData.uf}`

    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      // Fallback: Calculate approximate shipping based on city
      const isSameCity = cepData.localidade.toLowerCase().includes("taboão da serra")
      const distance = isSameCity ? 5 : 15
      const duration = isSameCity ? 20 : 45
      const cost = BASE_RATE + distance * RATE_PER_KM

      return NextResponse.json({
        distance: Math.round(distance * 10) / 10,
        duration,
        cost: Math.round(cost * 100) / 100,
        address: destinationAddress,
      })
    }

    // Use Google Maps Distance Matrix API
    const mapsUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
    mapsUrl.searchParams.append("origins", STORE_ADDRESS)
    mapsUrl.searchParams.append("destinations", destinationAddress)
    mapsUrl.searchParams.append("key", apiKey)
    mapsUrl.searchParams.append("mode", "driving")
    mapsUrl.searchParams.append("language", "pt-BR")

    const mapsResponse = await fetch(mapsUrl.toString())
    const mapsData = await mapsResponse.json()

    if (mapsData.status !== "OK" || mapsData.rows[0]?.elements[0]?.status !== "OK") {
      // Fallback to approximate calculation
      const isSameCity = cepData.localidade.toLowerCase().includes("taboão da serra")
      const distance = isSameCity ? 5 : 15
      const duration = isSameCity ? 20 : 45
      const cost = BASE_RATE + distance * RATE_PER_KM

      return NextResponse.json({
        distance: Math.round(distance * 10) / 10,
        duration,
        cost: Math.round(cost * 100) / 100,
        address: destinationAddress,
      })
    }

    const element = mapsData.rows[0].elements[0]
    const distanceInMeters = element.distance.value
    const durationInSeconds = element.duration.value

    const distance = distanceInMeters / 1000
    const duration = Math.ceil(durationInSeconds / 60)
    const cost = BASE_RATE + distance * RATE_PER_KM

    return NextResponse.json({
      distance: Math.round(distance * 10) / 10,
      duration,
      cost: Math.round(cost * 100) / 100,
      address: destinationAddress,
    })
  } catch (error) {
    console.error("Shipping calculation error:", error)
    return NextResponse.json({ error: "Erro ao calcular frete. Tente novamente mais tarde." }, { status: 500 })
  }
}
