"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Star } from "lucide-react"

const testimonials = [
  {
    id: 1,
    name: "Maria Silva",
    text: "Produtos de excelente qualidade! Compro regularmente e sempre sou bem atendida. Os suplementos naturais fizeram toda diferença na minha saúde.",
    rating: 5,
  },
  {
    id: 2,
    name: "João Santos",
    text: "A variedade de produtos a granel é incrível. Preços justos e produtos frescos. Recomendo para quem busca uma alimentação mais natural.",
    rating: 5,
  },
  {
    id: 3,
    name: "Ana Paula",
    text: "Atendimento excepcional e produtos de primeira linha. A loja tem tudo que preciso para manter uma vida saudável. Virei cliente fiel!",
    rating: 5,
  },
]

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <div className="relative max-w-3xl mx-auto">
      <Card className="p-8">
        <div className="flex gap-1 justify-center mb-4">
          {Array.from({ length: testimonials[currentIndex].rating }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-primary text-primary" />
          ))}
        </div>

        <p className="text-lg text-center mb-6 leading-relaxed">{testimonials[currentIndex].text}</p>

        <p className="text-center font-semibold text-primary">{testimonials[currentIndex].name}</p>
      </Card>

      <div className="flex justify-center gap-4 mt-6">
        <Button variant="outline" size="icon" onClick={prev} aria-label="Previous testimonial">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>

        <Button variant="outline" size="icon" onClick={next} aria-label="Next testimonial">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
