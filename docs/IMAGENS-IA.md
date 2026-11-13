# Imagens do catálogo a granel

Os **308 produtos a granel** possuem uma ilustração de IA própria, com o mesmo padrão: fundo branco quente, tigela branca, luz suave e apresentação sem embalagem ou textos. As fotos anteriores do Wikimedia Commons foram substituídas. A conferência com o CSV original de 619 produtos não identificou outros itens a granel ausentes: frascos, embalagens fechadas e sacos internos permanecem fora da vitrine por padrão.

A geração foi feita pela ferramenta de imagens da OpenAI, após aprovação do padrão e do lote completo pela loja. Foram produzidas 20 grades e uma grade adicional de nove correções visuais. O catálogo informa que as imagens são ilustrativas, geradas por IA, e que a aparência pode variar. Não representam o lote real e não servem para confirmar composição, alergênicos ou marca. A loja pode substituir qualquer imagem pela foto real no painel.

Os arquivos WebP ficam em `public/images/products/studio-prod-*.webp`; o conjunto tem aproximadamente 5,4 MB. Os quadros possuem de 313 a 627 pixels, adequados às miniaturas da vitrine; fotografias reais maiores podem ser enviadas pelo painel quando necessário.

- `data/product-photo-sources.json`: produto, arquivo, legenda, estilo e SHA-256.
- `data/ai-photo-generation.json`: dimensões e SHA-256 das grades de origem, posição de cada produto e correções.
- `npm run assets:check`: verifica cobertura, integridade, dimensões, formato e origem.
- `scripts/import-ai-product-photos.mjs`: extrai e otimiza fotografias de grades **já geradas**. Não chama API paga. Recebe um JSON local com `number`, `side`, `path` e `products: [{id,name}]`. Use `--replace` para substituir somente os produtos de uma grade de correções. As imagens originais permanecem no ambiente de geração; os arquivos finais e a rastreabilidade ficam versionados no GitHub.

Revisão visual: as representações de cereal coberto com chocolate, granulado em flocos, gergelim com casca, feno-grego, levedo em pó, castanha crua, folhas de oliveira, buxinha e cobertura para sorvete receberam uma segunda geração específica. Misturas de temperos, doces e marcas podem variar em relação à ilustração; confirme com o produto real e substitua a foto no painel quando necessário.

## Baixar as imagens para usar no iFood

[Baixar ZIP com as 308 imagens em JPG](https://github.com/ythurzinx/naturalswebsite/raw/refs/heads/main/public/downloads/mundo-natural-imagens-jpg.zip). Os [originais WebP do site](../public/images/products/) também continuam disponíveis.

Extraia o arquivo e abra a pasta `fotos-jpg`. Cada foto inclui o nome do produto e seu ID no nome do arquivo. O pacote inclui `indice-dos-produtos.csv`, com nome, categoria, arquivo e dimensões, e `LEIA-ME.txt`, com as orientações. O CSV é um índice para localizar as fotos; não importa os produtos automaticamente no iFood.

Os JPGs foram exportados dos quadros PNG originais da geração, em resolução própria de cada quadro (313–627 pixels de lado). As 308 imagens mantêm os produtos individualizados, têm pelo menos 300 × 275 pixels e menos de 5 MB por arquivo. O pacote foi conferido por contagem, integridade do ZIP, hash de cada JPG e correspondência com o catálogo. O tamanho total do ZIP é aproximadamente 13 MB.

No Portal/App do Parceiro iFood, abra o catálogo ou cardápio, edite o produto e envie o JPG correspondente no campo de foto. Confira a prévia e salve. Os menus, o recorte e os requisitos podem variar conforme a modalidade da loja; a aceitação final depende do painel do iFood. São ilustrações de IA: confira a correspondência com o produto real antes da publicação.

O ZIP registra as 308 ilustrações desta versão do catálogo. Fotos enviadas depois pelo painel não alteram esse pacote automaticamente.

Na revisão das fichas, Corn Sugar e Corn Sugar Mascavo foram identificados como cereais em flocos de milho. As imagens desses dois itens passaram a usar o quadro já gerado do cereal de milho; a reatribuição está registrada em `data/ai-photo-generation.json`. Os dois JPGs do pacote de download foram atualizados.
