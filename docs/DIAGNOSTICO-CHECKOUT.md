# Diagnóstico de falhas no checkout

O endereço principal é definido por `APP_URL`. As páginas abertas pela variante com/sem `www` são redirecionadas para essa origem antes do login e do checkout. Esse redirecionamento preserva o caminho e os parâmetros; os endpoints de API mantêm suas validações de origem, CSRF e autenticação.

Se o Mercado Pago responder, mas a order falhar na verificação, a loja continua bloqueando o redirecionamento para pagamento e apresenta um código de suporte. O código identifica a conferência que falhou, sem exibir dados do comprador, tokens, referências assinadas ou a resposta bruta do provedor. Nos logs da aplicação, procure `[mercadopago.validation]` para ver os nomes das verificações que falharam e as classificações de ambiente, moeda e país. Essas classificações vêm de listas fixas; valores desconhecidos aparecem como `missing`, `unexpected` ou `unknown`, sem copiar conteúdo livre do provedor.

| Código  | Conferência                                         |
| ------- | --------------------------------------------------- |
| `MPV01` | Formato do identificador da order.                  |
| `MPV02` | Tipo `online`.                                      |
| `MPV03` | Processamento `manual`.                             |
| `MPV04` | Moeda `BRL`.                                        |
| `MPV05` | País `BRA`.                                         |
| `MPV06` | Referência externa assinada pela loja.              |
| `MPV07` | Valor total da order em centavos.                   |
| `MPV08` | Ambiente da order compatível com `MERCADOPAGO_ENV`. |
| `MPV09` | Order correspondente à tentativa esperada.          |

As regras de moeda, país, assinatura, total e ambiente permanecem obrigatórias. Uma divergência não confirma pagamento nem libera o pedido. `MPV08` exige conferir a origem da credencial e o ambiente escolhido; não se deve trocar automaticamente o modo de produção por teste para contornar a validação. Uma credencial de teste não habilita vendas reais. Para outros códigos, confira a resposta e o contrato do provedor pelo ambiente privado da hospedagem, compartilhando somente o código de suporte ou os nomes das verificações.

Depois de publicar a correção, atualize o checkout para carregar o código novo. O código de suporte só aparece em uma nova tentativa que falhe na conferência. Criações reais de pedidos e testes de Pix/cartão devem usar dados e contas apropriados à homologação; os testes do repositório usam respostas simuladas e não criam cobranças reais.

Contrato de referência: [Criar e configurar uma order do Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order?scope=prod).

## MPV08 com credenciais aparentemente de produção

Uma order `ORDTST…` é bloqueada quando `MERCADOPAGO_ENV=production`. O prefixo `APP_USR` do token, sozinho, **não comprova produção**: a documentação atual informa que os tokens de teste da Orders API também usam esse prefixo.

1. Mercado Pago Developers → Suas integrações → aplicação da loja → Credenciais → selecione **Produção**. Ative o ambiente, se necessário, preenchendo os dados do negócio.
2. Copie o **Access Token** da aba Produção, usando a conta real vendedora, e substitua `MERCADOPAGO_ACCESS_TOKEN` nas variáveis privadas da aplicação Node.js da Hostinger. Não use Public Key, Client Secret ou token da conta de teste.
3. Mantenha `MERCADOPAGO_ENV=production`, `APP_URL=https://mundonaturaltaboao.com.br` e a assinatura de Webhooks da mesma aplicação. Salve e reimplante; apenas salvar a variável pode não reiniciar o processo.
4. Reabra o checkout. Depois confira **Admin → Pagamentos**. O diagnóstico registra somente o ambiente e o resultado da última criação para a credencial atual; ele não exibe tokens, pedidos nem dados pessoais e não efetua cobrança. Uma troca de token invalida a indicação anterior.
5. Confira Pix e cartão com uma conta compradora diferente da conta vendedora. A criação válida de checkout não comprova crédito; a separação só começa após confirmação autoritativa do pagamento.

Sem acesso às variáveis da Hostinger, essa substituição precisa ser feita pelo titular da conta. Não diminua as verificações de ambiente para contornar o erro.

Fontes: [Credenciais da Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/credentials) e [Ativar produção](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/go-to-production).

## Homologação privada pelo painel

Use **Admin → Pagamentos → Testar o checkout** para testar cartões sem colocar a vitrine em modo de teste. Acrescente `MERCADOPAGO_TEST_ACCESS_TOKEN` nas variáveis privadas da Hostinger, com o Access Token de **Credenciais → Teste** da mesma aplicação, e reimplante. O token de produção e `MERCADOPAGO_ENV=production` permanecem na configuração da loja.

O botão cria uma compra fictícia de R$ 1,00, com produto e limites fixos, usando a API real em ambiente de teste. Abra uma janela anônima, entre no admin, informe nome/e-mail e use exclusivamente os dados de cartão da [documentação oficial de teste do Checkout Pro Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/integration-test/test-purchase-with-card). O guia atual permite qualquer e-mail válido quando solicitado pelo checkout; não exige login de comprador de teste para esse fluxo. Dados de cartão são preenchidos somente no Mercado Pago.

Após o retorno, o painel consulta a order na API e mostra o resultado real da homologação. Faça um cenário aprovado e outro rejeitado. A navegação de retorno e seus parâmetros não aprovam pagamentos. Cada nova tentativa recebe uma sessão distinta. Pedidos de homologação não entram no banco de pedidos, não disparam a fila de embalagem e não afetam lucro ou faturamento. Cookies e assinaturas são exclusivos desse fluxo; a API exige autenticação administrativa e CSRF.

A ausência do token mantém o teste desabilitado. Se uma credencial de produção for colocada por engano no campo de teste e a API criar uma order real, a validação bloqueia o redirecionamento antes do pagamento. O fluxo não altera automaticamente as credenciais de produção nem o ambiente da vitrine. A aprovação de cartão de teste não comprova recebimento real de Pix ou cartão; a conferência final em produção continua necessária.
