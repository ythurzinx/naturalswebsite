import Link from "next/link";
export const metadata = { title: "Condições de compra" };
export default function TermsPage() {
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Condições de compra</span>
      </div>
      <div className="prose">
        <span className="eyebrow">CLAREZA EM CADA ETAPA</span>
        <h1 className="page-title">
          Como funciona sua compra<span>.</span>
        </h1>
        <h2>1. Explore e escolha</h2>
        <p>
          O site apresenta o catálogo de referência da Mundo Natural. Os valores
          foram importados da planilha existente da loja e podem estar
          desatualizados. As imagens são ilustrativas e não representam
          necessariamente a marca, a embalagem ou o lote disponível.
        </p>
        <h2>2. Monte sua seleção</h2>
        <p>
          Adicionar produtos ao carrinho cria uma lista de interesse. Essa ação
          não reserva estoque, não confirma um pedido e não inicia cobrança.
          Para produtos a granel, os valores são proporcionais ao peso
          escolhido; a pesagem final será confirmada pela loja.
        </p>
        <h2>3. Confirme com a equipe</h2>
        <p>
          Envie sua seleção pelo WhatsApp. Antes de pagar, confirme o preço
          atualizado, a disponibilidade, os ingredientes, os alergênicos, a
          validade, a forma de pagamento e as condições de entrega ou retirada.
          Suplementos e fitoterápicos exigem atenção às informações do
          fabricante e às orientações de um profissional habilitado quando
          aplicável.
        </p>
        <h2>4. Combine o recebimento</h2>
        <p>
          O frete, a área atendida e o prazo são combinados no atendimento. Para
          retirada, confirme o endereço e o horário antes de se deslocar. O site
          não estima distâncias ou prazos de entrega.
        </p>
        <h2>5. Pagamento e acompanhamento</h2>
        <p>
          Esta versão do site não processa pagamentos e não coleta dados de
          cartão. O atendimento informa os meios disponíveis. A conclusão e o
          acompanhamento da compra ocorrem diretamente com a loja.
        </p>
        <h2>Trocas, cancelamentos e devoluções</h2>
        <p>
          Entre em contato com a equipe com as informações da compra para
          receber orientação. Serão observadas as condições do produto e os
          direitos aplicáveis ao consumidor. Estas condições não limitam
          direitos previstos em lei.
        </p>
        <h2>Precisa de ajuda?</h2>
        <p>
          Acesse a página de <Link href="/contato">atendimento</Link>. Para
          saber como sua seleção e seus dados são tratados, leia a{" "}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>
      </div>
    </main>
  );
}
