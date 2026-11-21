# Atualização de preços pelo PDV (06/11/2026)

Os preços de venda foram atualizados com o relatório **Listagem de Preços** do PDV, gerado em 06/11/2026 às 19:28, usando a coluna **Venda**. Somente o preço de venda mudou. Nome, custo, categoria, foto, disponibilidade, fichas, receitas, combos e ofertas ficaram como estavam.

## Resumo

- Produtos conferidos com o PDV: **328** (296 a granel e 32 por unidade).
- Preços alterados: **89** (78 a granel e 11 por unidade). Os demais já estavam com o preço do PDV.
- Mantidos sem alteração para revisão: **12** produtos a granel (lista abaixo).
- Produtos por unidade sem correspondência segura no PDV ficaram com o preço anterior. Eles ficam fora da vitrine por padrão; confira o preço no painel antes de ativá-los.

A base interna dos itens a granel continua **por kg**, como no PDV; a vitrine, o carrinho e o pagamento seguem mostrando e cobrando **por 100 g** (`lib/pricing.mjs`). Pedidos já feitos mantêm os valores registrados na compra.

O registro completo de cada correspondência (código e descrição no PDV, preço anterior e novo) está em [`data/pdv-price-update-2026-11-06.json`](../data/pdv-price-update-2026-11-06.json).

## Aplicar no banco (produtos editados pelo painel)

Quando um produto é salvo no painel, ou tem a disponibilidade alterada, o valor guardado no MySQL tem prioridade sobre o catálogo do código. Para que esses produtos também recebam o preço novo, importe o SQL depois da implantação:

1. Faça um backup do banco pela Hostinger (**Bancos de dados → Backups** ou **Exportar** no phpMyAdmin).
2. No phpMyAdmin, selecione o mesmo banco usado em `DATABASE_URL`.
3. Em **Importar**, envie [`database/atualizacao-precos-pdv-2026-11-06.sql`](../database/atualizacao-precos-pdv-2026-11-06.sql) e execute.
4. Confira alguns preços em **Admin → Produtos e fotos** e na vitrine.

O arquivo altera apenas `sale_cents` dos produtos listados que já existem em `mn_products`, e só quando o preço é diferente do PDV. Ele não altera um produto cujo tipo (granel ou unidade) foi trocado no painel, não cria produtos e não mexe em pedidos. Cada alteração fica registrada em **Atividade** como `product.price_import`. Importar de novo não repete as alterações. Preços que tenham sido ajustados manualmente no painel para esses produtos são substituídos pelo valor do PDV.

## Mantidos para revisão

Estes itens têm mais de um cadastro no PDV com preços diferentes, ou nenhum item a granel correspondente. O preço anterior foi mantido; ajuste no painel, se necessário.

| Produto | ID | Preço mantido | Motivo |
|---|---|---|---|
| Creatina em pó | `prod-101` | R$ 45,00/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Gotas de Chocolate | `prod-108` | R$ 20,00/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Chocolate Branco em Gotas | `prod-109` | R$ 9,00/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Gotas de Chocolatea Harnd | `prod-110` | R$ 5,80/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Gergelim Preto | `prod-134` | R$ 3,60/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Canjica Amarela | `prod-323` | R$ 1,60/100 g | Nenhum item a granel correspondente no PDV |
| Fava Branca Grauda | `prod-328` | R$ 1,50/100 g | Nenhum item a granel correspondente no PDV |
| Ervilha Partida | `prod-331` | R$ 1,50/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Cookies de Café | `prod-334` | R$ 5,20/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Cookies de Amendoas | `prod-337` | R$ 5,20/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Queijo Parmesão | `prod-395` | R$ 7,50/100 g | Mais de um item correspondente no PDV com preços diferentes |
| Barra Chocolate Harald | `prod-580` | R$ 3,40/100 g | Mais de um item correspondente no PDV com preços diferentes |

## Maiores variações

Variações de 80% para cima ou de 40% para baixo, para conferência rápida:

| Produto | Antes | Agora | Item no PDV |
|---|---|---|---|
| Semente de abóbora s/ Casca | R$ 6,60/100 g | R$ 14,90/100 g | ABOBORA CRUA S/ CASCA AA (cód. 405) |
| Chocolate 50% Cacau | R$ 3,90/100 g | R$ 7,50/100 g | CHOCOLATE 50% CACAU (cód. 442) |
| Farinha De Maracujá | R$ 2,20/100 g | R$ 4,00/100 g | FARINHA DE MARACUJA (cód. 390) |
| Cacau Alcalino | R$ 3,50/100 g | R$ 6,50/100 g | CACAU ALCALINO (cód. 265) |
| Blueberry | R$ 10,00/100 g | R$ 30,00/100 g | BLUEBERRY MIRTILIO (cód. 397) |
| Chocolate Cacau 50% | R$ 3,90/100 g | R$ 7,50/100 g | CHOCOLATE 50% CACAU (cód. 442) |
| Dolomita | R$ 1,00/100 g | R$ 2,00/100 g | DOLOMITA (cód. 6.841) |
| Mix de Pimentas | R$ 7,70/100 g | R$ 14,00/100 g | MIX DE PIMENTAS (cód. 8.093) |
| Pimenta Preta em Grão | R$ 4,50/100 g | R$ 9,50/100 g | PIMENTA PRETA EM GRAO (cód. 332) |
| Leite de Coco em Pó | R$ 14,00/100 g | R$ 7,00/100 g | LEITE DE COCO EM PO IMPORTADO (cód. 292) |
| Café de Milho | R$ 1,59/100 g | R$ 3,20/100 g | CAFE DE MILHO TORRES TORRADO E MOIDO (cód. 2.715) |
| Farinha de Banana Verde | R$ 2,40/100 g | R$ 4,50/100 g | FARINHA DE BANANA VERDE INTEGR (cód. 4.100) |
| Açúcar Mascavo | R$ 1,10/100 g | R$ 2,00/100 g | ACUCAR MASCAVO (cód. 268) |
| Castanha do Pará Quebrada | R$ 7,00/100 g | R$ 16,00/100 g | CASTANHA DO PARA QUEBRADA (cód. 357) |
| Feijão Preto | R$ 1,70/100 g | R$ 1,00/100 g | FEIJAO PRETO (cód. 3.735) |
| Cavalinha | R$ 4,50/100 g | R$ 8,90/100 g | CAVALINHA (cód. 343) |

O catálogo continua sem sincronização automática com o PDV. Para uma nova atualização, gere outro relatório e repita a conferência.
