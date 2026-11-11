# Revisão de segurança da integração

Esta é uma revisão manual de código e de testes da aplicação, com foco no lançamento. Não é um relatório de uma varredura automatizada do Codex Security: os recursos auxiliares e as ferramentas exigidos por esse fluxo não estavam disponíveis neste ambiente.

## Limites de confiança

- Navegador: IDs, pesos, quantidades, nome, e-mail, cookies e parâmetros de retorno são entradas não confiáveis.
- Servidor Next.js: valida entradas, usa o catálogo aprovado pela loja e mantém o Access Token privado.
- MySQL: guarda alterações de catálogo, pedidos, custos, fotos, sessões administrativas e histórico; o catálogo público não expõe custos ou dados de comprador.
- Mercado Pago: mantém o registro durável de pedidos e pagamentos e processa Pix/cartão em seu ambiente.
- Hostinger: executa Node.js, termina HTTPS e mantém variáveis de ambiente e registros operacionais.

Não há banco de cartões, formulário de cartão, operação de reembolso pública ou painel administrativo com senha no navegador.

## Controles implementados

| Ameaça | Controle e evidência |
| --- | --- |
| Alteração de preço no navegador | O servidor combina o catálogo inicial com os preços e a disponibilidade atuais no MySQL. Campos extras, pesos inválidos, produtos desativados, quantidades indevidas e divergência de total são rejeitados em `checkout-core.mjs`. |
| Erros de arredondamento | Cálculo em centavos; a unidade a granel de 100 g é arredondada uma vez antes de multiplicar pelos blocos e pela quantidade de porções. Uma função compartilhada mantém o valor anunciado, o carrinho e o servidor iguais. Pesos fora dos múltiplos de 100 g são recusados. |
| Repetição de uma tentativa | Chave de idempotência gerada no servidor a partir de sessão autenticada e seleção canônica, enviada à Orders API. Repetir a mesma tentativa não gera uma nova intenção independente. |
| Falsificação de sessão/pedido | Estado autenticado com HMAC e chaves derivadas com HKDF, separado por propósito e origem, com expiração. Cookies `HttpOnly`, `Secure` em HTTPS, `SameSite=Lax`, prefixo `__Host-` e limite de pedidos. |
| CSRF | Origem exata, metadados de mesma origem, JSON e token CSRF ligado à sessão. A origem nunca é inferida de um header Host enviado pelo comprador. |
| Acesso ao pedido de outra pessoa | A consulta exige o pedido no cookie autenticado desse navegador. Um ID ou query string não fornece acesso. |
| Retorno adulterado / falso pagamento | Consulta autenticada da order na API; valida ID, referência assinada, moeda, país, valor e ambiente. Apenas `processed/accredited` com o total integral é mostrado como pago. |
| Webhook falso / replay | Assinatura HMAC do Mercado Pago, comparação de tempo constante, ID consistente, ambiente e janela de cinco minutos. O servidor consulta o estado atual; callbacks repetidos não cobram, despacham ou reembolsam. |
| Redirecionamento malicioso | Checkout limitado ao domínio HTTPS brasileiro do Mercado Pago, caminho de checkout e ID esperado. URLs de retorno vêm da origem configurada no servidor. |
| SSRF e vazamento de credenciais | Destino da API fixo, caminhos limitados a Orders e leitura de pagamentos com ID numérico para conciliação; redirects de rede recusados; timeout e limite de resposta. Tokens não são enviados ao cliente ou incluídos em erros. |
| Abuso de recursos | Corpo/quantidade de itens limitados, respostas do provedor limitadas, timeout, limite por sessão/order e teto por processo com memória limitada. |
| Execução de script injetado | CSP com nonce novo por resposta e `strict-dynamic`, sem `unsafe-inline` para scripts em produção; atributos de script bloqueados; preços/textos renderizados pelo React. Respostas HTML com nonce não são compartilhadas em cache. |
| Clickjacking e MIME sniffing | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, políticas de permissões, origem e referenciador. |
| Cadeia de dependências | Lockfile, auditoria de produção, CI com permissões mínimas, actions fixadas por commit e Dependabot. |
| Armazenamento desnecessário | Carrinho mínimo e com expiração; favoritos opcionais; dados de cartão fora do site; dados de comprador não são colocados em cookies ou localStorage. |

