import Link from "next/link";
import { MapPin, MessageCircle, ArrowUpRight } from "lucide-react";
import { store, whatsappUrl } from "@/lib/store";
export const metadata = { title: "Fale com a gente" };
const faqs = [
  [
    "Como faço uma compra?",
    "Explore o catálogo, escolha as porções e adicione os produtos ao carrinho. Na finalização, escolha Pix ou cartão pelo Mercado Pago para retirada na loja, ou continue no WhatsApp para combinar os detalhes. Para entrega, consulte o orçamento antes de pagar.",
  ],
  [
    "Vocês fazem entregas?",
    "Consulte nossa equipe pelo WhatsApp informando seu CEP, bairro e cidade. A área de atendimento, o valor do frete e o prazo são confirmados individualmente. Você também pode combinar a retirada na loja.",
  ],
  [
    "Os preços do catálogo estão atualizados?",
    "Os preços são informados pela loja a partir do seu catálogo. O total é conferido antes de abrir o pagamento. A inclusão no carrinho não reserva estoque; se tiver dúvidas sobre disponibilidade, fale com a equipe.",
  ],
  [
    "Como funcionam os produtos a granel?",
    "Os produtos a granel têm preço por 100 g. Escolha 100 g, 200 g, 300 g e assim por diante, até 5.000 g por porção. Você também pode ajustar o peso no carrinho. O valor de 100 g é arredondado para centavos antes de multiplicar os blocos e as porções.",
  ],
  [
    "Tenho uma alergia ou restrição alimentar. Como escolher?",
    "Converse com a equipe antes de confirmar sua seleção. Solicite a lista de ingredientes e as informações de alergênicos e de possível contato cruzado. As imagens e as categorias do site não certificam a ausência de alergênicos.",
  ],
  [
    "Como acompanho uma compra ou peço uma troca?",
    "Após o pagamento online, acompanhe o status na página de retorno do Mercado Pago, no mesmo navegador. Para atendimento ou trocas, fale com a loja pelo WhatsApp e informe o número do pedido, sem enviar senhas ou informações completas do cartão. A equipe orientará sobre acompanhamento, trocas, cancelamentos e devoluções conforme as condições aplicáveis.",
  ],
];
export default function ContactPage() {
  return (
    <main id="conteudo" className="shell page-main">
      <div className="breadcrumbs">
        <Link href="/">Início</Link>
        <span>/</span>
        <span>Atendimento</span>
      </div>
      <span className="eyebrow">GENTE DE VERDADE, CUIDADO DE VERDADE</span>
      <h1 className="page-title">
        Conte com a gente<span>.</span>
      </h1>
      <p className="section-description">
        Uma dúvida, uma escolha ou só uma boa conversa. Estamos por aqui.
      </p>
      <div className="contact-grid">
        <section className="contact-card">
          <MessageCircle size={32} strokeWidth={1.2} />
          <h2>Vamos conversar?</h2>
          <p>
            Consulte produtos, preços, entregas e horários de atendimento
            diretamente com nossa equipe.
          </p>
          <p>WhatsApp: {store.phoneLabel}</p>
          <a
            href={whatsappUrl()}
            className="button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chamar no WhatsApp <ArrowUpRight size={17} />
          </a>
        </section>
        <section className="contact-card">
          <MapPin size={32} strokeWidth={1.2} />
          <h2>Seu cantinho natural.</h2>
          <p>{store.address}</p>
          <p>
            Antes de sair, confirme o endereço e o horário com a equipe. Vai ser
            um prazer receber você.
          </p>
          <a
            className="button button-outline"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver localização no mapa <ArrowUpRight size={17} />
          </a>
        </section>
      </div>
      <section className="faq">
        <span className="eyebrow">RESPOSTAS PARA FACILITAR</span>
        <h2>É bom saber.</h2>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
