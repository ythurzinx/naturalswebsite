"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, MapPin, Clock, Truck } from "lucide-react"
import { calculateShipping, formatDistance, formatDuration } from "@/lib/shipping"
import { formatPrice } from "@/lib/products"
import { useToast } from "@/hooks/use-toast"

interface ShippingCalculatorProps {
  onShippingCalculated?: (cost: number, address: string) => void
}

export function ShippingCalculator({ onShippingCalculated }: ShippingCalculatorProps) {
  const [cep, setCep] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    distance: number
    duration: number
    cost: number
    address: string
  } | null>(null)
  const { toast } = useToast()

  const handleCalculate = async () => {
    const cleanCep = cep.replace(/\D/g, "")

    if (cleanCep.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "Por favor, insira um CEP válido com 8 dígitos.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const shippingData = await calculateShipping(cleanCep)
      setResult(shippingData)

      if (onShippingCalculated) {
        onShippingCalculated(shippingData.cost, shippingData.address)
      }

      toast({
        title: "Frete calculado com sucesso!",
        description: `Valor: ${formatPrice(shippingData.cost)}`,
      })
    } catch (error) {
      toast({
        title: "Erro ao calcular frete",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCepChange = (value: string) => {
    // Format CEP as user types: 00000-000
    let formatted = value.replace(/\D/g, "")
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5) + "-" + formatted.slice(5, 8)
    }
    setCep(formatted)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cep">CEP de Entrega</Label>
        <div className="flex gap-2">
          <Input
            id="cep"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => handleCepChange(e.target.value)}
            maxLength={9}
            className="flex-1"
          />
          <Button onClick={handleCalculate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculando...
              </>
            ) : (
              "Calcular"
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Informe seu CEP para calcular o valor e prazo de entrega</p>
      </div>

      {result && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Endereço de entrega:</p>
                <p className="text-sm break-words">{result.address}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="text-sm font-semibold">{formatDistance(result.distance)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Tempo estimado</p>
                  <p className="text-sm font-semibold">{formatDuration(result.duration)}</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Valor do frete:</span>
                <span className="text-lg font-bold text-primary">{formatPrice(result.cost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
