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
          Origem das imagens<span>.</span>
        </h1>
        <p>
          O catálogo a granel usa imagens ilustrativas geradas com inteligência
          artificial, com fundo claro, tigela branca e iluminação uniforme. As
          imagens não comprovam marca, embalagem, composição ou lote da loja. A
          apresentação pode variar; consulte os ingredientes e alergênicos de
          cada produto.
        </p>
        <p>
          As ilustrações foram criadas para a Mundo Natural com a ferramenta de
          geração de imagens da OpenAI. Cada arquivo está associado ao seu
          produto e possui origem e integridade registradas no projeto. As
          imagens foram extraídas dos quadros gerados e convertidas para WebP
          para carregar com agilidade. Não são fotografias do lote real. Fotos
          enviadas pela loja no painel substituem as ilustrações.
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
              <small>Ilustração gerada por IA · conversão para WebP.</small>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
