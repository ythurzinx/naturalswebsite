"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { Header } from "@/components/header"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Ticket } from "lucide-react"
import { useCart } from "@/hooks/use-cart"
import { formatPrice } from "@/lib/format"
import { validateCoupon, calculateDiscount, incrementCouponUsage } from "@/lib/coupons"
import { ShippingCalculator } from "@/components/shipping-calculator"

export default function CheckoutPage() {
  const router = useRouter()
  const cart = useCart()

  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [shippingCost, setShippingCost] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const handleShippingCalculated = (cost: number) => {
    setShippingCost(cost)
  }

  const handleApplyCoupon = () => {
    const validation = validateCoupon(couponCode)

    // Caso o cupom seja inválido
    if (!validation.success) {
      toast({
        title: "Cupom inválido",
        description: validation.message,
        variant: "destructive",
      })
      return
    }

    // Caso o cupom seja válido
    if (validation.coupon) {
      const discount = calculateDiscount(validation.coupon, cart.total)
      setAppliedCoupon(validation.coupon)
      setCouponDiscount(discount)
      toast({
        title: "Cupom aplicado!",
        description: `Desconto de ${formatPrice(discount)} aplicado`,
      })
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponDiscount(0)
    setCouponCode("")
  }

  const handleFinishOrder = async () => {
    if (shippingCost == null) {
      toast({
        title: "Calcule o frete",
        description: "Por favor, calcule o frete antes de finalizar.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      if (appliedCoupon) {
        incrementCouponUsage(appliedCoupon.id)
      }

      toast({
        title: "Pedido realizado!",
        description: "Entraremos em contato para confirmar o pagamento.",
      })

      cart.clearCart()
      router.push("/")
    } catch (error: unknown) {
      console.error("[checkout] Failed to finish order", error)
      toast({
        title: "Erro ao processar pedido",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (cart.items.length === 0) {
    if (typeof window !== "undefined") {
      router.replace("/carrinho")
    }
    return null
  }

  const subtotal = cart.total
  const totalWithDiscount = subtotal - couponDiscount
  const total =
    shippingCost != null ? totalWithDiscount + shippingCost : totalWithDiscount

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Finalizar Compra</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Coluna esquerda */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Calcular Frete</CardTitle>
                </CardHeader>
                <CardContent>
                  <ShippingCalculator onShippingCalculated={handleShippingCalculated} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Cupom de Desconto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Digite seu cupom"
                      className="flex-1 border rounded-md px-3 py-2"
                    />
                    {!appliedCoupon ? (
                      <button
                        onClick={handleApplyCoupon}
                        className="bg-primary text-white px-4 py-2 rounded-md hover:opacity-90"
                      >
                        Aplicar
                      </button>
                    ) : (
                      <button
                        onClick={handleRemoveCoupon}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:opacity-90"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  {appliedCoupon && (
                    <p className="text-sm text-green-600 mt-2">
                      Cupom <strong>{appliedCoupon.code}</strong> aplicado!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Coluna direita - Resumo */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Subtotal: {formatPrice(subtotal)}</p>
                  {appliedCoupon && (
                    <p>Desconto: -{formatPrice(couponDiscount)}</p>
                  )}
                  {shippingCost != null && (
                    <p>Frete: {shippingCost === 0 ? "Grátis" : formatPrice(shippingCost)}</p>
                  )}
                  <hr />
                  <p className="font-bold">Total: {formatPrice(total)}</p>
                  <button
                    onClick={handleFinishOrder}
                    disabled={loading || shippingCost == null}
                    className={`w-full mt-4 px-4 py-2 rounded-md text-white ${
                      loading || shippingCost == null
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-primary hover:opacity-90"
                    }`}
                  >
                    {loading ? "Processando..." : "Finalizar Pedido"}
                  </button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