## Testes e limites da evidência

Os testes exercitam o serviço com objetos HTTP Request/Response e uma API Mercado Pago simulada. Cobrem preços adulterados, CSRF, pesos/quantidades, idempotência, cookies, expiração, IDOR, moedas/valores divergentes, redirects, Webhooks, limites e falhas de provedor. Os testes HTTP de produção executam o Next.js compilado, conferem rotas, bloqueio administrativo e nonces aplicados aos scripts reais.

As credenciais de produção não foram fornecidas. Não foi criada cobrança real, não houve teste do certificado/domínio da Hostinger e a disponibilização efetiva de Pix/cartão depende da conta da loja. A ferramenta de navegador do ambiente não foi disponibilizada; a revisão visual/interativa em computador e celular continua necessária na hospedagem final.

O aplicativo não reserva estoque no PDV, não executa expedição automática e mantém os registros operacionais em MySQL. O estado financeiro é verificado no Mercado Pago. Não há alegação de proteção absoluta ou de certificação de conformidade.

## Recuperação e operação

- Sem credenciais válidas/configuração de origem, o pagamento online fica indisponível e a loja mantém o atendimento pelo WhatsApp.
- Não marque um pedido como pago pelo retorno do navegador. Confirme na conta do Mercado Pago antes da retirada.
- Se a API falhar, o carrinho é preservado e a mesma tentativa pode ser repetida com idempotência. Consulte o pedido antes de iniciar uma compra diferente.
- Rotacione uma credencial exposta no painel do Mercado Pago e redeploy. Isso invalida as sessões e consultas antigas do navegador; os pedidos financeiros continuam no provedor.
- Antes de aumentar limites ou adicionar múltiplos processos/instâncias, configure controles distribuídos na borda/hospedagem e revise capacidade e monitoramento.


## Painel administrativo e banco

O painel usa senha com scrypt e sal aleatório, sessão autenticada por HMAC com identificador aleatório de 256 bits e hash no MySQL, cookies HttpOnly/Secure/SameSite=Strict, CSRF e limites de login no banco. Com ADMIN_TOTP_SECRET configurado, exige TOTP e consome cada contador uma única vez. Sessões expiram após 8 horas e por inatividade de 30 minutos. Rotacionar o segredo de sessão invalida cookies antigos.

As consultas usam parâmetros preparados e multipleStatements desabilitado. MySQL remoto exige TLS. O catálogo público exclui custos e informações administrativas. Preços e disponibilidade são lidos do banco no checkout; uma falha no banco não autoriza cobrar um valor antigo. Custos são mantidos por pedido e não sobrescritos por edições futuras. Taxas/reembolsos são conciliados com referências verificadas do provedor; dados insuficientes deixam lucro indisponível.

Uploads são autenticados, limitados a 5 MB e 20 megapixels e reencodificados por Sharp como WebP, sem EXIF. SVG, animações e URLs externas arbitrárias não são aceitos. Os ativos são endereçados por SHA-256 no banco e servidos com MIME fixo, nosniff e CSP restritiva. CSV de pedidos neutraliza prefixos de fórmula em dados de clientes. Alterações de preço, fotos, despesas e retiradas são auditadas; segredos e senhas não são registrados.

Os testes de integração executam o esquema e as operações em um MariaDB descartável, incluindo limites concorrentes, snapshots de custo, autenticação, TOTP/CSRF e registros financeiros. O banco da Hostinger e as credenciais reais não foram acessados nesta implementação.
