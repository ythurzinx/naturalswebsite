# Ofertas, combos, fotos e entrega

## Vitrine e produtos

O catálogo importado permanece com 619 registros no painel. A vitrine inicial mostra 308 produtos a granel e os combos ativos. Foram corrigidos sete itens cujo peso original estava em kg: creatina em pó, psyllium, glutamina, Mix Aromas, maca peruana, tapioca granulada e ervilha partida. Os valores de origem por kg não mudaram. Sacos de embalagem ficam inativos como itens de uso interno.

Produtos antigos embalados ficam inativos na vitrine. Edições anteriores ao corte de 12/11/2026, 21:09:07 UTC não os republicam. Para vender um deles, abra **Produtos e fotos**, revise preço e apresentação, adicione a foto e marque como ativo. Novos produtos também podem ser cadastrados por unidade. Nada apaga os registros nem altera pedidos existentes.

Fotos ilustrativas têm o mesmo enquadramento de cartão, são WebP locais e não carregam rastreadores de bancos de imagens. Algumas mostram o ingrediente de origem ou uma sugestão de apresentação; não comprovam marca, lote, corte ou composição. Os créditos e as licenças individuais estão em `/creditos`. O envio de foto própria pelo painel substitui a referência. JPEG/PNG/WebP de até 5 MB são reencodados, com remoção dos metadados e limites de pixels.

## Ofertas e combos

Em **Ofertas e combos**:

- Edite os três combos iniciais: temperos, castanhas e mix natural com farinha de uva, farinha de beterraba e maca peruana. Eles começam com a soma dos ingredientes, sem desconto automático.
- Crie até 12 combos, cada um com 2 a 8 ingredientes distintos a granel. Use porções de 100 em 100 g, até 5 kg por ingrediente e 20 kg por combo. Duplicar cria um rascunho inativo.
- Defina o desconto inteiro de 0% a 80% e confira o preço. A margem bruta só aparece quando todos os custos estão cadastrados; taxas, entregador e despesas ainda precisam ser descontados.
- Cadastre até 24 ofertas individuais e, opcionalmente, início e fim. O formulário usa o fuso do aparelho e o servidor valida o período. Ofertas inativas ou fora do período não aparecem no carrossel.
- Clique em **Publicar alterações**. Alterações não salvas não entram no site. Duas abas não sobrescrevem silenciosamente a mesma versão.

Combos não acumulam ofertas individuais: usam os preços regulares dos ingredientes e o desconto do próprio combo. Os centavos são rateados de forma determinística. O checkout recebe apenas identificadores, quantidade e peso, recalcula o preço e expande os ingredientes para o Mercado Pago, para a fila de embalagem e para o custo do pedido. Ingrediente indisponível retira o combo inteiro da venda. Alterar preço, desconto ou composição invalida totais/cotações antigos. Valores já registrados em pedidos permanecem imutáveis.

## CEP e frete

Em **Frete e entregas**, informe o CEP exato da loja, valor por km, taxa base, mínimo, distância máxima e, se desejar, limite para frete grátis. Salve e habilite a entrega. Não há tarifa inventada nem chave paga de mapas.

O cliente informa o CEP; a BrasilAPI encontra rua, bairro, cidade e coordenadas. A distância é **estimada em linha reta entre CEPs**, não uma rota de carro nem a distância exata da porta do cliente. Número, complemento e telefone completam o endereço no checkout. CEP genérico ou sem coordenadas pede atendimento em vez de produzir frete zero.

O teste de CEP no painel consulta um destino usando a regra salva. O simulador manual permite conferir tarifas ainda em edição. A cobrança usa a cotação assinada pelo servidor, vinculada aos itens, preços, CEP e versão do frete, válida por 10 minutos. Alterar a regra não muda fretes de pedidos já feitos.

## Pagamento e banco

As opções usam a tabela `mn_settings` existente; não é necessária outra migração. **Pagamentos** mostra a configuração e o resultado de ambiente da última criação do checkout para a credencial atual. MPV08 exige conferir o Access Token da aba Produção e reimplantar a aplicação; veja [o diagnóstico](DIAGNOSTICO-CHECKOUT.md).

Os testes automatizados usam provedor simulado e banco descartável. Conferir recebimento real de Pix/cartão e Webhooks requer as credenciais e a conta da loja na hospedagem.
