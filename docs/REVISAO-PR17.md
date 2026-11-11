# Revisão de segurança — venda por 100 g

Revisão manual do PR #17 em 11/11/2026, acompanhada de testes locais de segurança e integração. Base: `c33427a8682e482701e6fa2b28f37c0f6e348a4a`. Implementação examinada: `2d1472adf805606eb69ebfca6d654622aae6e376`. Os acréscimos posteriores desta revisão são testes de regressão e este registro; não alteram a aplicação.

Não foi identificada vulnerabilidade explorável introduzida pela alteração no escopo examinado. Isso não significa ausência de vulnerabilidades em toda a aplicação ou proteção absoluta.

## Escopo e limites de confiança

Foram examinados os 26 arquivos alterados/adicionados do PR e os controles de autenticação, HTTP, persistência, sessões, cliente Mercado Pago e Webhooks necessários para seguir os caminhos afetados. Não há arquivos excluídos no PR.

O navegador e o carrinho persistido são entradas não confiáveis. O checkout deve usar preço e disponibilidade atuais do servidor; a edição de preços exige sessão administrativa e CSRF. O banco guarda a base original por kg, enquanto a unidade de venda é 100 g. Dados de pagamento são verificados no Mercado Pago.

| Área | Verificação e resultado |
| --- | --- |
| Preços e pesos | Mesma regra em centavos no anúncio, carrinho e servidor. Pesos de 100 a 5.000 g em múltiplos de 100; pesos fracionados, negativos, strings e 250 g recusados. Totais adulterados não chegam ao provedor. |
| Preço alterado no painel | Teste em MariaDB altera o preço entre a montagem do carrinho e o checkout. O servidor responde `PRICE_CHANGED` sem solicitar uma cobrança. |
| Sessões e pedidos | Origem, CSRF, assinatura, propósito, expiração e propriedade do pedido verificados. Cookies duplicados de checkout/pedido são recusados antes de consultar o provedor. |
| Administração | Conversão explícita `priceUnit: "100g"`, limites após conversão e rejeição de unidades incompatíveis. Acesso anônimo, CSRF inválido e reutilização de TOTP bloqueados. |
| Persistência | Consultas parametrizadas. Custos excluídos do catálogo público. Testes preservam custos históricos e impedem que conciliação antiga sobrescreva reembolso mais recente. |
| Catálogo | Conferência dos 619 registros: preços de origem e produtos embalados preservados; apenas o rótulo dos 306 itens a granel muda. |
| Interface e armazenamento | Textos renderizados pelo React, URLs de fotos limitadas ao endpoint da loja, cálculo compartilhado e carrinho antigo incompatível removido com aviso para nova seleção. |
| Uploads e cabeçalhos | Testes de rejeição de SVG, limite de tamanho e remoção de metadados. Teste HTTP do build verifica CSP com nonce novo nos scripts reais, bloqueio de enquadramento e respostas privadas sem cache. |
| Provedor e Webhooks | Testes com respostas simuladas cobrem valores/moedas divergentes, redirecionamentos, assinatura falsa/antiga e falhas sem exposição de credenciais. |

## Evidência reproduzível

```sh
npm test
INTEGRATION_DATABASE_URL=mysql://USUARIO:SENHA@127.0.0.1:3307/mn_test npm run test:database
npm run typecheck
npm audit --omit=dev --audit-level=high
npm run check:launch -- --code-only
npm run build
npm run test:production
```

Os testes de banco exigem um MariaDB descartável local chamado `mn_test` e recusam destinos de produção. A suíte inclui 42 testes de aplicação/contratos e 9 testes com banco. A auditoria de dependências de produção não reportou vulnerabilidades conhecidas na execução desta revisão. O resultado da CI do PR fornece a validação do commit final.

## Verificações externas pendentes

O fluxo automatizado do Codex Security não pôde ser executado: o recurso de preflight e as ferramentas exigidas não estavam disponíveis no ambiente. Este documento não é relatório automatizado nem teste externo de invasão.

Não foram usadas credenciais da loja, criadas cobranças reais ou examinadas a configuração, o certificado HTTPS e as proteções de tráfego da Hostinger. A homologação de Pix/cartão e Webhooks com a conta e o domínio finais continua necessária. Os limites por processo da aplicação devem ser complementados pela proteção da hospedagem. O estoque do PDV não é reservado automaticamente.
