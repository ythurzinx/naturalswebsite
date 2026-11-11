# Revisão de celular, administração e segurança

Esta atualização parte da versão `4dd0c542272149c2c1b53ce462cf77b8a19e391b`. A revisão é manual, acompanhada de testes reproduzíveis; não é uma certificação ou varredura automatizada do Codex Security, cujo fluxo não estava disponível no ambiente.

## Comportamento conferido

- Navegação inferior e resumo de compra em telas pequenas; controles de peso de 100 em 100 g com alvos de toque de pelo menos 44 pixels.
- Seleção de peso/porções, edição no carrinho e preservação do carrinho após falha de pagamento. Uma tentativa com clique duplo produz somente uma solicitação de checkout.
- Administração em cartões no celular, filtros de produtos/pedidos, disponibilidade em lote e consulta de pagamento por pedido.
- Saúde do catálogo e produtos mais vendidos derivados de registros reais. Lucro continua indisponível quando faltam custos, taxas ou dados de reembolso.

## Segurança das novas rotas

`PATCH /api/admin/products/availability` e `POST /api/admin/orders/:id/sync` passam pela mesma autorização, validação de origem e CSRF das demais mutações. A seleção em lote tem limite de 50 IDs distintos e rejeita campos extras, tipos incorretos e identificadores malformados. A persistência usa parâmetros preparados e transação; uma seleção desconhecida não produz alteração parcial. Preços, custos e fotos não são sobrescritos pela mudança de disponibilidade.

A consulta de pagamento por pedido exige ID válido e registro existente, aplica limite no banco e consulta o Mercado Pago pelo cliente de destino fixo. Não há cobrança, reembolso ou autorização manual de pagamento nessa rota. Retirada continua condicionada a uma nova consulta de pagamento integral aprovado.

Os testes de banco exercitam os novos controles com sessão verdadeira: origem e CSRF forjados são recusados, mudanças autorizadas persistem e a 16ª consulta de pagamento no mesmo minuto é bloqueada. A suíte também cobre snapshots de custos, isolamento de custos do catálogo público, limites concorrentes de login, reutilização de TOTP, cookies adulterados/duplicados e preços alterados antes do checkout.

## Como repetir

Execute `npm run verify`, `npm run test:database` com um banco local descartável `mn_test` e `npm run test:browser` após instalar o Chromium pelo Playwright. A CI configura o banco e o navegador. Capturas e traces locais ficam em `test-results/`, ignorados pelo Git. Veja [CONTRIBUTING.md](../CONTRIBUTING.md) e [o roteiro de deploy](DEPLOY.md).

O navegador usa duas telas de celular (360 × 800 e 390 × 844) e uma de computador (1280 × 900). Dados administrativos e falhas de pagamento são fixtures locais; as APIs reais e a persistência são verificadas na suíte com MariaDB. Nenhuma credencial da loja é necessária ou utilizada nesses testes.

O relatório final da CI registra a execução do commit proposto. A auditoria de dependências identifica avisos conhecidos, sem provar ausência de vulnerabilidades. A infraestrutura da Hostinger, o certificado do domínio e transações Pix/cartão da conta da loja exigem homologação na implantação final. Não foram executadas cobranças reais ou testes contra contas de terceiros.
