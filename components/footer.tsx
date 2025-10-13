import { MapPin, Phone, Mail, Instagram } from "lucide-react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold mb-4">Mundo Natural</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sua loja de produtos naturais em Taboão da Serra. Oferecemos suplementos, grãos, especiarias e produtos
              naturais de qualidade.
            </p>
          </div>

          {/* Contact - Updated phone number to (15) 3191-7309 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contato</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">
                  Rua José Duarte Souza, 21
                  <br />
                  Jardim das Margaridas
                  <br />
                  Taboão da Serra - SP
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:1531917309" className="text-muted-foreground hover:text-primary transition-colors">
                  (15) 3191-7309
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Instagram className="h-4 w-4 text-primary" />
                <a
                  href="https://instagram.com/_mundonaturalto"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  @_mundonaturalto
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">mundonaturaltaboao.com.br</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Links Rápidos</h3>
            <div className="flex flex-col gap-2">
              <Link href="/produtos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Produtos
              </Link>
              <Link href="/sobre" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Sobre Nós
              </Link>
              <Link href="/contato" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Contato
              </Link>
              <Link href="/carrinho" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Carrinho
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Mundo Natural. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
