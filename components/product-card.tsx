"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShoppingCart, Package } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import type { Product } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart()
  const { toast } = useToast()
  const [quantity, setQuantity] = useState(1)
  const [weight, setWeight] = useState(100)

  const handleAddToCart = () => {
    if (product.isGranel) {
      addToCart(product, 1, weight)
      toast({
        title: "Produto adicionado!",
        description: `${weight}g de ${product.nome_produto} adicionado ao carrinho.`,
      })
    } else {
      addToCart(product, quantity)
      toast({
        title: "Produto adicionado!",
        description: `${quantity}x ${product.nome_produto} adicionado ao carrinho.`,
      })
    }
  }

  return (
    <Card className="group overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-2 hover:border-primary/20">
      <CardContent className="p-6">
        <div className="aspect-square bg-gradient-to-br from-secondary/50 to-primary/10 rounded-lg mb-4 flex items-center justify-center group-hover:from-primary/20 group-hover:to-secondary/50 transition-all duration-300">
          <Package className="h-16 w-16 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {product.nome_produto}
          </h3>
          <p className="text-sm text-muted-foreground">{product.peso_produto}</p>
          <p className="text-xs text-muted-foreground bg-secondary/50 inline-block px-2 py-1 rounded">
            {product.categoria}
          </p>

          <div className="pt-2">
            <p className="text-sm font-medium text-muted-foreground italic">Aguardando atualização de preços</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex flex-col gap-3">
        {product.isGranel ? (
          <div className="w-full space-y-2">
            <Label htmlFor={`weight-${product.id}`} className="text-sm">
              Quantidade (gramas)
            </Label>
            <Input
              id={`weight-${product.id}`}
              type="number"
              min="50"
              step="50"
              value={weight}
              onChange={(e) => setWeight(Number.parseInt(e.target.value) || 100)}
              className="w-full"
            />
          </div>
        ) : (
          <div className="w-full space-y-2">
            <Label htmlFor={`quantity-${product.id}`} className="text-sm">
              Quantidade
            </Label>
            <Input
              id={`quantity-${product.id}`}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
              className="w-full"
            />
          </div>
        )}

        <Button onClick={handleAddToCart} className="w-full group-hover:shadow-lg transition-shadow" size="lg">
          <ShoppingCart className="h-4 w-4 mr-2" />
          Adicionar ao Carrinho
        </Button>

        {product.status_estoque !== "OK" && <p className="text-xs text-destructive text-center">Estoque baixo</p>}
      </CardFooter>
    </Card>
  )
}
