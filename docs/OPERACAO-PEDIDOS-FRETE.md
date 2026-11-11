# Pedidos, embalagem e entrega

## Configurar o frete

Depois de aplicar `npm run db:migrate`, entre no `/admin` e abra **Frete e entregas**. Informe o CEP real da loja, o valor por quilômetro, a taxa base, o frete mínimo e a distância máxima. Deixe o campo de frete grátis vazio para desativar a promoção. Habilite a entrega apenas depois de conferir os valores no simulador e salvar.

O cálculo usa a distância em linha reta entre coordenadas aproximadas dos CEPs, obtidas na BrasilAPI. Não calcula uma rota de carro nem promete prazo de entrega. A consulta não exige token de mapas e não envia nome, telefone, número do imóvel ou produtos à BrasilAPI. CEPs genéricos, sem coordenadas ou fora da área precisam de atendimento.

O preço é o maior valor entre **frete mínimo** e **taxa base + distância × tarifa por km**, arredondado para centavos. A promoção de frete grátis vale a partir do subtotal configurado e respeita o limite de distância. Exemplo apenas ilustrativo: base de R$ 2,00, tarifa de R$ 3,00/km, mínimo de R$ 8,00 e distância de 3 km resultam em R$ 11,00. Escolha os valores da sua operação.

O carrinho e o checkout compartilham o cálculo. A cotação vale por 10 minutos e fica vinculada aos produtos, às quantidades, aos preços e à versão das tarifas. Alterações exigem novo cálculo antes de pagar. O servidor calcula e valida o total; taxas ou distâncias enviadas manualmente pelo navegador são rejeitadas. O frete fica registrado no pedido e não muda quando você altera as tarifas da loja.

## Receber avisos

Com o painel aberto e a sessão autenticada, toque em **Ativar avisos sonoros**. Esse toque é necessário porque os navegadores bloqueiam áudio automático. A ativação toca o som de teste; depois você pode testar novamente ou silenciar. O aparelho precisa estar com volume audível.

O acompanhamento consulta eventos de pedidos aproximadamente a cada 10 segundos enquanto a página está visível e usa intervalos maiores em segundo plano ou quando há falha de conexão. Os avisos aparecem em qualquer aba do painel. Por padrão, o som avisa a aprovação de pagamento. Para avisar também a criação de pedidos pendentes, marque a opção correspondente; pendentes continuam bloqueados para separação.

Entrar no painel não reproduz sons de todo o histórico; os pedidos em aberto aparecem no contador **para embalar**. Notificações repetidas do Mercado Pago não criam novos eventos para o mesmo estado. Se o pagamento tiver mudado novamente, um aviso antigo de aprovação não é apresentado como atual.

O aviso funciona com o painel aberto. Navegadores podem suspender páginas em segundo plano, abas ocultas e celulares bloqueados. Não é um serviço de push com o navegador fechado. Ao retornar à página, confira a conexão e o contador. Cada aba aberta acompanha os eventos independentemente; prefira deixar uma aba de operação com o som ativado.

## Separar e embalar

1. Abra o aviso ou o filtro **Pagos para embalar**.
2. Confira pagamento, modo de recebimento, endereço/telefone e observações do cliente.
3. Selecione **Em separação** e marque cada produto depois de conferir peso, porções, integridade e embalagem. O frete não entra no checklist.
4. Marque **Embalado e pronto** após conferir todos os itens. A alteração consulta novamente o pagamento no Mercado Pago. Pedidos pendentes ou reembolsados não são liberados.
5. Para entrega, registre o entregador e selecione **Saiu para entrega**. Para retirada, entregue à pessoa responsável. Marque **Concluído** ao finalizar.

Se desmarcar um item pronto, o pedido volta para separação. Pedidos que já saíram ou foram concluídos exigem voltar à etapa de separação antes de alterar o checklist. Notas internas são privadas da equipe. O botão de impressão gera um resumo de embalagem, sem valor de documento fiscal, e só fica habilitado para pedidos pagos.

## Custo real e lucro

O frete cobrado do cliente faz parte da receita. O valor pago ao entregador é uma despesa própria daquele pedido. Informe o **custo real da entrega** nos detalhes: não confunda a tarifa cobrada com o custo. Use zero apenas quando não houve custo. Sem essa informação, o painel mantém o lucro pendente, assim como faz quando faltam custos de produtos, taxas ou reembolsos.

O painel separa custo de produtos e custo de entregas, exclui a linha de frete dos produtos mais vendidos e mantém os valores históricos. Alterações de checklist, etapas, operações e tarifas são auditadas sem copiar endereços, telefones ou observações para o histórico de auditoria.

As credenciais reais de Mercado Pago e a hospedagem precisam ser homologadas antes de vender. Configure e confira o recebimento do Webhook de Orders: o aviso depende do registro confirmado no servidor, não do comprovante do cliente.
