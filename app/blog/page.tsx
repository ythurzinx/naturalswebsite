import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, User, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const blogPosts = [
  {
    id: 1,
    title: "Os Benefícios da Spirulina para Sua Saúde",
    excerpt: "Descubra como este superalimento pode transformar sua energia e imunidade diariamente.",
    author: "Equipe Mundo Natural",
    date: "15 de Janeiro, 2025",
    category: "Suplementos",
    image: "/spirulina-powder-green-superfood.jpg",
  },
  {
    id: 2,
    title: "Guia Completo: Como Escolher Grãos Integrais",
    excerpt: "Aprenda a selecionar os melhores grãos para uma alimentação equilibrada e nutritiva.",
    author: "Equipe Mundo Natural",
    date: "10 de Janeiro, 2025",
    category: "Alimentação Natural",
    image: "/whole-grains-quinoa-oats-healthy.jpg",
  },
  {
    id: 3,
    title: "Chás Naturais: Qual é o Ideal Para Você?",
    excerpt: "Conheça as propriedades de diferentes chás e encontre o perfeito para suas necessidades.",
    author: "Equipe Mundo Natural",
    date: "5 de Janeiro, 2025",
    category: "Bem-Estar",
    image: "/herbal-tea-natural-wellness.jpg",
  },
  {
    id: 4,
    title: "Alimentação Orgânica: Vale a Pena?",
    excerpt: "Entenda os benefícios dos alimentos orgânicos e como eles impactam sua saúde.",
    author: "Equipe Mundo Natural",
    date: "28 de Dezembro, 2024",
    category: "Sustentabilidade",
    image: "/organic-vegetables-fresh-natural.jpg",
  },
  {
    id: 5,
    title: "Receitas Saudáveis com Produtos Naturais",
    excerpt: "Inspire-se com receitas deliciosas usando ingredientes naturais e nutritivos.",
    author: "Equipe Mundo Natural",
    date: "20 de Dezembro, 2024",
    category: "Receitas",
    image: "/healthy-recipe-natural-ingredients.jpg",
  },
  {
    id: 6,
    title: "Como Fortalecer Sua Imunidade Naturalmente",
    excerpt: "Dicas práticas e produtos naturais para manter seu sistema imunológico forte.",
    author: "Equipe Mundo Natural",
    date: "15 de Dezembro, 2024",
    category: "Saúde",
    image: "/immunity-boost-natural-health.jpg",
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-secondary/30 to-background py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-5xl font-bold mb-4 text-balance" style={{ fontFamily: "var(--font-playfair)" }}>
                Blog Mundo Natural
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Artigos sobre saúde natural, bem-estar e alimentação consciente
              </p>
            </div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogPosts.map((post) => (
                <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.image || "/placeholder.svg"}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{post.date}</span>
                      </div>
                      <span className="text-primary">{post.category}</span>
                    </div>
                    <CardTitle className="font-serif text-xl group-hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    <CardDescription>{post.excerpt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{post.author}</span>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/blog/${post.id}`}>
                          Ler mais
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}
