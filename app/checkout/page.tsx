"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { formatPrice } from "@/lib/products"
import { Loader2, Package, Ticket, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { ShippingCalculator } from "@/components/shipping-calculator"
import { validateCoupon, calculateDiscount, incrementCouponUsage } from "@/lib/coupons"
import type { Coupon } from "@/lib/types"

export default function CheckoutPage() {
  const { cart, clearCart } = useCart()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [shippingCost, setShippingCost] = useState<number | null>(null)
  const [shippingAddress, setShippingAddress] = useState("")

  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)

  const handleShippingCalculated = (cost: number, address: string) => {
    setShippingCost(cost)
    setShippingAddress(address)
  }

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast({
        title: "Digite um cupom",
        description: "Por favor, digite o código do cupom",
        variant: "destructive",
      })
      return
    }

    const validation = validateCoupon(couponCode, cart.total)

    if (!validation.valid) {
      toast({
        title: "Cupom inválido",
        description: validation.message,
        variant: "destructive",
      })
      return
    }

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
    if (!shippingCost) {
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

      clearCart()
      router.push("/")
    } catch (error) {
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
    router.push("/carrinho")
    return null
  }

  const subtotal = cart.total
  const totalWithDiscount = subtotal - couponDiscount
  const total = shippingCost ? totalWithDiscount + shippingCost : totalWithDiscount

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Finalizar Compra</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div>
                        <p className="font-semibold text-green-700">{appliedCoupon.code}</p>
                        <p className="text-sm text-green-600">Desconto de {formatPrice(couponDiscount)} aplicado</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleRemoveCoupon}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o código do cupom"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                      />
                      <Button onClick={handleApplyCoupon}>Aplicar</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Itens do Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex justify-between items-start py-2 border-b border-border last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.product.nome_produto}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.product.isGranel ? `${item.selectedWeight}g` : `${item.quantity}x`}
                          </p>
                        </div>
                        <p className="font-semibold text-sm">
                          {item.product.isGranel
                            ? formatPrice((item.product.valor_unitario * (item.selectedWeight || 0)) / 1000)
                            : formatPrice(item.product.valor_unitario * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold mb-6">Resumo</h2>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">{formatPrice(subtotal)}</span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Desconto</span>
                        <span className="font-semibold text-green-600">-{formatPrice(couponDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="font-semibold">{shippingCost ? formatPrice(shippingCost) : "A calcular"}</span>
                    </div>
                    <div className="border-t border-border pt-4">
                      <div className="flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="text-2xl font-bold text-primary">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>

                  <Button size="lg" className="w-full" onClick={handleFinishOrder} disabled={loading || !shippingCost}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Finalizar Pedido"
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Entraremos em contato para confirmar o pagamento e entrega.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}
