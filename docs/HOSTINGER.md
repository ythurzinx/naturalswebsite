# Publicar na Hostinger com Pix e cartão

Use uma aplicação **Node.js / Next.js**, conectada à branch `main` deste repositório. A hospedagem Business/Cloud compatível com aplicações Node.js ou uma VPS atende a este modelo. Um envio de arquivos estáticos para `public_html` não executa o backend de pagamentos.

## 1. Criar a aplicação

No hPanel, escolha adicionar uma aplicação Node.js, conecte o GitHub e selecione este repositório. Escolha Next.js e Node.js 22.

- Instalação: `npm ci`
- Build: `npm run build`
- Inicialização: `npm start`
- A aplicação respeita a porta disponibilizada pela hospedagem.
- Não use exportação estática. As APIs, os cookies protegidos e a política de scripts precisam do servidor.

Associe o domínio, habilite o certificado SSL e escolha uma origem principal. Se usar `www` e o domínio sem `www`, redirecione a alternativa para a principal no painel. O valor de `APP_URL` deve corresponder exatamente à origem usada pelo comprador.

## 2. Colocar as variáveis no painel

Em **Environment variables**, configure:

| Nome                         | Valor                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                    | Origem HTTPS da loja, por exemplo `https://sualoja.com.br`, sem caminho ou parâmetros.                                              |
| `MERCADOPAGO_ACCESS_TOKEN`   | Access Token privado da aplicação Mercado Pago. Nunca use `NEXT_PUBLIC_` para esse valor.                                           |
| `MERCADOPAGO_ENV`            | `production` no lançamento; `test` para a conta de testes. O padrão é `production`.                                                 |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta gerada na configuração de Webhooks da aplicação Mercado Pago. Necessária para receber notificações autenticadas. |
| `NEXT_PUBLIC_SITE_URL`       | Opcional: a mesma origem de `APP_URL` para os metadados sociais.                                                                    |

O Checkout Pro usa o Access Token no servidor; não precisa de Public Key no navegador. A URL da loja também precisa estar configurada para os retornos e a proteção de origem. O checkout precisa do token, da origem e do banco configurados. Sem a assinatura adicional, o endpoint de Webhooks fica bloqueado. Configure-a para o lançamento.

Coloque os valores somente no painel da Hostinger. Para desenvolvimento local, copie `.env.example` para `.env.local`, arquivo ignorado pelo Git. Não envie tokens por chat, não os inclua no código e não faça commit deles. Depois de mudar variáveis, faça um novo deploy/reinício da aplicação.

## 3. Preparar banco e administração

No hPanel, crie um banco MySQL dedicado e um usuário com acesso apenas a esse banco. Configure `DATABASE_URL=mysql://USUARIO:SENHA@127.0.0.1:3306/BANCO` nas variáveis da aplicação. Codifique caracteres especiais de usuário/senha na URL; não use aspas como parte do valor. O banco local da Hostinger usa `127.0.0.1`. Conexões remotas exigem TLS com certificado válido.

No terminal da aplicação, execute `npm run db:migrate`. O comando cria as tabelas `mn_` sem apagar dados anteriores. Faça backup do banco no painel e confira a restauração antes da operação. Em produção, mantenha as permissões do usuário limitadas ao banco da loja.

Se não tiver terminal, siga [Preparar o banco pelo phpMyAdmin](BANCO-SEM-TERMINAL.md) e importe [mundo-natural-schema.sql](../database/mundo-natural-schema.sql) no mesmo banco usado pela aplicação. O SQL cria as mesmas tabelas do comando de migração e pode ser aplicado mantendo os registros existentes.

No seu terminal, execute `npm run admin:setup`. Digite uma senha forte de pelo menos 14 caracteres; ela não é exibida nem salva em texto puro. O script gera `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` e `ADMIN_TOTP_SECRET`. Copie os valores para o painel de variáveis da Hostinger e cadastre a chave TOTP no autenticador (6 dígitos, 30 segundos). Guarde uma cópia de recuperação em local seguro. Não envie os valores por chat.

Depois de fazer redeploy, acesse `/admin`. O usuário padrão é `admin`. O painel permite editar produtos e custos, disponibilizar/indisponibilizar itens, associar fotos, acompanhar pedidos, registrar despesas, exportar os últimos pedidos e conferir o histórico de alterações. As fotos JPEG/PNG/WebP são normalizadas para WebP, com metadados removidos, e guardadas no banco. Não são geradas novas imagens por IA.

## 4. Configurar o Mercado Pago

Na conta da loja, crie/selecione a aplicação de **Checkout Pro via Orders API**, obtenha o Access Token adequado e confirme os meios de pagamento disponíveis. Para oferecer Pix, a conta precisa estar habilitada e ter sua chave Pix cadastrada.

Em **Webhooks**, configure:

