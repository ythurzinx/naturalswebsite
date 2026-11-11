import Link from "next/link";
export default function NotFound() {
  return (
    <main id="conteudo" className="not-found">
      <span className="eyebrow">VAMOS ENCONTRAR UM NOVO CAMINHO</span>
      <h1>
        Essa página ficou
        <br />
        <em>fora do nosso jardim.</em>
      </h1>
      <p>
        Volte ao início ou explore nosso catálogo para encontrar suas próximas
        escolhas naturais.
      </p>
      <Link href="/produtos" className="button">
        Explorar nossos produtos
      </Link>
    </main>
  );
}
