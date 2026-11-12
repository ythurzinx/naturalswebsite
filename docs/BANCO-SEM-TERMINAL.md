# Preparar o banco pela Hostinger, sem terminal

O pagamento e o painel precisam das tabelas no MySQL, além das variáveis privadas configuradas. Se você não encontrou onde executar `npm run db:migrate`, importe o arquivo SQL pelo phpMyAdmin. Ele contém as mesmas tabelas do comando de migração.

## Importar as tabelas

1. Baixe [mundo-natural-schema.sql](../database/mundo-natural-schema.sql). No GitHub, abra esse arquivo e use **Download raw file** para salvar o `.sql` no computador.
2. Na Hostinger, abra **Sites → Gerenciar** no site da aplicação e procure **Bancos de dados → phpMyAdmin**. Dependendo da tela do hPanel, o acesso também aparece em **Bancos de dados → Gerenciamento**, ao lado do banco.
3. Abra o **mesmo banco configurado em `DATABASE_URL`**, considerando o nome completo com o prefixo da sua conta. As credenciais continuam no painel privado da Hostinger.
4. No phpMyAdmin, selecione esse banco na coluna da esquerda. Confira o nome antes de continuar.
5. Clique na aba **Importar**, selecione `mundo-natural-schema.sql`, mantenha o formato SQL e clique em **Executar/Importar**.
6. Aguarde a confirmação de sucesso. A estrutura terá 14 tabelas com prefixo `mn_`, incluindo `mn_products`, `mn_orders`, `mn_admin_sessions` e `mn_settings`.
7. Atualize a loja e tente abrir o painel novamente. Se você alterou variáveis da aplicação, use **Restart/Reiniciar** ou faça redeploy na Hostinger.

**Preserve os dados existentes.** Nosso arquivo usa somente `CREATE TABLE IF NOT EXISTS`: acrescenta as tabelas que faltam, sem apagar tabelas, substituir pedidos ou cadastrar produtos de demonstração. Ele pode ser importado novamente. Recomendações de esvaziar um banco antes de importar um backup genérico não se aplicam a este arquivo de estrutura.

O arquivo não contém senha, token, nome de banco ou conta de administrador. A criação das tabelas não gera credenciais e não substitui `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` ou as credenciais do Mercado Pago. O catálogo inicial permanece no código e é combinado com as alterações cadastradas pela loja.

## Conferir o resultado

Abra `/api/catalog` no endereço da aplicação: deve retornar JSON com a lista de produtos. Em `/api/shipping/settings`, deve aparecer uma configuração de frete, que pode estar desativada até você cadastrar a regra no painel.

Se continuar aparecendo erro 500, confira a variável privada `DATABASE_URL`: nomes completos do usuário e do banco, senha e acesso ao banco correto. Para o MySQL local de aplicações Node.js na Hostinger, o host indicado na documentação oficial é `127.0.0.1`, porta `3306`. Caracteres especiais na senha precisam estar codificados na URL. Se o phpMyAdmin informar falta de permissão ou outro erro, use o código e a mensagem do erro para diagnóstico, preservando senhas e tokens.

O sucesso da importação comprova a criação das tabelas no banco selecionado. A aplicação também precisa conseguir conectar-se a esse mesmo banco. Configurar os tokens de pagamento, por si só, não confirma essa conexão.

## Manter o arquivo sincronizado

O código de referência é `lib/server/schema.mjs`. Depois de mudar a estrutura, execute `npm run db:export` e inclua o SQL atualizado na alteração. A CI verifica essa correspondência com `npm run db:export -- --check`. O arquivo é uma alternativa à execução de `npm run db:migrate` para esta estrutura, e não um backup dos dados.

## Documentação oficial

- [Importar SQL pelo phpMyAdmin na Hostinger](https://www.hostinger.com/support/1884149-how-to-import-a-database-with-phpmyadmin-in-hostinger/).
- [Conectar o MySQL a uma aplicação Node.js na Hostinger](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/).
