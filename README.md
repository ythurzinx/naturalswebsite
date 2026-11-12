# Mundo Natural

**Deploy:** siga [Colocar a loja no ar](docs/DEPLOY.md). O repositório está preparado para **Hostinger Node.js 22 + MySQL** pela branch `main`.

Loja Next.js com **308 produtos a granel na vitrine**, 308 imagens ilustrativas de IA padronizadas, carrosséis de ofertas e três combos editáveis, busca, categorias, favoritos e **Mercado Pago Checkout Pro via Orders API para Pix e cartão**. Os 619 registros importados permanecem no painel; produtos embalados e embalagens de uso interno ficam fora da vitrine até uma edição e ativação explícita pelo administrador.

Os produtos a granel exibem preço por **100 g**. A seleção começa em 100 g e avança de 100 em 100 g, até 5.000 g por porção. Os preços de origem por kg foram preservados. Sete registros com pesos em kg foram corrigidos para granel, incluindo a maca peruana. Produtos embalados adicionados ou reativados pelo administrador continuam por unidade. O valor de 100 g é arredondado em centavos antes de multiplicar pelos blocos e pelas porções, com a mesma regra no catálogo, carrinho e pagamento.

Veja [Ofertas, combos e fotos](docs/OFERTAS-COMBOS-FOTOS.md) e [Resolver MPV08](docs/DIAGNOSTICO-CHECKOUT.md). Os combos começam **sem desconto automático**; a loja define os percentuais. A entrega usa BrasilAPI e distância estimada entre CEPs, configurável em **Admin → Frete e entregas**. As novas opções usam `mn_settings` e não exigem outra importação SQL.

## Rodar e verificar

Node.js 22 e npm:

```sh
npm ci
cp .env.example .env.local
npm run dev
npm test
npm run typecheck
npm run check:launch
npm run build
npm run test:production
npm start
```

Preencha `.env.local` apenas na sua máquina. Na hospedagem, use o painel de variáveis de ambiente; os arquivos reais de ambiente são ignorados pelo Git. A loja pode ser construída sem credenciais e, nessa situação, mantém pagamentos online desabilitados.

## Configuração para publicar

Leia [o guia da Hostinger](docs/HOSTINGER.md). Use uma aplicação Node.js/Next.js, nunca exportação estática.

- `APP_URL`: origem HTTPS principal da loja.
- `MERCADOPAGO_ACCESS_TOKEN`: credencial privada do servidor.
- `MERCADOPAGO_WEBHOOK_SECRET`: assinatura para receber notificações autenticadas.
- `MERCADOPAGO_ENV`: `production` ou `test` (padrão: `production`).

O checkout hospedado não exige Public Key ou dados de cartão no site. Com o token, a origem e o banco configurados, cria pedidos e consulta o resultado; configure também o segredo de Webhooks para o lançamento. O estado financeiro é verificado no Mercado Pago; os registros da loja e o painel ficam no MySQL. A interface nunca confirma um pagamento apenas porque o comprador retornou ao site.

A versão online recebe pagamentos de compras com retirada sem frete ou entrega com frete calculado entre CEPs. Configure origem e tarifas em `/admin` → **Frete e entregas**; a entrega fica desativada até essa configuração. O painel acompanha pedidos com aviso sonoro opcional, checklist de embalagem, etapas de preparação, impressão de resumo e notas internas. Também permite editar produtos/fotos/custos, registrar despesas, estimar lucro com dados completos e exportar pedidos. Veja o [guia de operação](docs/OPERACAO-PEDIDOS-FRETE.md). Reembolsos financeiros ficam na conta Mercado Pago. Não há baixa automática de estoque no PDV.

O pedido exibe nome, e-mail, telefone e histórico de avisos do cliente. A previsão de chegada (1–240 minutos), informada pela equipe, é obrigatória antes da saída para entrega. Em **Mensagens aos clientes**, configure a integração transacional da Brevo para pagamento aprovado, pedido separado e saída com previsão. WhatsApp exige consentimento opcional por pedido; os canais começam desligados. Veja [ativação dos avisos](docs/NOTIFICACOES.md), incluindo credenciais, remetentes, modelos aprovados e agendador.

## Administração e persistência

No celular, a loja oferece navegação inferior, controles de peso com passos de 100 g e ação fixa com o total no carrinho e checkout. O painel tem filtros de produtos e pedidos, seleção de até 50 produtos para alterar disponibilidade, consulta individual de pagamento, saúde do catálogo e produtos mais vendidos com base em pedidos pagos.

