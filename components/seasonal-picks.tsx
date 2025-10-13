"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Snowflake, Sun, Leaf, Flower } from "lucide-react"

const seasons = {
  summer: {
    icon: Sun,
    title: "Verão - Detox e Hidratação",
    description: "Produtos refrescantes para os dias quentes",
    products: ["Água de Coco em Pó", "Chá Verde", "Spirulina", "Chia"],
  },
  winter: {
    icon: Snowflake,
    title: "Inverno - Imunidade",
    description: "Fortaleça suas defesas naturais",
    products: ["Própolis", "Gengibre", "Cúrcuma", "Vitamina C"],
  },
  spring: {
    icon: Flower,
    title: "Primavera - Renovação",
    description: "Renove suas energias",
    products: ["Pólen", "Geleia Real", "Açaí", "Guaraná"],
  },
  autumn: {
    icon: Leaf,
    title: "Outono - Equilíbrio",
    description: "Mantenha o equilíbrio interno",
    products: ["Castanhas", "Quinoa", "Linhaça", "Aveia"],
  },
}

export function SeasonalPicks() {
  // Determinar estação atual baseado no mês
  const month = new Date().getMonth()
  let currentSeason: keyof typeof seasons = "summer"

  if (month >= 2 && month <= 4) currentSeason = "autumn"
  else if (month >= 5 && month <= 7) currentSeason = "winter"
  else if (month >= 8 && month <= 10) currentSeason = "spring"

  const season = seasons[currentSeason]
  const Icon = season.icon

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="font-serif text-2xl">{season.title}</CardTitle>
            <CardDescription>{season.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {season.products.map((product) => (
            <div key={product} className="bg-background rounded-lg p-4 text-center hover:shadow-md transition-shadow">
              <p className="text-sm font-medium">{product}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
