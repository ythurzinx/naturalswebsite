"use client"

import Link from "next/link"
import { ShoppingCart, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"
import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"

export function Header() {
  const { itemCount } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo-mundo-natural.jpg"
              alt="Mundo Natural"
              width={60}
              height={60}
              className="rounded-full"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-primary">MUNDO NATURAL</span>
              <span className="text-xs text-muted-foreground tracking-wide">PRODUTOS NATURAIS</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Início
            </Link>
            <Link href="/produtos" className="text-sm font-medium hover:text-primary transition-colors">
              Produtos
            </Link>
            <Link href="/sobre" className="text-sm font-medium hover:text-primary transition-colors">
              Sobre
            </Link>
            <Link href="/contato" className="text-sm font-medium hover:text-primary transition-colors">
              Contato
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/carrinho">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-6 border-t border-border">
            <div className="flex flex-col gap-4">
              <Link
                href="/"
                className="text-sm font-medium hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Início
              </Link>
              <Link
                href="/produtos"
                className="text-sm font-medium hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Produtos
              </Link>
              <Link
                href="/sobre"
                className="text-sm font-medium hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sobre
              </Link>
              <Link
                href="/contato"
                className="text-sm font-medium hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contato
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
