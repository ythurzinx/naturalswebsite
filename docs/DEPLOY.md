# Colocar a loja no ar

O código de produção fica na branch `main`. O fluxo completo e as fontes oficiais estão no [guia da Hostinger](HOSTINGER.md). Este roteiro reúne a ordem de configuração.

## 1. Aplicação e domínio

Crie uma aplicação **Node.js / Next.js** na Hostinger, conectada a este GitHub. Use Node.js 22, instalação `npm ci`, build `npm run build` e inicialização `npm start`. A aplicação utiliza a porta da plataforma. Não exporte arquivos estáticos para `public_html`.

Associe o domínio, ative HTTPS e redirecione `www`/sem `www` para uma única origem principal.

## 2. Banco e variáveis privadas

Crie um MySQL dedicado. Configure as variáveis no painel da aplicação, usando [.env.example](../.env.example) como referência:

| Variável | Configuração |
| --- | --- |
| `APP_URL` | Origem HTTPS exata da loja, sem caminho. |
| `DATABASE_URL` | URL do MySQL dedicado; codifique caracteres especiais da senha. O banco local da Hostinger usa `127.0.0.1`. |
| `MERCADOPAGO_ACCESS_TOKEN` | Token privado da aplicação da loja; nunca use `NEXT_PUBLIC_` para segredos. |
| `MERCADOPAGO_ENV` | `production` para venda real; `test` para homologação. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta dos Webhooks da aplicação. |
| `ADMIN_USERNAME` | Usuário administrativo; padrão `admin`. |
| `ADMIN_PASSWORD_HASH` | Gerado pelo comando de preparação abaixo. |
| `ADMIN_SESSION_SECRET` | Gerado pelo comando de preparação abaixo. |
| `ADMIN_TOTP_SECRET` | Chave do autenticador, gerada pelo comando abaixo. |
| `NEXT_PUBLIC_SITE_URL` | Opcional: mesma origem de `APP_URL`, para metadados sociais. |

No terminal com as variáveis do banco disponíveis, execute `npm run db:migrate`. A migração cria as tabelas sem apagar dados existentes. Mantenha backup do banco e valide a restauração; fotos de produtos e registros administrativos também ficam nele.

Execute `npm run admin:setup` no seu terminal. O comando pede uma senha forte, gera os três segredos administrativos e a chave TOTP. Salve os valores no painel da Hostinger e registre a chave no autenticador. Não compartilhe os valores por chat ou faça commit deles. Reinicie/republique a aplicação depois de mudar variáveis.

## 3. Pagamento e Webhooks

Configure o evento de Orders do Checkout Pro na aplicação Mercado Pago com a URL `https://SEU-DOMINIO/api/mercadopago/webhook`. Copie a assinatura secreta para a Hostinger. Confirme a habilitação da conta para Pix e cartão e o cadastro da chave Pix.

A integração recebe pagamento de **retirada sem frete**. Entregas passam por orçamento no atendimento. A disponibilidade é administrada pelo painel, sem sincronização automática com o estoque do PDV. Reembolsos financeiros são feitos no Mercado Pago.

## 4. Conferência técnica

No repositório, rode `npm run verify`. Para testar telas e interação, rode `npx playwright install chromium` e `npm run test:browser`; a CI já prepara o navegador e executa esses testes. Os testes usam dados isolados e não fazem cobranças reais.

No servidor configurado, rode `npm run check:launch`. Esse comando valida HTTPS configurado, modo de produção, segredos, autenticador e tabelas do banco sem imprimir credenciais ou criar uma cobrança. `/api/health` verifica o processo HTTP; não comprova a conectividade com o banco ou a aprovação de um pagamento.

## 5. Conferência da loja

- Confira o WhatsApp em `lib/store.ts`: o número herdado do projeto é `(15) 3191-7309` e a foto antiga da fachada apresenta outro número. Confirme o contato antes da divulgação.
- Confira preços e disponibilidade no `/admin`. A granel usa **preço e custo por 100 g**; embalados usam unidade. O cálculo do servidor confere o catálogo atual antes de abrir o Mercado Pago.
- Cadastre custos para obter lucro estimado. A análise fica pendente quando faltam custos, taxas ou informação de reembolso.
- Use os filtros de produtos sem foto/sem custo e a disponibilidade em lote para preparar o catálogo. Fotos existentes continuam ilustrativas até a associação de fotos próprias.
- No celular, confira busca, peso, carrinho, preenchimento do checkout e navegação inferior. Confira também um aparelho real na hospedagem final.
- Homologue Pix/cartão, recusa, pendência, retorno e Webhook com a conta de teste indicada pelo Mercado Pago. Depois selecione as credenciais e o modo de produção. Não entregue produtos com base apenas no retorno do navegador ou em um comprovante enviado pelo cliente.

## Operação e recuperação

O painel permite buscar e filtrar pedidos, exportar os resultados visíveis e consultar novamente o pagamento de um pedido. Essa consulta não cobra, cancela ou reembolsa. A liberação da retirada exige outra consulta de pagamento integral aprovado.

Mantenha GitHub, Hostinger, autenticador administrativo e Mercado Pago protegidos. Revise as atualizações do Dependabot. Para retornar uma versão de código, use o histórico de deploy da hospedagem; isso não desfaz dados, pagamentos ou alterações no banco. Não execute testes de banco na produção: a suíte exige um banco local descartável chamado `mn_test`.