- URL: `https://SEU-DOMINIO/api/mercadopago/webhook`
- Evento de order/Orders do Checkout Pro, conforme o painel da aplicação.
- Ambiente de produção para a loja; ambiente de testes para homologação.
- Copie a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET` na Hostinger e faça redeploy.

O código verifica a assinatura HMAC, a idade da notificação, o ID do evento e o ambiente. Depois consulta a order na API, verifica referência assinada, moeda e valor. Notificações sem assinatura válida não são aceitas. O corpo da notificação e o parâmetro `status` do retorno do navegador não são comprovantes de pagamento.

## 5. Conferir antes de abrir as vendas

```sh
npm ci
npm test
npm run typecheck
npm run check:launch
npm run build
npm run test:production
```

`check:launch` valida configuração e catálogo sem imprimir tokens nem criar transações. Ele sinaliza como pendente a ausência da assinatura de Webhooks. `test:production` usa HTTP local, desativa credenciais no processo de teste e não realiza cobranças. A inspeção visual/interativa em navegador é uma verificação separada.

Faça uma compra com a conta e os meios de teste indicados pelo Mercado Pago. A Orders API não usa um token `TEST-` do fluxo antigo: siga a documentação para credenciais de vendedor de teste e use `MERCADOPAGO_ENV=test`. O site identifica o modo de teste e não deve ser divulgado assim. Para produção, use a conta da loja, `MERCADOPAGO_ENV=production` e confirme:

1. HTTPS válido e redirecionamento para a origem principal.
2. Valor e porção do produto conferidos no carrinho e no Mercado Pago.
3. Pix e cartão disponíveis na conta; situações de pendência, recusa e aprovação verificadas.
4. Página de retorno conferindo o estado real do pagamento, inclusive ao recarregar.
5. Notificação autenticada recebida no painel do Mercado Pago e log de recebimento na Hostinger.
6. Retirada combinada com a equipe após confirmar o crédito na conta. Não libere produto com base apenas em uma tela ou comprovante enviado pelo cliente.

Nenhuma transação real foi validada durante a implementação, porque as credenciais da loja não foram fornecidas. A integração foi validada com contratos simulados e testes de segurança; a homologação com a conta da loja é necessária antes da abertura.

## 6. Operação da loja

O registro financeiro do provedor fica no Mercado Pago; a loja mantém no MySQL os pedidos, itens, nome/e-mail, custos, taxas conciliadas, fotos, despesas e histórico administrativo. O painel permite conferir os produtos e acompanhar a preparação e o recebimento; antes de alterar a etapa, consulta novamente o pagamento. Endereço, telefone e observações da entrega ficam restritos à equipe autenticada. Cancelamentos e reembolsos financeiros continuam na conta Mercado Pago, protegida com autenticação em duas etapas.

O pagamento online aceita **retirada sem frete** e **entrega com frete calculado**. Execute novamente `npm run db:migrate` na atualização e configure CEP de origem e tarifas em `/admin` → **Frete e entregas**. A distância é uma estimativa em linha reta entre CEPs, sem chave de mapas paga; a entrega inicia desativada. Veja [pedidos, avisos sonoros e frete](OPERACAO-PEDIDOS-FRETE.md). Não há integração automática de estoque ou reserva com o PDV; confirme a disponibilidade e atualize o catálogo/indisponíveis para evitar vender um item esgotado.

Os preços do catálogo foram confirmados pelo responsável pela loja nesta sessão. Para atualizar valores, custos, disponibilidade e fotos, use `/admin`. As alterações ficam no MySQL e são usadas no catálogo e no cálculo do servidor. `lib/catalog.json` é a base inicial; `lib/sales-policy.json` define os limites gerais. Os identificadores de produto devem permanecer estáveis.

Para itens a granel, informe **preço e custo por 100 g no painel**. O comprador escolhe de 100 em 100 g, até 5.000 g por porção. A conversão da base importada por kg é automática; não divida os dados do catálogo ou do banco novamente. Itens embalados usam preço por unidade. Carrinhos antigos com porções incompatíveis, como 250 g, pedem uma nova escolha em vez de mudar o peso silenciosamente.

Os cookies de pedido permitem consultar até cinco pedidos recentes por sete dias no mesmo navegador. Se o cliente trocar de navegador, limpar cookies ou se a loja trocar o token/domínio, o atendimento deverá localizar a compra no Mercado Pago. A rotação do token não remove os registros financeiros do provedor.

Mantenha o repositório, a conta GitHub, a Hostinger e o Mercado Pago com autenticação em duas etapas; proteja a branch principal, revise atualizações do Dependabot e habilite a proteção de tráfego/WAF disponível no plano. Os limites do aplicativo são por processo e complementam a proteção da hospedagem; não substituem proteção contra ataques distribuídos.

## Como interpretar o lucro

O painel apresenta uma estimativa gerencial: recebimentos menos reembolsos, custos dos itens, taxas conciliadas e despesas cadastradas. Custos são fotografados por pedido; mudar o custo atual do produto não altera pedidos anteriores. Quando faltar custo, taxa ou informação de reembolso, a estimativa fica indisponível. O botão de aplicar custos atuais preenche somente custos ausentes, mediante sua confirmação, e registra a ação. Não duplique taxas já conciliadas ao cadastrar despesas.

A loja não recebe um lucro fictício ou calculado por margem presumida. Os números abrangem pedidos registrados por esta integração e não representam toda a contabilidade da conta Mercado Pago. Estoque e emissão fiscal não estão sincronizados ao PDV.

## Fontes oficiais

- [Hostinger: conectar MySQL ao Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)

- [Hostinger: opções de hospedagem Node.js](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)
- [Hostinger: adicionar uma aplicação Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger: configurar variáveis de ambiente](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)
- [Mercado Pago: criar uma order do Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order)
- [Mercado Pago: notificações autenticadas](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications)
- [Mercado Pago: estados da order](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/payment-management/status/order-status)
