import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Leaf, Droplets, Sparkles, Heart } from "lucide-react"
import Link from "next/link"

const categories = [
  {
    icon: Leaf,
    title: "Chás Naturais",
    description: "Blends orgânicos para relaxamento e bem-estar",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  {
    icon: Sparkles,
    title: "Suplementos",
    description: "Vitaminas e minerais para sua saúde",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
  },
  {
    icon: Droplets,
    title: "Óleos Essenciais",
    description: "Aromaterapia e cuidados naturais",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    icon: Heart,
    title: "Superalimentos",
    description: "Nutrição poderosa para seu dia a dia",
    color: "text-rose-600",
    bgColor: "bg-rose-50 dark:bg-rose-950/20",
  },
]

export function WellnessSection() {
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-balance" style={{ fontFamily: "var(--font-playfair)" }}>
            Descubra Seu Bem-Estar
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-pretty">
            Explore nossas categorias especiais de produtos naturais selecionados para transformar sua rotina de saúde
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <Card
                key={category.title}
                className="group hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <CardContent className="p-6 text-center">
                  <div
                    className={`${category.bgColor} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className={`h-8 w-8 ${category.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{category.title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{category.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="text-center">
          <Link href="/produtos">
            <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
              Ver Todos os Produtos
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
