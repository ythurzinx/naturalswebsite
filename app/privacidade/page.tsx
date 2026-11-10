import { ShopHeader, ShopFooter } from "@/components/shop-shell";
export default function Privacy() {
  return (
    <div className="mn">
      <ShopHeader />
      <main className="inner">
        <h1>Privacidade e cookies</h1>
        <section className="mn-panel">
          <h2>Durante a compra</h2>
          <p>
            A sacola guarda os produtos e as quantidades neste navegador. Ao
            iniciar um pedido, a aba guarda temporariamente um identificador
            para evitar duplicação em caso de falha. Você pode apagar esses
            dados nas configurações do navegador.
          </p>
          <p>
            A loja registra o número do pedido, os itens, as quantidades, os
            preços, a data, a forma de recebimento e a situação. O painel da
            loja permite consultar esses registros. Endereço, telefone de
            contato e pagamento são combinados diretamente no WhatsApp.
          </p>
          <h2>Cookies e serviços externos</h2>
          <p>
            O painel usa um cookie essencial de sessão por até oito horas. A
            vitrine não instala cookies de publicidade ou análise. Ao abrir o
            WhatsApp ou o iFood, você passa a usar os serviços dessas
            plataformas.
          </p>
          <p>
            Para tratar de um pedido ou solicitar a exclusão dos dados
            associados, fale com a Mundo Natural pelo contato em Nossa loja e
            informe o número do pedido.
          </p>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
