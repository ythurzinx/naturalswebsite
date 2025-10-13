"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Star } from "lucide-react"

const reviews = [
  {
    name: "Maria Silva",
    rating: 5,
    comment: "Produtos de excelente qualidade! Sempre encontro o que preciso.",
    date: "2 semanas atrás",
  },
  {
    name: "João Santos",
    rating: 5,
    comment: "Atendimento impecável e produtos naturais de verdade. Recomendo!",
    date: "1 mês atrás",
  },
  {
    name: "Ana Costa",
    rating: 4,
    comment: "Ótima variedade de produtos a granel. Preços justos.",
    date: "3 semanas atrás",
  },
  {
    name: "Pedro Oliveira",
    rating: 5,
    comment: "Melhor loja de produtos naturais da região. Sempre volto!",
    date: "1 semana atrás",
  },
]

export function CustomerReviews() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-serif text-3xl font-bold mb-2">O Que Nossos Clientes Dizem</h2>
        <p className="text-muted-foreground">Avaliações reais de quem confia na Mundo Natural</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {reviews.map((review, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{review.name}</p>
                  <p className="text-sm text-muted-foreground">{review.date}</p>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
