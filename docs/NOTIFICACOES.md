# Avisos transacionais de pedidos

Integração escolhida: **Brevo**, reunindo e-mail transacional e WhatsApp oficial em uma conta. As mensagens refletem eventos confirmados: uma IA não inventa pagamento, etapa ou prazo. A geração com IA é usada nas imagens do catálogo.

Sem a Brevo, a equipe pode enviar os mesmos avisos manualmente pelo WhatsApp da loja, pelos botões do pedido no painel; veja [o guia de operação](OPERACAO-PEDIDOS-FRETE.md#avisar-o-cliente-sem-custo).

## Ativação na Hostinger

1. Crie uma conta Brevo e ative o serviço de e-mails transacionais. Verifique um remetente do domínio da loja, por exemplo `pedidos@mundonaturaltaboao.com.br`. Use um endereço que você controla; informar o endereço no código não o verifica. Configure a autenticação de domínio solicitada pela Brevo (DKIM e demais registros indicados no painel), preservando os registros A/CNAME do site.
2. Em **Hostinger → Variáveis de ambiente**, adicione `BREVO_API_KEY` com uma chave privada de **API v3**. Confira `APP_URL=https://mundonaturaltaboao.com.br` e reimplante a aplicação.
3. O servidor consulta `GET /v3/senders` e escolhe apenas um remetente **ativo do domínio exato de APP_URL**, sem `www`. Prioridade: `pedidos`, `contato`, `atendimento`, `noreply`, `no-reply`, depois os demais. Se não houver remetente verificado, o painel indica a pendência e o canal não é ativado. Para usar outro endereço já verificado na Brevo, configure opcionalmente `BREVO_SENDER_EMAIL`; nesse caso a verificação no provedor é sua responsabilidade.
4. Em **Admin → E-mails automáticos**, confira o remetente e o status. Na primeira configuração válida, o canal de e-mail é ativado para eventos futuros. Uma escolha explícita feita no painel, incluindo desligar o canal, prevalece após reinícios. Não há envio em massa de pedidos antigos. As chaves nunca aparecem no navegador.
5. A aplicação **Node.js em produção processa a fila a cada minuto**, inclusive com o painel fechado, enquanto estiver em execução. A confirmação verificada do pagamento também inicializa o canal e tenta enviar. O processo não inicia durante `npm run build`, desenvolvimento ou testes. Não é necessário configurar cron para o uso normal na Hostinger.
6. **Opcional: WhatsApp automático.** Conecte o WhatsApp Business **+55 11 5199-3525** na Brevo, aprove três modelos de utilidade com a Meta, configure `BREVO_WHATSAPP_SENDER=551151993525` na Hostinger e reimplante. Preencha os três IDs em **E-mails automáticos** e ative esse canal. A verificação e os créditos do WhatsApp são independentes dos e-mails. Sem isso, use a cópia e a conversa manual no pedido.
7. Faça uma compra controlada com contatos seus. Confira o e-mail, o histórico do pedido e o relatório da Brevo. Para WhatsApp automático, autorize o canal no checkout. Confira todos os itens da embalagem e use o bloco **Etapa e mensagem ao cliente** para salvar a separação/saída; a previsão de 1–240 minutos é salva junto da saída para entrega.

Como redundância, um agendador externo pode fazer **POST HTTPS** a `https://mundonaturaltaboao.com.br/api/notifications/worker` a cada minuto, com `Authorization: Bearer SEU_SEGREDO_DO_WORKER`. Configure esse mesmo segredo em `NOTIFICATION_WORKER_SECRET` (32–128 caracteres de letras, números, `_` ou `-`). Guarde-o no cofre do agendador, nunca na URL. Os processos compartilham as mesmas travas no banco. Cada execução envia até quatro avisos; em grande volume, acompanhe a fila e a capacidade do provedor.

Não é necessária uma nova importação SQL: a integração usa a tabela `mn_settings` já existente. A URL de checkout, os tokens e os pedidos de homologação do Mercado Pago continuam separados; a homologação privada não produz avisos reais.

## Modelos sugeridos

Parâmetros enviados por mensagem: `nome`, `pedido`, `recebimento`, `previsao_minutos`, `telefone_loja`. No editor, associe a variável ao parâmetro transacional correspondente (por exemplo, `params.nome`). Os IDs variam conforme a conta; não copie um ID de exemplo.

- **Pagamento aprovado:** “Olá, {{nome}}! O pagamento do pedido {{pedido}} foi aprovado. A Mundo Natural recebeu sua compra e iniciará a separação. Atendimento: {{telefone_loja}}.”
- **Pedido separado:** “Olá, {{nome}}! O pedido {{pedido}} foi separado e embalado pela Mundo Natural. Forma de recebimento: {{recebimento}}. Para retirada, já pode buscar na loja; para entrega, aguarde o aviso de saída. Atendimento: {{telefone_loja}}.”
- **Saiu para entrega:** “Olá, {{nome}}! Seu pedido {{pedido}} saiu para entrega. A previsão é de aproximadamente {{previsao_minutos}} minutos a partir da saída e pode variar com o trânsito. Atendimento: {{telefone_loja}}.”

O e-mail possui HTML responsivo e texto simples em português, com primeiro nome, itens (combo agrupado uma vez), valores da compra, forma de recebimento, acompanhamento e contato da loja. Não envia endereço, custos internos, observações privadas, dados de cartão ou conteúdo promocional.

## Custos, consentimento e acompanhamento

A Brevo oferece plano com até 300 e-mails/dia; confirme a oferta atual na conta. WhatsApp usa créditos pagos, variando conforme país e categoria do modelo. A aplicação não compra créditos ou contrata plano. O cliente escolhe uma caixa **desmarcada** no checkout para autorizar WhatsApp por pedido; a recusa não bloqueia a compra. Telefone é necessário para atendimento também na retirada. O e-mail é usado para comunicações da compra.

Eventos futuros são registrados numa fila durável, atomicamente com a confirmação/etapa. A chave única por pedido + evento + canal evita duplicações por cliques, webhook ou recarregamento. Não há disparo retroativo em massa ao ativar canais. Alterar/desligar a configuração cancela avisos pendentes gerados pela revisão anterior. Saídas para entrega possuem validade curta para não mandar uma previsão vencida. Se o pedido for cancelado/reembolsado ou mudar de etapa antes do envio, avisos incompatíveis são cancelados.

O histórico em cada pedido distingue **na fila**, **enviando**, **aceito pelo serviço**, **cancelado**, **falha** e **envio incerto**. Aceito não comprova entrega ou leitura; consulte o relatório da Brevo. O site não recebe webhooks de entrega/leitura nesta versão. Limitação 429 do provedor permite até três tentativas espaçadas; timeout, erro de servidor ou interrupção após início ficam incertos e não são repetidos automaticamente. Isso reduz duplicações quando o provedor pode ter aceitado a mensagem antes da falha da conexão. Confirme o resultado na Brevo e contate o cliente manualmente quando necessário.

## Fontes oficiais consultadas

- [API WhatsApp](https://developers.brevo.com/docs/whatsapp-messages)
- [Modelo oficial dos parâmetros de WhatsApp](https://github.com/getbrevo/brevo-csharp/blob/master/docs/SendWhatsappMessage.md)
- [Parâmetros transacionais](https://help.brevo.com/hc/en-us/articles/15923206071826-Personalize-your-WhatsApp-messages-with-transactional-parameters)
- [Consultar remetentes ativos](https://developers.brevo.com/reference/get-senders)
- [Remetentes e domínios](https://developers.brevo.com/docs/getting-started-with-senders-and-domains)
- [API e-mail](https://developers.brevo.com/reference/send-transac-email)
- [Idempotência](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Planos e créditos](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
