# Cupons e reajuste da inauguração

## Reajuste de preços

Todos os 619 produtos do catálogo subiram **11,12%**, arredondando para cima no centavo: o novo preço é o menor valor que, com 10% de desconto, volta ao preço anterior. A conta é feita no preço exibido (por 100 g nos itens a granel e por unidade nos demais).

| Antes | Depois | Com cupom de 10% |
|---|---|---|
| R$ 8,00 / 100 g | R$ 8,89 / 100 g | R$ 8,00 / 100 g |
| R$ 12,00 / 100 g | R$ 13,34 / 100 g | R$ 12,00 / 100 g |
| R$ 1,00 / 100 g | R$ 1,12 / 100 g | R$ 1,00 / 100 g |
| R$ 99,00 / un. | R$ 110,00 / un. | R$ 99,00 / un. |

Com um cupom de 10%, o cliente paga **exatamente** o preço anterior em qualquer peso (o desconto é calculado a cada 100 g ou unidade, arredondado a favor do cliente). Os combos acompanham automaticamente, porque somam os preços dos ingredientes. Pedidos já feitos mantêm os valores da compra.

Produtos já editados no painel guardam o preço no MySQL, que tem prioridade sobre o catálogo do código. Depois da implantação, importe no phpMyAdmin [`database/reajuste-precos-inauguracao.sql`](../database/reajuste-precos-inauguracao.sql), de preferência antes de editar produtos:

1. Faça um backup do banco.
2. No phpMyAdmin, selecione o banco usado em `DATABASE_URL` → **Importar** → envie o arquivo → **Executar**.

O arquivo só altera produtos que ainda estão com o preço anterior ao reajuste: importar de novo não aplica o aumento duas vezes, e preços já mudados no painel ficam como estão. Produtos criados pelo próprio painel (`custom-...`) não estão no arquivo; ajuste-os no painel. Cada alteração aparece em **Atividade** como `product.price_raise`.

Para voltar aos preços anteriores depois da inauguração, é preciso um novo reajuste no código e no banco; os cupons não alteram os preços cadastrados.

## Cupons

Em **Admin → Cupons**, a equipe cria, desativa, reativa e exclui cupons. Cada cupom tem:

- **Código**: 3 a 24 letras sem acento, números, hífen ou sublinhado. O cliente pode digitar em minúsculas.
- **Desconto**: percentual inteiro de 1% a 80%.
- **Início e fim** (opcionais): fora do período o cupom não vale.
- **Compra mínima em produtos** (opcional): o frete não conta.
- **Limite total de usos** (opcional) e **um uso por e-mail** (opcional).
- **Anotação interna** (opcional), visível só no painel.

Regras na compra:

- O cupom é digitado na finalização, no pagamento online (Pix ou cartão). No atendimento pelo WhatsApp, o código vai na mensagem para a equipe conferir.
- O desconto vale para produtos e combos, **nunca para o frete**.
- Não se soma a uma oferta ou combo com desconto maior: o item fica com o menor preço entre a oferta e o cupom.
- O servidor confere o cupom de novo antes de criar o pagamento e recalcula todos os valores. O Mercado Pago recebe os preços já com desconto.
- Um uso conta quando o pagamento é aprovado ou enquanto ele ainda pode ser aprovado (até 24 horas). Tentativas que não chegaram ao Mercado Pago liberam o uso em 30 minutos. Pagamentos recusados, cancelados ou reembolsados não contam.
- Os limites são verificados com bloqueio no banco, então compras simultâneas não ultrapassam o limite.

O pedido mostra no painel o cupom usado e o valor do desconto; a exportação CSV inclui as duas colunas. A lista de cupons mostra usos pagos, total de descontos concedidos e pagamentos em andamento. Desativar ou excluir um cupom não altera pedidos já feitos.

Os usos ficam na tabela `mn_coupon_redemptions`. A aplicação cria essa tabela no primeiro uso; se o usuário do banco não tiver permissão para criar tabelas, importe novamente [`database/mundo-natural-schema.sql`](../database/mundo-natural-schema.sql) pelo phpMyAdmin (o arquivo só acrescenta tabelas que faltam). As definições dos cupons ficam em `mn_settings`.

### Proteções

- Rotas do painel exigem sessão administrativa, verificação de origem e token CSRF, com limite de alterações por minuto.
- A consulta de cupom na loja exige a sessão de pagamento, verificação de origem e CSRF, e tem limite de tentativas por sessão e global, para dificultar a adivinhação de códigos.
- A loja nunca recebe limites de uso, anotações ou estatísticas: apenas código, percentual, compra mínima e fim da validade.

### Aviso comercial

O Código de Defesa do Consumidor proíbe publicidade enganosa. Ao divulgar o cupom, evite apresentar o preço reajustado como “preço de antes” ou anunciar uma redução que não existe. Os produtos não mostram preço riscado por causa do cupom.
