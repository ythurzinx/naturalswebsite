# Revisão de pedidos e frete

Revisão manual e testes locais/CI para a atualização da operação da loja. Não representa certificação, teste da infraestrutura de hospedagem ou uma varredura automatizada do Codex Security. Nenhuma credencial real ou cobrança da loja foi usada.

## Comportamento verificado

- Frete estimado em linha reta entre CEPs, com taxa base, tarifa/km, mínimo, limite de distância e promoção de frete grátis; a entrega fica desativada até a configuração da loja.
- Cookie/CSRF/origem, requisições e respostas limitadas, consulta a domínio fixo, rejeição de CEP/URL adulterado, quotas, erro externo e falta de coordenadas sem cobrança equivocada.
- Cotação assinada ligada à seleção canônica e à versão das tarifas: alteração de peso, quantidade, subtotal, assinatura, validade ou configuração exige novo cálculo. O total enviado ao provedor inclui o frete uma vez.
- Endereço registrado antes da chamada ao provedor e recuperado por Webhook/repetição. A concorrência não duplica receita, pedido ou aviso do mesmo estado. Custos, notas e frete histórico são preservados.
- Sessão administrativa verdadeira no MySQL para limites de acesso, autenticação e CSRF. Feed, tarifas, checklist e informações da equipe recusam acesso anônimo. Não há aprovação manual de pagamentos.
- Checklist só para produtos de pedido pago, sem linha de frete, com bloqueio de liberação incompleta e de alterações após saída/conclusão sem reabertura da separação.
- Custo real da entrega separado da tarifa recebida. Falta de custo mantém o lucro pendente; frete não aparece como produto mais vendido.
- Navegador em 360 × 800, 390 × 844 e 1280 × 900: ativação de Web Audio por clique, aviso de pedido pago recebido pelo feed, ausência de aviso duplicado, checklist persistido, notas/custo real, edição das tarifas e checkout com endereço e total corretos.

A confirmação do teste de áudio observa a programação do som pela API Web Audio; não mede o alto-falante físico. O navegador pode pausar páginas em segundo plano e aparelhos bloqueados. A demonstração de telas utiliza fixtures isoladas; a autenticação real e a persistência são cobertas pelos testes com MariaDB.

## Repetir e implantar

Execute `npm run verify`, `npm run test:database` com `INTEGRATION_DATABASE_URL` para um banco local descartável `mn_test`, e `npm run test:browser` com Chromium instalado. A CI configura e executa essas etapas. Não use a suíte de banco na produção.

A atualização acrescenta tabelas por `CREATE TABLE IF NOT EXISTS`, sem apagar as existentes. Faça backup, execute `npm run db:migrate` e confira o checklist de lançamento. Para reverter o código, as tabelas adicionais podem permanecer; pagamentos, pedidos e dados não são desfeitos por rollback do deploy.

No domínio final, valide HTTPS, as credenciais e o Webhook da conta da loja, uma compra de teste Pix/cartão, o endereço de origem, a tarifa e a área de entrega, o WhatsApp correto e o som em um aparelho real. Consulte [DEPLOY.md](DEPLOY.md). O relatório cobre o código e os ambientes locais de teste; não comprova a operação da conta Mercado Pago ou da Hostinger.
