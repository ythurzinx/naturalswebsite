# Cupons e reajuste da inauguração

## Reajuste de preços

Todos os 619 produtos subiram cerca de **11,12%** e foram **arredondados para cima até a próxima dezena de centavos**: R$ 8,90 em vez de R$ 8,89. A conta é feita no preço exibido (por 100 g nos itens a granel e por unidade nos demais). O arredondamento acrescentou no máximo R$ 0,08 ao valor reajustado.

| Antes | Depois | Com cupom de 10% |
|---|---|---|
| R$ 8,00 / 100 g | R$ 8,90 / 100 g | R$ 8,01 / 100 g |
| R$ 12,00 / 100 g | R$ 13,40 / 100 g | R$ 12,06 / 100 g |
| R$ 1,00 / 100 g | R$ 1,20 / 100 g | R$ 1,08 / 100 g |
| R$ 99,00 / un. | R$ 110,00 / un. | R$ 99,00 / un. |

Com um cupom de 10%, o cliente paga o preço anterior ou até R$ 0,08 a mais por 100 g ou unidade (o desconto é calculado a cada 100 g ou unidade, arredondado a favor do cliente). Os combos somam os preços arredondados dos ingredientes. Pedidos já feitos mantêm os valores da compra.

Produtos já editados no painel guardam o preço no MySQL, que tem prioridade sobre o catálogo do código. Depois da implantação, importe no phpMyAdmin [`database/precos-inauguracao.sql`](../database/precos-inauguracao.sql), de preferência antes de editar produtos:

1. Faça um backup do banco.
2. No phpMyAdmin, selecione o banco usado em `DATABASE_URL` → **Importar** → envie o arquivo → **Executar**.

O arquivo só altera produtos que estão com o preço anterior ao reajuste ou com o reajuste sem arredondamento: importar de novo não muda nada, e preços já mudados no painel ficam como estão. Ele substitui o arquivo anterior `reajuste-precos-inauguracao.sql`. Produtos criados pelo próprio painel (`custom-...`) não estão no arquivo; ajuste-os no painel. Cada alteração aparece em **Atividade** como `product.price_raise`.

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