Crie um MySQL dedicado na Hostinger, configure `DATABASE_URL` e execute `npm run db:migrate`. O catálogo inicial é combinado com as alterações persistentes do painel. Fotos são normalizadas e armazenadas no banco, sem depender de arquivos locais que poderiam se perder no redeploy.

**Hostinger sem terminal:** use o [guia para importar as tabelas pelo phpMyAdmin](docs/BANCO-SEM-TERMINAL.md) com [database/mundo-natural-schema.sql](database/mundo-natural-schema.sql). O arquivo é gerado da mesma estrutura do servidor e acrescenta tabelas ausentes mantendo os dados existentes.

Execute `npm run admin:setup` no seu terminal para gerar o hash da senha, o segredo de sessão e a chave do autenticador. Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` e `ADMIN_TOTP_SECRET` no painel da Hostinger. Nunca faça commit de valores reais. O acesso usa sessão protegida no servidor, limite de tentativas, CSRF e, com a chave configurada, TOTP com bloqueio de reutilização.

O lucro estimado exige custos e taxas conhecidos. Custos ficam registrados por pedido; preencher custos históricos ausentes exige uma ação explícita do administrador. Nenhuma margem é inventada.

O painel exibe e recebe preço/custo a granel por 100 g. O catálogo importado e as colunas existentes do MySQL mantêm a base interna por kg para compatibilidade; `lib/pricing.mjs` converte a unidade de venda. O editor envia `priceUnit: "100g"`, convertido para a base interna no servidor. Não divida manualmente os valores armazenados por dez. Pedidos e custos históricos permanecem registrados pelo valor da porção original.

## Dados e operação

- `lib/store.ts`: contatos e endereço. Contato oficial: **(11) 5199-3525** (`551151993525`).
- `lib/catalog.json`: produtos e preços em reais, extraídos do CSV referenciado pela loja. O responsável confirmou nesta sessão que os preços estão corretos para venda.
- `lib/sales-policy.json`: confirmação de preços, habilitação de retirada, produtos indisponíveis e limites de venda. Os campos antigos de quantidade/validade do catálogo não são usados como controle de estoque atual.
- `lib/server/`: validações, cookies/sessões, cliente Mercado Pago, idempotência e verificações de pagamento/Webhooks.
- `proxy.ts` e `security-headers.mjs`: CSP por resposta e cabeçalhos de segurança.
- `docs/SEGURANCA.md`: revisão manual, controles, evidências e limites da validação.

Os 308 produtos a granel têm ilustrações próprias geradas por IA, com fundo claro, tigela branca e iluminação uniforme. A origem e a integridade de cada arquivo estão registradas no projeto. Veja [imagens de IA](docs/IMAGENS-IA.md). O administrador pode substituir cada ilustração por uma foto real no painel.

As imagens principais são servidas em versões WebP mais leves: aproximadamente 90% menos bytes nos três arquivos principais, preservando os originais no repositório. `npm run assets:optimize` recria essas versões e o ícone pequeno a partir dos arquivos existentes, sem geração por IA.

A imagem transparente da logo foi preparada da referência visual; o arquivo original de marca oferece máxima fidelidade. As fotos de ingredientes são ilustrativas.

## Validação

`npm run test:database` testa migração, persistência, custos, conciliação e autenticação em um banco MariaDB/MySQL descartável. Ele exige `INTEGRATION_DATABASE_URL` apontando para um banco local chamado `mn_test` e rejeita destinos de produção.

`npm test` cobre carrinho, consentimento, criação/verificação de pedidos, manipulação de valores, CSRF, autorização de leitura, idempotência e Webhooks. `npm run test:production` verifica o Next.js compilado por HTTP sem credenciais e sem cobranças. A CI executa esses controles, tipos, auditoria de dependências e build. O Dependabot propõe atualizações; elas não são mescladas automaticamente.

`npm run verify` reúne os controles do projeto. `npm run test:browser` exercita o Chromium em duas telas de celular e uma de computador, incluindo seleção por peso, carrinho, falha de pagamento e administração com dados de teste isolados. Veja [CONTRIBUTING.md](CONTRIBUTING.md).

Os testes usam fixtures e não substituem a homologação com uma conta de teste do Mercado Pago. Confira HTTPS, Pix/cartão, retorno e Webhooks na conta e no domínio finais antes de abrir as vendas. O fluxo automatizado do Codex Security não estava disponível; a revisão de código é manual e acompanhada dos testes documentados.
