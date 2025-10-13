"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

const questions = [
  {
    id: 1,
    question: "Qual é seu principal objetivo de saúde?",
    options: [
      { value: "energy", label: "Mais energia e disposição" },
      { value: "immunity", label: "Fortalecer imunidade" },
      { value: "digestion", label: "Melhorar digestão" },
      { value: "stress", label: "Reduzir estresse" },
    ],
  },
  {
    id: 2,
    question: "Como você descreveria seu estilo de vida?",
    options: [
      { value: "active", label: "Muito ativo e esportivo" },
      { value: "moderate", label: "Moderadamente ativo" },
      { value: "sedentary", label: "Sedentário" },
      { value: "stressed", label: "Estressante e corrido" },
    ],
  },
  {
    id: 3,
    question: "Qual sua preferência alimentar?",
    options: [
      { value: "vegan", label: "Vegano/Vegetariano" },
      { value: "organic", label: "Orgânico e natural" },
      { value: "balanced", label: "Equilibrado" },
      { value: "supplements", label: "Suplementação" },
    ],
  },
]

const recommendations: Record<string, string[]> = {
  energy: ["Spirulina", "Maca Peruana", "Guaraná em Pó"],
  immunity: ["Própolis", "Vitamina C", "Equinácea"],
  digestion: ["Psyllium", "Linhaça", "Chia"],
  stress: ["Camomila", "Melissa", "Valeriana"],
}

export function WellnessQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showResults, setShowResults] = useState(false)

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentQuestion]: value })
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setShowResults(true)
    }
  }

  const handleReset = () => {
    setCurrentQuestion(0)
    setAnswers({})
    setShowResults(false)
  }

  const getRecommendations = () => {
    const firstAnswer = answers[0]
    return recommendations[firstAnswer] || []
  }

  if (showResults) {
    const products = getRecommendations()
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Seus Produtos Recomendados</CardTitle>
          <CardDescription>Baseado nas suas respostas, estes produtos podem ajudar você:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {products.map((product, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                <span>{product}</span>
              </li>
            ))}
          </ul>
          <Button onClick={handleReset} className="w-full">
            Refazer Quiz
          </Button>
        </CardContent>
      </Card>
    )
  }

  const question = questions[currentQuestion]

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Descubra Seu Equilíbrio</CardTitle>
        <CardDescription>
          Pergunta {currentQuestion + 1} de {questions.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <h3 className="text-lg font-medium">{question.question}</h3>
        <RadioGroup value={answers[currentQuestion]} onValueChange={handleAnswer}>
          {question.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Button onClick={handleNext} disabled={!answers[currentQuestion]} className="w-full">
          {currentQuestion < questions.length - 1 ? "Próxima" : "Ver Resultados"}
        </Button>
      </CardContent>
    </Card>
  )
}
