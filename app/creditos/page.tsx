import Link from "next/link";
import sources from "@/data/product-photo-sources.json";
export const metadata = { title: "Créditos das imagens" };
export default function CreditsPage() {
  const photos = Object.values(sources);
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Créditos das imagens</span>
      </div>
      <div className="prose">
        <span className="eyebrow">IMAGENS COM ORIGEM</span>
        <h1 className="page-title">
          Créditos das fotografias<span>.</span>
        </h1>
        <p>
          Usamos fotos ilustrativas dos produtos, de seus ingredientes de origem
          ou de sugestões de apresentação. As imagens não comprovam marca,
          embalagem, composição ou lote da loja. A apresentação pode variar;
          consulte os ingredientes e alergênicos de cada produto.
        </p>
        <p>
          As fotografias abaixo foram disponibilizadas por seus autores no
          Wikimedia Commons, sob as licenças indicadas. Foram redimensionadas e
          convertidas para WebP. As versões convertidas preservam as licenças
          originais. A utilização não implica apoio dos autores à loja. Fotos
          enviadas pela loja substituem essas referências.
        </p>
      </div>
      <div className="photo-credits-grid">
        {photos.map((photo) => (
          <article key={photo.path} className="photo-credit">
            <img
              src={photo.path}
              alt={photo.caption}
              width={160}
              height={160}
              loading="lazy"
            />
            <div>
              <h2>
                <a
                  href={photo.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {photo.title.replace(/^File:/, "")}
                </a>
              </h2>
              <p>{photo.author}</p>
              <a
                href={
                  photo.licenseUrl ||
                  "https://creativecommons.org/publicdomain/mark/1.0/"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {photo.license}
              </a>
              <small>Redimensionamento e conversão para WebP.</small>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
