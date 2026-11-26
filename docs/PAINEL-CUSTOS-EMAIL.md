# Painel, custos do PDV e e-mails

## Encontrar cada função

O menu do celular abre pelo botão no topo. No computador, a navegação fica à esquerda. As funções foram mantidas e agrupadas:

| Área | O que fazer |
| --- | --- |
| Dia a dia | Visão geral, Pedidos e textos de Mensagens do WhatsApp |
| Catálogo | Produtos e fotos, Ofertas e combos, Cupons, Conteúdo e receitas, Avaliações |
| Gestão | Financeiro, Custos e importação, Despesas, Frete e entregas |
| Configuração | Prontidão da loja, E-mails automáticos, Pagamentos e Atividade |

Em Pedidos, **Etapa e mensagem ao cliente** concentra a etapa, a previsão e a cópia. A alteração é validada no servidor antes da cópia; abrir o WhatsApp ou copiar novamente não muda a etapa. Confira os itens antes de marcar como embalado. Contatos, endereço, equipe, impressão e conciliação continuam nos detalhes. Veja [a operação dos pedidos](OPERACAO-PEDIDOS-FRETE.md).

## Importar custos reais

1. Exporte do PDV um **CSV com a coluna de custo** e o nome, código do PDV, código de barras ou ID do produto no site. Nunca use um relatório contendo apenas preço de venda para calcular margem.
2. Em **Custos e importação**, escolha o arquivo de até 1 MB. O sistema aceita UTF-8, Windows-1252 e UTF-16 com BOM; separadores ponto e vírgula, vírgula ou tabulação; valores brasileiros como `8,57` e `1.234,56`.
3. Confira as colunas detectadas e selecione a unidade dos custos a granel: **kg** ou **100 g**. Produtos embalados usam custo por unidade. A correspondência é exata por ID, código registrado do PDV ou nome normalizado; nomes ambíguos e linhas conflitantes ficam para revisão.
4. Prefira **Preencher somente custos vazios** na primeira importação. Para atualizar custos existentes, selecione a outra opção e confira os valores antes de aplicar. Zero explícito é aceito; custo ausente não vira zero.
5. Revise a prévia. Ao alterar colunas ou unidade, clique em **Conferir arquivo** novamente. O servidor recalcula a prévia na aplicação e rejeita alterações concorrentes nos custos.
6. Aplique. Somente os custos dos produtos conferidos são gravados. Preços de venda, disponibilidade, fotos e vendas anteriores são preservados. O histórico registra quantidade de produtos e a identificação criptográfica do arquivo, sem guardar o CSV ou os valores no log de auditoria.

Os novos pedidos guardam o custo da porção no momento do registro. Alterar o cadastro depois não reescreve esse histórico. Para preencher **custos ausentes de pedidos antigos**, existe uma ação separada e confirmada em **Financeiro**. Ela usa o cadastro atual e não reconstrói o custo real de outra data.

O editor de produto recebe **venda por 100 g** e **custo por kg**, para preservar centavos do custo do PDV. No MySQL, ambos continuam por kg. Não divida manualmente colunas do banco.

### Privacidade dos custos

Custos e margens são acessíveis apenas pela sessão administrativa. As APIs da vitrine usam uma lista explícita de campos públicos, inclusive nos combos. E-mails e mensagens ao cliente recebem apenas valores da compra. O arquivo é processado em memória e os custos ficam no MySQL; **não envie o CSV para este repositório público**, `public/` ou um serviço de imagens. Se guardar uma cópia local no projeto, use `private-imports/`, ignorado pelo Git.

O relatório versionado de 06/11/2026 contém **preços de venda**, sem uma coluna utilizável de custo. Os campos antigos de quantidade e total de inventário não são preços de custo. Nenhum custo foi estimado a partir deles; use o CSV original com a coluna de custo ou os valores privados já cadastrados no banco.

## Como o resultado é calculado

**Lucro estimado = receita recebida − reembolsos − custo dos produtos − taxas do pagamento − custo real das entregas − despesas.**

O frete cobrado é receita; o pagamento ao entregador é um custo separado. O painel mantém o resultado pendente quando faltam custos, taxas, reembolsos ou custo de entrega. Registre zero somente quando o custo realmente for zero. Esta é uma análise gerencial, não uma apuração contábil ou fiscal.

## Ativar e-mail

Depois de verificar um remetente do domínio na Brevo, adicione **BREVO_API_KEY** nas variáveis da Hostinger e reimplante. O remetente ativo é detectado e o e-mail é habilitado na primeira configuração válida. Para escolher um remetente específico já verificado, há a variável opcional **BREVO_SENDER_EMAIL**. O envio funciona no Node.js em execução, mesmo com o painel fechado; pedidos antigos não recebem avisos retroativos e desativar o canal no painel é respeitado após reinícios.

Os e-mails têm versão HTML responsiva e texto simples, com os itens, valores, recebimento e acompanhamento. A tela do cliente mostra o pagamento consultado no Mercado Pago e o estado do e-mail sem expor destinatário ou informações internas. Aceite pelo provedor não comprova entrega ou leitura. A homologação privada do Mercado Pago não envia mensagens reais. Veja [ativação, limites e diagnóstico](NOTIFICACOES.md).

Nenhuma nova tabela é exigida por esta atualização: configurações, fila e marcação da ativação usam `mn_settings`. Mantenha o banco existente e os serviços de CEP/rotas já configurados.
