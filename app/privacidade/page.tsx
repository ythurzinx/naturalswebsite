import Link from "next/link";
import { store, whatsappUrl } from "@/lib/store";
export const metadata = { title: "Privacidade e cookies" };
export default function PrivacyPage() {
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Privacidade</span>
      </div>
      <div className="prose">
        <span className="eyebrow">TRANSPARÊNCIA TAMBÉM É CUIDADO</span>
        <h1 className="page-title">
          Sua privacidade importa<span>.</span>
        </h1>
        <p>
          Esta página explica o funcionamento desta versão do site da{" "}
          {store.name}. Usamos armazenamento local do navegador para o carrinho
          e, com sua escolha, para lembrar favoritos.
        </p>
        <h2>O que fica no seu navegador</h2>
        <ul>
          <li>
            <strong>Carrinho (essencial):</strong> identificadores dos produtos,
            quantidades e pesos escolhidos. A seleção expira após até 30 dias
            sem atualização. Nomes, endereços, dados de pagamento e documentos
            não são salvos junto ao carrinho.
          </li>
          <li>
            <strong>Escolha de privacidade (essencial):</strong> registra sua
            decisão por até 180 dias. Depois desse período, o site pergunta
            novamente.
          </li>
          <li>
            <strong>Favoritos (opcional):</strong> identificadores dos produtos
            preferidos. Só são lembrados entre visitas se você ativar as
            preferências. Ao desativá-las, os favoritos salvos são apagados.
            Durante a visita, é possível usar favoritos apenas em memória.
          </li>
        </ul>
        <p>
          O site funciona mesmo quando o navegador bloqueia o armazenamento
          local. Nessa situação, sua seleção pode se perder ao recarregar a
          página.
        </p>
        <h2>Sessão de pagamento e acesso ao pedido</h2>
        <p>
          O checkout usa um cookie essencial protegido, com duração de até 1
          hora. Outro cookie essencial permite consultar até cinco pedidos
          recentes neste navegador por até 7 dias. Eles guardam identificadores
          e dados de validação, sem nome, e-mail ou número de cartão. Se você
          bloquear cookies essenciais, o pagamento online e o acompanhamento
          podem ficar indisponíveis; o atendimento pelo WhatsApp continua
          disponível.
        </p>
        <h2>Cookies, publicidade e rastreamento</h2>
        <p>
          O código desta loja não instala ferramentas de análise de audiência,
          pixels de publicidade ou cookies de marketing. Imagens e fontes da
          loja são servidas junto com o site. A infraestrutura de hospedagem
          pode processar dados técnicos de acesso, como IP, data, navegador e
          registros de segurança, segundo as políticas do provedor.
        </p>
        <h2>Como alterar sua escolha</h2>
        <p>
          Use “Preferências de cookies”, no rodapé de qualquer página. Você pode
          recusar as preferências opcionais sem perder acesso à loja. Limpar os
          dados do site nas configurações do navegador apaga o carrinho, os
          favoritos e a escolha registrada.
        </p>
        <h2>Quando você paga com Mercado Pago</h2>
        <p>
          Ao escolher pagar online, seu nome, e-mail e os itens da compra são
          enviados ao Mercado Pago para criar e processar o pedido. Os dados de
          cartão ou Pix são informados diretamente no ambiente desse serviço,
          que aplica suas próprias políticas de privacidade e segurança. A loja
          consulta o resultado do pagamento para atender sua compra.
        </p>
        <p>
          Os registros de pedido e pagamento ficam no Mercado Pago e podem ser
          acessados pela loja para atendimento, conciliação, reembolso e
          cumprimento das obrigações aplicáveis. A loja mantém no seu banco os
          pedidos, itens, nome e e-mail para atendimento e conciliação. Para
          contato, também mantém telefone e observações; na entrega, o endereço,
          acessíveis à equipe autenticada. Números de cartão não são armazenados
          pela loja. A hospedagem pode registrar dados técnicos e
          identificadores de pedido para segurança e diagnóstico.
        </p>
        <h2>Cálculo de frete pelo CEP</h2>
        <p>
          Ao calcular o frete, o servidor consulta o CEP na BrasilAPI para obter
          o endereço público e as coordenadas aproximadas. Não envia nome,
          telefone, número do imóvel, e-mail ou itens da compra a esse serviço.
          Um cookie essencial de até 1 hora protege a consulta; a cotação
          assinada vale por 10 minutos. Os campos do endereço ficam em memória
          no navegador e são registrados pela loja quando você inicia o
          pagamento. As intenções de checkout permitem recuperar pedidos quando
          há falha de conexão. Registros de tentativa com mais de 7 dias são
          removidos nas próximas criações de checkout; pedidos efetivos seguem
          as obrigações aplicáveis à compra.
        </p>
        <h2>Atualizações do pedido por e-mail e WhatsApp</h2>
        <p>
          A loja pode usar a Brevo como operadora para enviar avisos
          transacionais de pagamento confirmado, pedido separado e saída para
          entrega. O e-mail recebe somente dados necessários a esses avisos. O
          WhatsApp exige sua autorização opcional no checkout, registrada por
          pedido; recusar não impede a compra. Não usamos essa escolha para
          publicidade.
        </p>
        <p>
          Quando o canal está ativo, o serviço recebe nome, contato,
          identificador e etapa do pedido e, na saída, a previsão em minutos
          informada pela equipe. Não enviamos dados de cartão, custos internos
          ou endereço completo nesses avisos. A Brevo e o WhatsApp/Meta
          processam os dados conforme seus termos. Para interromper avisos ou
          exercer seus direitos, fale com a loja pelo contato abaixo.
        </p>
        <h2>Quando você usa o WhatsApp</h2>
        <p>
          Os campos preenchidos na finalização permanecem em memória enquanto a
          página está aberta. Ao clicar em “Continuar no WhatsApp”, o site monta
          uma mensagem com sua seleção e os dados que você informou. O WhatsApp
          é aberto com essa mensagem; cabe a você revisá-la e enviá-la.
        </p>
        <p>
          O WhatsApp/Meta processa os dados conforme suas próprias condições. A
          loja recebe a mensagem depois que você a envia e usa as informações
          para atendimento e acompanhamento da compra. Evite enviar senhas,
          documentos desnecessários ou dados completos de cartão.
        </p>
        <h2>Links externos</h2>
        <p>
          O mapa, o Instagram e o WhatsApp são serviços externos, abertos
          somente quando você clica em seus links. Eles seguem políticas
          próprias de privacidade.
        </p>
        <h2>Fale com a loja sobre seus dados</h2>
        <p>
          Para solicitar acesso, correção ou exclusão de informações que você
          enviou no atendimento, ou para esclarecer como a loja trata seus
          dados,{" "}
          <a
            href={whatsappUrl(
              "Olá! Gostaria de falar sobre privacidade e o tratamento dos meus dados.",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            entre em contato com a Mundo Natural
          </a>
          . A equipe verificará a solicitação e as obrigações aplicáveis à
          compra. Endereço de contato: {store.address}.
        </p>
      </div>
    </main>
  );
}
