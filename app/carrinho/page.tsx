"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCart } from "@/lib/cart-context"
import { formatPrice } from "@/lib/products"
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Toaster } from "@/components/ui/toaster"

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity } = useCart()

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <ShoppingBag className="h-24 w-24 mx-auto mb-6 text-muted-foreground" />
              <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
                Seu carrinho está vazio
              </h1>
              <p className="text-muted-foreground mb-8">Adicione produtos ao seu carrinho para continuar comprando.</p>
              <Link href="/">
                <Button size="lg">
                  Continuar Comprando
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
        <Toaster />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8" style={{ fontFamily: "var(--font-playfair)" }}>
            Carrinho de Compras
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <Card key={item.product.id}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {/* Product Image Placeholder */}
                      <div className="w-24 h-24 bg-secondary/50 rounded-lg flex-shrink-0" />

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{item.product.nome_produto}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{item.product.peso_produto}</p>
                        <p className="text-sm text-muted-foreground mb-3">{item.product.categoria}</p>

                        {/* Price and Quantity Controls */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            {item.product.isGranel ? (
                              <div className="text-sm">
                                <span className="font-semibold">{item.selectedWeight}g</span>
                                <span className="text-muted-foreground ml-2">
                                  {formatPrice((item.product.valor_unitario * (item.selectedWeight || 0)) / 1000)}
                                </span>
                              </div>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 bg-transparent"
                                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateQuantity(item.product.id, Number.parseInt(e.target.value) || 1)
                                  }
                                  className="w-16 h-8 text-center"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 bg-transparent"
                                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <p className="font-bold text-lg">
                              {item.product.isGranel
                                ? formatPrice((item.product.valor_unitario * (item.selectedWeight || 0)) / 1000)
                                : formatPrice(item.product.valor_unitario * item.quantity)}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold mb-6">Resumo do Pedido</h2>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">{formatPrice(cart.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="font-semibold">Calcular no próximo passo</span>
                    </div>
                    <div className="border-t border-border pt-4">
                      <div className="flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="text-2xl font-bold text-primary">{formatPrice(cart.total)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">+ frete a calcular</p>
                    </div>
                  </div>

                  <Link href="/checkout">
                    <Button size="lg" className="w-full mb-3">
                      Finalizar Compra
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href="/">
                    <Button variant="outline" size="lg" className="w-full bg-transparent">
                      Continuar Comprando
                    </Button>
                  </Link>
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
