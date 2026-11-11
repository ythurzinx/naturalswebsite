# Desenvolvimento e verificação

Use Node.js 22 (`.nvmrc`) e `npm ci`, com o lockfile deste repositório. Segredos ficam em variáveis de ambiente ou `.env.local`, ignorado pelo Git. Não há credenciais de produção no projeto.

- `npm run dev`: servidor de desenvolvimento.
- `npm run verify`: testes de aplicação, tipos, catálogo, auditoria de dependências de produção, build e testes HTTP do servidor compilado.
- `npm run test:database`: operações e controles de acesso em MySQL/MariaDB local descartável. Exige `INTEGRATION_DATABASE_URL` apontando para `127.0.0.1`/`localhost` e banco `mn_test`.
- `npx playwright install chromium` e `npm run test:browser`: fluxos em Chromium com telas de 360, 390 e 1280 pixels. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE` somente para um Chromium já instalado em seu ambiente. O teste inicia e encerra um servidor local exclusivo, com credenciais privadas desabilitadas.
- `npm run check:launch`: verificação da configuração real de implantação, sem cobrança.
- `npm run assets:optimize`: recria as versões otimizadas das imagens existentes e o ícone. Os arquivos derivados são versionados; o build não precisa gerar imagens.

Os testes de navegador usam fixtures isoladas para a administração e para simular falha do provedor; a proteção das APIs, os dados persistidos e as regras de pagamento são exercitados separadamente nas suítes de servidor e banco. Capturas e traces ficam em `test-results/`, ignorado pelo Git. Um teste de navegador aprovado não substitui a homologação com a conta Mercado Pago e o domínio da loja.

O fluxo financeiro deve continuar recalculando o catálogo atual no servidor. Não confie em preços, custos, identificadores, cookies, cabeçalhos ou estados de pagamento enviados pelo cliente. Mantenha autorização e CSRF antes das mutações administrativas, limites de lote e auditoria. Preços a granel usam a unidade de venda de 100 g, preservando a base interna por kg e os snapshots de custos históricos.

A organização principal é `app/` para páginas e rotas, `components/` para interface, `lib/server/` para credenciais e regras do servidor, `tests/` para verificações e `docs/` para operação, implantação e evidências de segurança.
