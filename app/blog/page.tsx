import Link from "next/link";
import { ArrowRight } from "lucide-react";
export const metadata = { title: "Viver bem" };
const articles = [
  {
    title: "Pequenos rituais, boas pausas.",
    category: "UM TEMPO PARA VOCÊ",
    image: "/herbal-tea-natural-wellness.jpg",
    intro:
      "Preparar uma xícara pode ser um convite para desacelerar e saborear o momento.",
    content:
      "Separe sua xícara favorita, escolha uma infusão pelo sabor e siga as instruções de preparo do fabricante. Reserve alguns minutos para aproveitar o aroma. Se houver restrições de saúde, uso de medicamentos, gestação ou dúvida sobre alguma erva, consulte um profissional antes de consumi-la.",
    link: "/produtos?categoria=Ch%C3%A1s%20e%20ervas",
    cta: "Explore chás e ervas",
  },
  {
    title: "Sua porção. Seu jeito.",
    category: "ESCOLHAS A GRANEL",
    image: "/whole-grains-quinoa-oats-healthy.jpg",
    intro:
      "Escolher a quantidade pode facilitar o planejamento e ajudar a evitar sobras.",
    content:
      "Comece pensando nas receitas que você pretende preparar e em quantas pessoas vão compartilhar a refeição. Escolha porções menores para experimentar ingredientes novos. Depois da compra, siga as orientações de conservação, validade e alergênicos da embalagem ou fornecidas pela loja.",
    link: "/produtos?categoria=Gr%C3%A3os%20e%20sementes",
    cta: "Conheça grãos e sementes",
  },
  {
    title: "Mais cor na sua rotina.",
    category: "INSPIRAÇÃO À MESA",
    image: "/healthy-recipe-natural-ingredients.jpg",
    intro:
      "Novas texturas e temperos podem dar outra cara às receitas que você já adora.",
    content:
      "Experimente acrescentar um ingrediente de cada vez às preparações do dia a dia. Combine texturas, prove antes de temperar novamente e anote suas combinações favoritas. Planeje as porções e escolha ingredientes adequados às suas preferências e necessidades alimentares.",
    link: "/produtos?categoria=Temperos",
    cta: "Descubra novos temperos",
  },
];
export default function JournalPage() {
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Viver bem</span>
      </div>
      <span className="eyebrow">INSPIRAÇÃO PARA O SEU DIA</span>
      <h1 className="page-title">
        Viver bem é cultivar
        <br />
        <em>pequenas escolhas.</em>
      </h1>
      <p className="section-description">
        Ideias simples para trazer mais sabor, presença e natureza para a
        rotina.
      </p>
      <div className="journal-grid">
        {articles.map((article) => (
          <article className="journal-card" key={article.title}>
            <img src={article.image} alt={article.title} loading="lazy" />
            <div>
              <span className="eyebrow">{article.category}</span>
              <h2>{article.title}</h2>
              <p>{article.intro}</p>
              <details>
                <summary>Continue a leitura</summary>
                <p>{article.content}</p>
              </details>
              <Link href={article.link}>
                {article.cta} <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
