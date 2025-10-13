"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

export function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState("")

  useEffect(() => {
    const hasSeenPopup = localStorage.getItem("newsletter-popup-seen")
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem("newsletter-popup-seen", "true")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Newsletter signup:", email)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="relative max-w-md w-full p-8 animate-in fade-in zoom-in duration-300">
        <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={handleClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>

        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>

          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
            Ganhe 10% de Desconto
          </h2>

          <p className="text-muted-foreground">
            Inscreva-se na nossa newsletter e receba 10% de desconto na sua primeira compra, além de dicas exclusivas
            sobre vida saudável.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Seu melhor e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
            <Button type="submit" className="w-full h-12">
              Quero meu desconto
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Ao se inscrever, você concorda em receber e-mails promocionais.
          </p>
        </div>
      </Card>
    </div>
  )
}
