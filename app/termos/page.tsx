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
          O site apresenta os produtos e os preços informados pela Mundo
          Natural. Confira sua seleção e o total antes de confirmar o pagamento.
          As imagens são ilustrativas e não representam necessariamente a marca,
          a embalagem ou o lote disponível.
        </p>
        <h2>2. Monte sua seleção</h2>
        <p>
          Adicionar produtos ao carrinho cria uma lista de interesse. Essa ação
          não reserva estoque, não confirma um pedido e não inicia cobrança. Os
          produtos a granel têm preço por 100 g e são vendidos de 100 em 100 g.
          O valor de 100 g é arredondado para centavos e multiplicado pelos
          blocos de 100 g escolhidos e pela quantidade de porções. Confira o
          peso e o total antes de pagar.
        </p>
        <h2>3. Confirme com a equipe</h2>
        <p>
          Se tiver dúvidas, converse com a equipe antes de pagar. Confirme a
          disponibilidade, os ingredientes, os alergênicos, a validade e as
          condições de retirada. Para entrega, solicite o orçamento pelo
          atendimento. Suplementos e fitoterápicos exigem atenção às informações
          do fabricante e às orientações de um profissional habilitado quando
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
          Para compras com retirada, quando disponível, o site permite pagar com
          Pix ou cartão no ambiente do Mercado Pago. A loja não recebe nem
          armazena o número do cartão. A confirmação depende da aprovação do
          pagamento; retornar à loja não significa que a compra foi paga.
          Acompanhe o status na página de retorno ou no atendimento. As
          condições de parcelamento e eventuais custos são exibidos pelo Mercado
          Pago antes da confirmação. Guarde o número do pedido e combine a
          retirada.
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
