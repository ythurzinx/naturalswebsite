"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function WhatsAppButton() {
  const phoneNumber = "551531917309"
  const message = "Olá! Gostaria de saber mais sobre os produtos da Mundo Natural."

  const handleClick = () => {
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank")
  }

  return (
    <Button
      onClick={handleClick}
      size="lg"
      className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 p-0"
      aria-label="Contact via WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  )
}
