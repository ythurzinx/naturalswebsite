# Avisos transacionais de pedidos

Integração escolhida: **Brevo**, reunindo e-mail transacional e WhatsApp oficial em uma conta. As mensagens refletem eventos confirmados: uma IA não inventa pagamento, etapa ou prazo. A geração com IA é usada nas imagens do catálogo.

## Ativação na Hostinger

1. Crie uma conta Brevo e ative o serviço de e-mails transacionais. Verifique um remetente de e-mail que você controla. Configure a autenticação de domínio solicitada pela Brevo (DKIM e demais registros indicados no painel), preservando os registros A/CNAME do site.
2. Ative WhatsApp na Brevo e conecte o WhatsApp Business da loja **+55 11 5199-3525**. O número precisa ser verificado pelo provedor; informar o número no site não faz essa habilitação.
3. Crie três modelos de **utilidade**, em português do Brasil. Aguarde aprovação da Meta. Para os campos dinâmicos, associe os nomes dos parâmetros abaixo no editor da Brevo; não use um atributo global do contato como previsão de entrega.
4. Na aplicação Node.js da Hostinger → Variáveis de ambiente, configure:
   - `BREVO_API_KEY`: chave privada da Brevo;
   - `BREVO_SENDER_EMAIL`: remetente de e-mail verificado;
   - `BREVO_WHATSAPP_SENDER=551151993525`: número conectado na Brevo;
   - `NOTIFICATION_WORKER_SECRET`: segredo aleatório separado, com 32 a 128 caracteres de letras, números, `_` ou `-`.
5. Reimplante a aplicação. Em **Admin → Mensagens aos clientes**, preencha os IDs numéricos dos três modelos e ative os canais desejados. Eles ficam desligados inicialmente. Credenciais não aparecem no painel nem no navegador. A indicação “configurado” verifica a presença/formato dos valores; a aprovação e validade real devem ser conferidas no provedor.
6. Configure um agendador confiável para fazer **POST HTTPS** a `https://mundonaturaltaboao.com.br/api/notifications/worker` **a cada minuto**, com cabeçalho `Authorization: Bearer SEU_SEGREDO_DO_WORKER`. Guarde o segredo no cofre do agendador, não na URL ou em um repositório. O serviço executa no máximo quatro avisos por chamada. Sem o agendador, o painel autenticado processa a fila enquanto permanece aberto e a confirmação de pagamento tenta processá-la pelo webhook/consulta verificada.
7. Faça uma compra controlada com contatos seus, marque o consentimento WhatsApp e confira os três avisos. Marque cada item da embalagem antes de “Separado”. Salve a **previsão de chegada (1–240 minutos)** antes de “Saiu para entrega”. Retirada não permite saída para entrega.

Não é necessária uma nova importação SQL: a integração usa a tabela `mn_settings` já existente. A URL de checkout, os tokens e os pedidos de homologação do Mercado Pago continuam separados; a homologação privada não produz avisos reais.

## Modelos sugeridos

Parâmetros enviados por mensagem: `nome`, `pedido`, `recebimento`, `previsao_minutos`, `telefone_loja`. No editor, associe a variável ao parâmetro transacional correspondente (por exemplo, `params.nome`). Os IDs variam conforme a conta; não copie um ID de exemplo.

- **Pagamento aprovado:** “Olá, {{nome}}! O pagamento do pedido {{pedido}} foi aprovado. A Mundo Natural recebeu sua compra e iniciará a separação. Atendimento: {{telefone_loja}}.”
- **Pedido separado:** “Olá, {{nome}}! O pedido {{pedido}} foi separado e embalado pela Mundo Natural. Forma de recebimento: {{recebimento}}. Para retirada, já pode buscar na loja; para entrega, aguarde o aviso de saída. Atendimento: {{telefone_loja}}.”
- **Saiu para entrega:** “Olá, {{nome}}! Seu pedido {{pedido}} saiu para entrega. A previsão é de aproximadamente {{previsao_minutos}} minutos a partir da saída e pode variar com o trânsito. Atendimento: {{telefone_loja}}.”

O e-mail já possui modelos próprios em português, com o mesmo conteúdo operacional. Não envia endereço, custos internos, observações privadas, dados de cartão ou conteúdo promocional.

## Custos, consentimento e acompanhamento

A Brevo oferece plano com até 300 e-mails/dia; confirme a oferta atual na conta. WhatsApp usa créditos pagos, variando conforme país e categoria do modelo. A aplicação não compra créditos ou contrata plano. O cliente escolhe uma caixa **desmarcada** no checkout para autorizar WhatsApp por pedido; a recusa não bloqueia a compra. Telefone é necessário para atendimento também na retirada. O e-mail é usado para comunicações da compra.

Eventos futuros são registrados numa fila durável, atomicamente com a confirmação/etapa. A chave única por pedido + evento + canal evita duplicações por cliques, webhook ou recarregamento. Não há disparo retroativo em massa ao ativar canais. Alterar/desligar a configuração cancela avisos pendentes gerados pela revisão anterior. Saídas para entrega possuem validade curta para não mandar uma previsão vencida. Se o pedido for cancelado/reembolsado ou mudar de etapa antes do envio, avisos incompatíveis são cancelados.

O histórico em cada pedido distingue **na fila**, **enviando**, **aceito pelo serviço**, **cancelado**, **falha** e **envio incerto**. Aceito não comprova entrega ou leitura; consulte o relatório da Brevo. O site não recebe webhooks de entrega/leitura nesta versão. Limitação 429 do provedor permite até três tentativas espaçadas; timeout, erro de servidor ou interrupção após início ficam incertos e não são repetidos automaticamente. Isso reduz duplicações quando o provedor pode ter aceitado a mensagem antes da falha da conexão. Confirme o resultado na Brevo e contate o cliente manualmente quando necessário.

## Fontes oficiais consultadas

- [API WhatsApp](https://developers.brevo.com/docs/whatsapp-messages)
- [Modelo oficial dos parâmetros de WhatsApp](https://github.com/getbrevo/brevo-csharp/blob/master/docs/SendWhatsappMessage.md)
- [Parâmetros transacionais](https://help.brevo.com/hc/en-us/articles/15923206071826-Personalize-your-WhatsApp-messages-with-transactional-parameters)
- [API e-mail](https://developers.brevo.com/reference/send-transac-email)
- [Idempotência](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Planos e créditos](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
