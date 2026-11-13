# Compra pelo celular, fichas e avaliações

A busca no cabeçalho mostra sugestões enquanto a pessoa digita. Ela funciona com acentos, variações de nomes e erros simples, como `psy`, `psilium` e `psylliun`. As sugestões exibem imagem e preço na unidade correta e abrem a ficha diretamente. Também é possível navegar pelas sugestões com as setas e Enter.

No celular, o cabeçalho ocupa menos espaço, as categorias deslizam na horizontal e a navegação inferior inclui avaliações. A ficha ocupa a tela como uma folha, com controle de peso, porções e uma barra de compra sempre acessível. O cliente pode compartilhar um link direto, por exemplo `/produtos?produto=prod-125`.

## Informações e receitas

Os 308 itens a granel receberam fichas com descrição, características e usos, conservação, cuidados, alergênicos a confirmar e referências. **288 possuem sugestões culinárias**; **20 materiais botânicos, suplementos ou itens externos possuem orientações específicas, sem receita de ingestão automática**. Farinhas, cereais, doces, temperos e ingredientes não receberam promessas de cura, emagrecimento ou resultado clínico.

As informações são gerais do ingrediente e da apresentação conhecida, não substituem a composição e a rotulagem do lote vendido. A loja deve conferir fabricante, espécie botânica quando aplicável, ingredientes, alergênicos, modo de uso e validade. As receitas foram redigidas/adaptadas como sugestões culinárias, sem atribuir testes de cozinha ou alegações terapêuticas aos institutos citados.

Fontes e organização:

- `lib/product-content.json`: fichas individuais iniciais, carregadas somente quando se abre o produto.
- `data/product-content-research.json`: relação entre cada produto, família de ingrediente, finalidade, receita e fontes de referência.
- `scripts/build-product-guides.mjs`: bases editoriais e adaptações; atualiza fichas iniciais e categorias. Alterações feitas no painel permanecem no banco e prevalecem sobre a base.
- `lib/catalog-groups.json`: classificação para facilitar a navegação entre alimentos, chás e itens de cuidado.
- Ministério da Saúde, TBCA/USP, TACO/Unicamp, Embrapa e Anvisa compõem as referências gerais; a identificação de Corn Sugar foi conferida também na documentação de cereal do fabricante.

As receitas completas e as referências ficam fora do catálogo inicial enviado ao navegador: a ficha usa `GET /api/products/<id>/content` somente quando aberta. Isso mantém a navegação inicial mais leve no celular.

### Editar no painel

1. Abra **Admin → Conteúdo e receitas**.
2. Busque e selecione o produto.
3. Edite descrição, benefícios/características, uso, conservação, alergênicos, cuidados, receita e referências.
4. Clique em **Publicar informações e receita**. Duas edições simultâneas não se sobrescrevem sem aviso.

Os combos também podem ter conteúdo próprio. Para um produto novo, preencha a ficha após cadastrá-lo. Não existem chamadas pagas de IA para criar descrições no servidor.

## Frete antes do checkout

O topo oferece **Consulte seu CEP**. A ficha possui a aba **Entrega**, que considera somente aquele produto, peso e quantidade; a consulta do topo considera o carrinho ou uma tarifa de referência se estiver vazio. A BrasilAPI resolve o endereço público do CEP e a distância é estimada em linha reta, segundo a regra já escolhida pela loja.

A prévia não emite um comprovante de frete para pagamento. O carrinho gera sua própria cotação assinada, vinculada aos itens, ao subtotal, ao CEP e à versão das tarifas. Valores e coordenadas do navegador não são aceitos como verdade. A cotação pode ser feita antes de informar telefone; o checkout continua exigindo contato válido.

A configuração de entrega existente é preservada. Se estiver desligada, a prévia orienta contato com a equipe, sem anunciar entrega online ou frete zero. Em **Frete e entregas**, confira origem, tarifa por km, base, mínimo, raio e limite de gratuidade, simule e habilite a entrega quando estiver pronta. Nenhuma tarifa ou prazo foi inventado.

## Avaliações de compras verificadas

A página `/avaliacoes` e a aba da ficha mostram apenas opiniões publicadas. Sem avaliações, não existe nota média ou estrelas preenchidas artificialmente.

- Somente quem possui o cookie válido do pedido neste navegador pode enviar.
- O pedido precisa ter recebido pagamento verificado e estar concluído. Produtos comprados dentro de combos também são elegíveis.
- O cookie atual dá acesso aos pedidos recentes por até 7 dias; deve ser o mesmo navegador da compra.
- Há uma avaliação por produto e pedido. Repetir o envio não cria outra nota.
- O cliente autoriza explicitamente a publicação do comentário e de seu primeiro nome. E-mail, telefone, endereço e número do pedido não aparecem na opinião pública.
- Todo envio começa não publicado. A equipe analisa em **Admin → Avaliações**, publica ou oculta e pode escrever uma resposta. A nota e o texto do comprador não podem ser alterados pelo painel.
- A média usa somente as avaliações publicadas. A moderação deve aceitar opiniões positivas ou negativas legítimas e proteger contra dados pessoais, spam, ofensas e alegações inadequadas.

As novas fichas e avaliações usam `mn_settings`, sem exigir nova importação SQL. Preços, custos, contabilidade, comprovação de pagamentos e notificações continuam nos seus fluxos próprios.
