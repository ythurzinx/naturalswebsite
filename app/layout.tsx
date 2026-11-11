import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { CartProvider } from "@/lib/cart-context";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CookieConsent } from "@/components/cookie-consent";
import { MobileNavigation } from "@/components/mobile-navigation";
import "@/styles/globals.css";
import { publicCatalog } from "@/lib/server/shop";
import type { Product } from "@/lib/types";
// A fresh response is required for per-request script nonces.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://example.invalid",
  ),
  title: {
    default: "Mundo Natural | Seu mundo mais natural",
    template: "%s | Mundo Natural",
  },
  description:
    "Castanhas, grãos, chás, temperos e suplementos. Conheça a Mundo Natural de Taboão da Serra e monte sua seleção com atendimento pelo WhatsApp.",
  icons: {
    icon: "/images/mundo-natural-logo.png",
    apple: "/images/mundo-natural-logo.png",
  },
  openGraph: {
    title: "Mundo Natural — escolhas que fazem bem",
    description:
      "Mais natureza na sua rotina. Sua loja de produtos naturais em Taboão da Serra.",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/whole-grains-quinoa-oats-healthy.jpg",
        width: 1024,
        height: 1024,
      },
    ],
  },
};
export const viewport: Viewport = {
  themeColor: "#274e37",
  viewportFit: "cover",
};
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialCatalog = (await publicCatalog(true)) as Product[];
  return (
    <html lang="pt-BR">
      <body className={GeistSans.className}>
        <CartProvider initialCatalog={initialCatalog}>
          <a href="#conteudo" className="skip-link">
            Pular para o conteúdo
          </a>
          <Header />
          {children}
          <Footer />
          <MobileNavigation />
          <CookieConsent />
        </CartProvider>
      </body>
    </html>
  );
}
