# Mundo Natural

Loja em Next.js com catálogo de referência, busca sem distinção de acentos, filtros, favoritos, carrinho por peso e atendimento pelo WhatsApp. A página inicial, as páginas de informação e o checkout compartilham a mesma identidade visual.

## Desenvolvimento e validação

Requer Node.js 22 e npm.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

O workflow `.github/workflows/verify.yml` executa testes, TypeScript e build em pull requests e na branch principal. O lockfile npm fixa as dependências utilizadas.

## Dados da loja

- `lib/store.ts`: nome, endereço, WhatsApp e Instagram. Foram preservados os dados textuais do repositório. A foto antiga da fachada apresenta outros dados de contato; confirme os dados atuais antes de divulgar a loja.
- `lib/catalog.json`: 619 produtos importados da planilha já referenciada pelo projeto. O importador corrigiu os preços em centavos e as colunas com vírgulas entre aspas. Não há integração de estoque em tempo real. O estoque e as datas de validade antigos não são apresentados como atuais. **Os valores são históricos e precisam ser confirmados pela loja.**
- `lib/products.ts`: categorias, pesquisa, seleção da vitrine e imagens ilustrativas por grupo.
- `public/images/mundo-natural-logo.png`: aplicação da identidade visual em fundo transparente; a versão foi preparada a partir da referência visual e deve ser substituída pelo arquivo original de marca para máxima fidelidade.
- `public/images/natural-bowls.png`: fotografia ilustrativa gerada para categorias e produtos. Não representa embalagem, fabricante ou lote.

Não há pagamento eletrônico ou criação de pedidos no servidor. O cliente abre o WhatsApp com um resumo, revisa e envia a mensagem; a loja confirma preço, disponibilidade, frete e pagamento. O carrinho não é apagado ao abrir a conversa. O site não consulta serviços externos de frete nem inventa distâncias, tarifas ou prazos.

## Privacidade e segurança

- Armazenamento essencial: somente IDs, quantidades e pesos do carrinho, com validade de até 30 dias, e a escolha de privacidade por até 180 dias.
- Favoritos entre visitas exigem consentimento opcional. Recusar ou revogar apaga os favoritos salvos. Sem consentimento, eles funcionam apenas em memória.
- Os dados digitados na finalização ficam em memória até a navegação ou fechamento da página; a mensagem é aberta no WhatsApp por ação do visitante.
- Nenhum tracker ou analytics é incluído pelo código da loja. A infraestrutura de hospedagem pode ter processamento técnico próprio.
- O carrinho é validado ao ser recuperado, usa os produtos e preços do catálogo e não confia em objetos/preços salvos no navegador.
- A rota `/admin` retorna a página de erro: a senha exposta e o falso painel administrativo foram removidos. Não existe administração autenticada ou banco de pedidos nesta versão; esses recursos precisam de identidade e autorização no servidor antes de serem reintroduzidos.
- Cabeçalhos para CSP, proteção contra iframes, MIME sniffing, controle de permissões e HTTPS são configurados em `security-headers.mjs` e aplicados pelo Next.js em produção.
- A CSP permite scripts e estilos inline necessários à exportação estática do Next.js. Ela bloqueia fontes de script externas, objetos e iframes; não substitui validação e autorização no servidor.
- As antigas personalizações e dados locais do navegador não são usados como catálogo ou autoridade de preço. Nenhum segredo de integração deve usar o prefixo `NEXT_PUBLIC_`.

## Publicação

A hospedagem padrão usa `npm run build` e `npm start`, incluindo os cabeçalhos de segurança definidos no Next.js. Configure `NEXT_PUBLIC_SITE_URL` com a origem HTTPS pública do seu domínio para os metadados sociais. O valor padrão aponta para a prévia criada durante esta atualização.

Para exportação estática:

```sh
node scripts/prepare-static.mjs
npm run build:static
```

O resultado fica em `out/`. O arquivo `_headers` é disponibilizado para provedores compatíveis; em outros provedores, configure os mesmos cabeçalhos no painel/CDN. Confirme os cabeçalhos efetivamente servidos antes de publicar em outro host. O repositório de origem não depende de uma conta Sites para funcionar.

O ambiente desta implementação permitiu validar build, tipos, lógica de carrinho, consentimento e dependências. A inspeção visual/interativa em navegador ficou pendente porque a ferramenta de navegador do ambiente não foi disponibilizada.
