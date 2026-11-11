import Link from "next/link";
import { Leaf, Scale, Heart, ArrowUpRight } from "lucide-react";
export const metadata = { title: "Nossa história" };
export default function AboutPage() {
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Nossa história</span>
      </div>
      <section className="about-hero">
        <div>
          <span className="eyebrow">DA NOSSA VIZINHANÇA PARA A SUA ROTINA</span>
          <h1 className="page-title">
            Um mundo mais natural.
            <br />
            <em>Uma escolha de cada vez.</em>
          </h1>
          <p>
            A Mundo Natural é o seu cantinho de produtos naturais em Taboão da
            Serra. Um lugar para descobrir sabores, encontrar os ingredientes da
            rotina e conversar sobre suas escolhas.
          </p>
          <p>
            Das castanhas aos temperos, dos grãos aos chás, nosso catálogo reúne
            possibilidades para você levar mais natureza para o dia a dia, no
            seu ritmo.
          </p>
          <Link href="/contato" className="button button-outline">
            Conheça nossa loja <ArrowUpRight size={16} />
          </Link>
        </div>
        <img
          src="/images/loja-mundo-natural.webp"
          alt="Loja Mundo Natural em Taboão da Serra"
        />
      </section>
      <div className="value-grid">
        {[
          {
            icon: Leaf,
            title: "Natureza no cotidiano",
            text: "Ingredientes, sabores e pequenos rituais que encontram espaço na vida real.",
          },
          {
            icon: Scale,
            title: "Do seu jeito",
            text: "Uma variedade de produtos a granel para escolher a porção que faz sentido para você.",
          },
          {
            icon: Heart,
            title: "Carinho no atendimento",
            text: "Uma equipe para ajudar com sua seleção e confirmar os detalhes de cada compra.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <Icon size={30} strokeWidth={1.2} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
