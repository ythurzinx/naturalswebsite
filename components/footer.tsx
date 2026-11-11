"use client";
import Link from "next/link";
import {
  Leaf,
  Instagram,
  MapPin,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";
import { store, whatsappUrl } from "@/lib/store";
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-about">
          <Link href="/" className="footer-brand">
            <Leaf size={27} /> Mundo Natural<span>ESCOLHAS QUE FAZEM BEM.</span>
          </Link>
          <p>
            Mais natureza na sua rotina.
            <br />
            Mais cuidado em cada escolha.
          </p>
          <a
            href={store.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram da Mundo Natural"
          >
            <Instagram size={19} />
          </a>
        </div>
        <div>
          <h3>Explore nosso mundo</h3>
          <Link href="/produtos">Todos os produtos</Link>
          <Link href="/favoritos">Meus favoritos</Link>
          <Link href="/sobre">Nossa história</Link>
          <Link href="/blog">Inspiração para viver bem</Link>
        </div>
        <div>
          <h3>Conte com a gente</h3>
          <Link href="/contato">Atendimento e entregas</Link>
          <Link href="/privacidade">Política de privacidade</Link>
          <Link href="/termos">Condições de compra</Link>
          <button
            onClick={() =>
              window.dispatchEvent(new Event("open-cookie-settings"))
            }
          >
            Preferências de cookies
          </button>
        </div>
        <div className="footer-contact">
          <h3>Da nossa loja para você</h3>
          <p>
            <MapPin size={17} />
            {store.address}
          </p>
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={17} /> Fale com a Mundo Natural{" "}
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>
          © {new Date().getFullYear()} Mundo Natural. Feito para uma vida mais
          natural.
        </span>
        <span>
          <Leaf size={13} /> Pequenas escolhas. Um mundo de diferença.
        </span>
      </div>
    </footer>
  );
}
