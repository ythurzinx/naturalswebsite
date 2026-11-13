import Link from "next/link";
import { ProductReviews, ReviewForm } from "@/components/product-reviews";
export const metadata = { title: "Avaliações de clientes" };
export default function ReviewsPage() {
  return (
    <main id="conteudo" className="shell page-main reviews-page">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Avaliações</span>
      </div>
      <span className="eyebrow">CONFIANÇA QUE SE CONSTRÓI</span>
      <h1 className="page-title">Sua experiência importa.</h1>
      <p className="section-description">
        Sabor, cuidado na embalagem e atendimento: compartilhe como foi comprar
        na Mundo Natural.
      </p>
      <ProductReviews />
      <ReviewForm />
    </main>
  );
}
