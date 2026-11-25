# Pedidos, embalagem e entrega

## Configurar o frete

Depois de aplicar `npm run db:migrate`, entre no `/admin` e abra **Frete e entregas**. Informe o CEP real da loja, o endereço de saída (rua e número), o valor por quilômetro, a taxa base, o frete mínimo e a distância máxima. Deixe o campo de frete grátis vazio para desativar a promoção. Habilite a entrega apenas depois de conferir os valores no simulador e testar alguns CEPs.

### Distância de carro grátis com TomTom (recomendado)

A BrasilAPI encontra rua, bairro e cidade pelo CEP; o cliente confere a rua na tela, e o endereço completo aparece no pedido. Para medir a rota de carro sem cartão de crédito, use o plano gratuito da **TomTom** (cerca de 2.500 consultas por dia, uso comercial permitido, mapa próprio com boa cobertura no Brasil):

1. Crie uma conta grátis em [developer.tomtom.com](https://developer.tomtom.com) (**Register**) com seu e-mail e confirme o cadastro.
2. No painel (**Dashboard → Keys**), copie a chave de API criada automaticamente (ou crie uma nova).
3. Na Hostinger, em **Environment variables**, crie `TOMTOM_API_KEY` com a chave e reinicie a aplicação.
4. Em **Admin → Frete e entregas**, confirme a mensagem da TomTom, preencha o endereço de saída (rua e número), revise as tarifas, teste CEPs conhecidos e ative a entrega.

Cada novo endereço usa até duas consultas (localizar a rua e calcular a rota); o endereço da loja e as rotas ficam guardados por 6 horas, e o site limita a 300 cálculos por dia. Se a TomTom localizar só a cidade ou o bairro, encontrar outra cidade ou não responder, o cliente é orientado a falar com a equipe em vez de receber um frete errado. A chave fica só no servidor. A TomTom recebe apenas o endereço da loja e a rua, o bairro, a cidade e o CEP de destino, e a tela de frete exibe a atribuição “© TomTom”.

### Alternativa grátis: openrouteservice

A BrasilAPI encontra rua, bairro e cidade pelo CEP (o cliente confere a rua na tela, e o endereço completo aparece no pedido). Para medir a rota de carro sem cartão de crédito, use o **openrouteservice**, da HeiGIT (Universidade de Heidelberg), com dados do OpenStreetMap:

1. Crie uma conta grátis em [account.heigit.org](https://account.heigit.org) com seu e-mail e confirme o cadastro.
2. No painel da conta, escolha o plano gratuito (**Standard**) do openrouteservice e copie a chave de API.
3. Na Hostinger, em **Environment variables**, crie `OPENROUTESERVICE_API_KEY` com a chave e reinicie a aplicação.
4. Em **Admin → Frete e entregas**, confirme a mensagem do openrouteservice, preencha o endereço de saída (rua e número), revise as tarifas, teste CEPs conhecidos e ative a entrega.

O plano gratuito permite cerca de 2.000 rotas por dia; o site usa no máximo 300 cálculos por dia e guarda cada rota por 6 horas. A precisão é menor que a do Google em algumas ruas: se o serviço localizar só a cidade, encontrar outra cidade ou não responder, o cliente é orientado a falar com a equipe em vez de receber um frete errado. O serviço recebe apenas o endereço da loja e a rua, o bairro, a cidade e o CEP de destino. A tela de frete exibe a atribuição exigida (openrouteservice.org e colaboradores do OpenStreetMap).

Se mais de uma chave estiver configurada, o site usa nesta ordem: Google Maps, TomTom, openrouteservice.

Nos pedidos com entrega, o painel mostra o endereço completo e os botões **Abrir no Google Maps** e **Abrir no Waze**, que abrem a navegação no celular sem chave de API.

### Distância de carro com Google Maps (alternativa paga)

Se `GOOGLE_MAPS_API_KEY` estiver configurada, ela tem prioridade sobre o openrouteservice. Exige faturamento no Google Cloud com cartão de crédito.

A BrasilAPI encontra rua, bairro e cidade pelo CEP. Com a variável privada `GOOGLE_MAPS_API_KEY` configurada na hospedagem, o servidor pede ao **Google Maps (Routes API)** a distância de carro do endereço de saída da loja até a rua do CEP do cliente. Sem a chave, o site volta à estimativa antiga em linha reta, cujas coordenadas costumam ser do centro da cidade: endereços diferentes de Taboão podem aparecer como 0 km. O painel informa qual método está ativo.

1. Em [console.cloud.google.com](https://console.cloud.google.com/), crie um projeto (ou use um existente) e ative o faturamento. A cota gratuita mensal do Google costuma cobrir uma loja pequena; confira os valores atuais em [Preços da Plataforma Google Maps](https://developers.google.com/maps/billing-and-pricing/pricing).
2. Em **APIs e serviços → Biblioteca**, ative **Routes API**.
3. Em **APIs e serviços → Credenciais**, crie uma **chave de API**. Em **Restrições de API**, permita somente **Routes API**. Se a Hostinger informar um IP fixo de saída, restrinja também por IP.
4. Em **Cotas**, limite as solicitações diárias para evitar cobranças inesperadas. O site também limita a 60 cálculos por minuto e 300 por dia, e guarda cada rota por 6 horas.
5. Na Hostinger, em **Environment variables**, crie `GOOGLE_MAPS_API_KEY` com a chave (nunca use `NEXT_PUBLIC_`) e reinicie a aplicação.
6. Em **Frete e entregas**, confirme a mensagem sobre o Google Maps, preencha o endereço de saída e teste CEPs conhecidos.

O Google recebe apenas o endereço da loja e a rua, o bairro, a cidade e o CEP de destino. Nome, telefone, número do imóvel, e-mail e itens não são enviados. Se o Google localizar só a cidade ou o bairro, ou não responder, o cliente é orientado a falar com a equipe em vez de receber um frete errado. A distância é calculada até a rua (sem o número), o que dá precisão de algumas centenas de metros.

O preço é o maior valor entre **frete mínimo** e **taxa base + distância × tarifa por km**, arredondado para centavos. A promoção de frete grátis vale a partir do subtotal configurado e respeita o limite de distância. Exemplo apenas ilustrativo: base de R$ 2,00, tarifa de R$ 3,00/km, mínimo de R$ 8,00 e distância de 3 km resultam em R$ 11,00. Escolha os valores da sua operação.

O carrinho e o checkout compartilham o cálculo. A cotação vale por 10 minutos e fica vinculada aos produtos, às quantidades, aos preços e à versão das tarifas. Alterações exigem novo cálculo antes de pagar. O servidor calcula e valida o total; taxas ou distâncias enviadas manualmente pelo navegador são rejeitadas. O frete fica registrado no pedido e não muda quando você altera as tarifas da loja.

## Enviar mensagens ao cliente

Cada pedido pago abre com o quadro **Enviar para o cliente**. Os botões abrem o WhatsApp da loja com uma mensagem completa — primeiro nome, itens comprados (cada combo uma vez), frete, cupom, total e endereço de entrega ou da loja, sem o número do pedido — e já atualizam a etapa:

- **Enviar: pagamento confirmado** → etapa “Em separação”.
- **Enviar: separado e embalado** (entrega) ou **pronto para retirar** (retirada) → “Embalado e pronto” (exige todos os itens conferidos).
- **Enviar: saiu para entrega** → informe em quantos minutos chega; a previsão é salva no pedido e entra na mensagem e na página do cliente.
- **Enviar agradecimento e concluir** → “Concluído”, com convite para avaliar.

Confira o texto no WhatsApp e toque em enviar. Se o cliente não marcou atualizações pelo WhatsApp no checkout, o painel lembra de enviar só o necessário sobre o pedido. Na página do pedido, o botão **Falar com a loja** do cliente também envia os itens, o total e a forma de recebimento, sem o código do pedido.

O cliente acompanha as etapas em **Acompanhar pagamento** (`/pagamento/retorno`), no navegador em que comprou. A página se atualiza a cada minuto enquanto estiver aberta e não mostra contatos, endereço nem notas internas.

### Editar os textos

Em **Admin → Mensagens**, cada aviso (pagamento confirmado, separado e embalado, pronto para retirar, saiu para entrega e agradecimento) tem um texto editável com prévia ao vivo de um pedido de exemplo. Os botões de campo inserem dados que mudam a cada pedido: saudação, primeiro nome, nome da loja, lista de itens, frete/cupom/total, total pago, entrega ou retirada, endereço, previsão, telefone da loja e link de avaliações. **Restaurar padrão** volta ao texto original. Os textos salvos valem para os próximos envios.

## Visão geral

A primeira tela do painel mostra as vendas e os pedidos pagos de hoje, os pagamentos pendentes, o ticket médio do período e o **quadro de pedidos em andamento** (pagos a separar, em separação, prontos e saiu para entrega). Toque em um cartão para abrir o pedido com **Enviar para o cliente**. Os resultados do período, o gráfico e os produtos mais vendidos ficam logo abaixo. A conferência de configurações da loja está em **Mais opções → Configuração**.

## Impressora térmica

Em **Pedidos → Impressora da loja**, no computador da loja, marque **Imprimir automaticamente cada pedido pago neste computador** e escolha o papel (80 mm ou 58 mm). Com o painel aberto, cada pedido aprovado é impresso uma vez, com cliente, telefone, endereço, itens para conferência, frete, cupom, total e observações. **Imprimir pedido**, dentro de cada pedido, reimprime quando precisar.

Para imprimir sem a janela de confirmação do navegador: defina a térmica como impressora padrão do Windows, crie um atalho do Google Chrome com `--kiosk-printing` no final do campo Destino, feche todas as janelas do Chrome e abra o painel por esse atalho. A configuração vale só para aquele computador.

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
5. Para entrega, registre o entregador, informe e salve a **previsão de chegada (1–240 minutos)** nos detalhes e selecione **Saiu para entrega**. Para retirada, entregue à pessoa responsável. Marque **Concluído** ao finalizar.

Se desmarcar um item pronto, o pedido volta para separação. Pedidos que já saíram ou foram concluídos exigem voltar à etapa de separação antes de alterar o checklist. Notas internas são privadas da equipe. O botão de impressão gera um resumo de embalagem, sem valor de documento fiscal, e só fica habilitado para pedidos pagos.

## Custo real e lucro

O frete cobrado do cliente faz parte da receita. O valor pago ao entregador é uma despesa própria daquele pedido. Informe o **custo real da entrega** nos detalhes: não confunda a tarifa cobrada com o custo. Use zero apenas quando não houve custo. Sem essa informação, o painel mantém o lucro pendente, assim como faz quando faltam custos de produtos, taxas ou reembolsos.

O painel separa custo de produtos e custo de entregas, exclui a linha de frete dos produtos mais vendidos e mantém os valores históricos. Alterações de checklist, etapas, operações e tarifas são auditadas sem copiar endereços, telefones ou observações para o histórico de auditoria.

As credenciais reais de Mercado Pago e a hospedagem precisam ser homologadas antes de vender. Configure e confira o recebimento do Webhook de Orders: o aviso depende do registro confirmado no servidor, não do comprovante do cliente.

## Contato e avisos do cliente

Nos detalhes do pedido, a equipe vê nome, e-mail, telefone e autorização de WhatsApp. O checkout solicita telefone também para retirada; pedidos antigos só exibem os contatos que já haviam sido registrados. O histórico de avisos distingue fila, aceite pelo provedor, falha e envio incerto. Configure **Mensagens aos clientes** conforme [NOTIFICACOES.md](NOTIFICACOES.md). O número oficial da loja é **(11) 5199-3525**.
