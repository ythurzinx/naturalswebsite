import type { Metadata } from "next"
import type { ReactNode } from "react"

import "@/styles/globals.css"

import { CartProvider } from "@/lib/cart-context"

export const metadata: Metadata = {
  title: "Mundo Natural",
  description: "Loja oficial da Mundo Natural com produtos saudáveis e naturais.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
