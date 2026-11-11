# Mundo Natural
Loja Next.js com catálogo, sacola, solicitações por WhatsApp e painel em `/admin`.

## Hospedagem
Na Vercel, use Node.js 22 ou 24 e conecte um banco libSQL (Turso). Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nos segredos do projeto, junto com ADMIN_PASSWORD. Use um banco separado na prévia e em produção. Em servidor próprio, também é possível usar SQLite em um volume persistente. O SQLite armazena produtos, pedidos, configurações, artes e sessões. Um disco temporário de função serverless perde os dados. Para SQLite local, configure a variável `STORE_DB` com o caminho absoluto do banco no volume e `ADMIN_PASSWORD` como segredo de pelo menos 16 caracteres. Para encerrar sessões ao trocar a senha, remova os registros da tabela sessions. Faça backups com a API de backup do SQLite ou com o comando .backup.

Execute `npm ci --legacy-peer-deps`, `npm run build` e `npm start`. O servidor local de desenvolvimento usa `npm run dev` e aceita o arquivo privado .env.local. A sessão administrativa de produção exige HTTPS.

## Primeira venda
1. No painel, abra Produtos → Importar relatório CSV e selecione o relatório original. O arquivo é processado no servidor e descartado. Cada importação substitui os dados comerciais e a visibilidade dos códigos presentes. Confira a data do relatório para evitar sobrescrever uma baixa de estoque recente.
2. Revise os itens ocultos e indique preço, unidade de venda e estoque. Para venda a granel, use o preço por quilo e informe o saldo em gramas.
3. Abra Canais de venda e salve o WhatsApp comercial com 55 e DDD. O link da loja no iFood é opcional e abre o cardápio externo.
4. Confirme os pedidos recebidos no painel após conversar com o cliente. A confirmação dá baixa no estoque de forma atômica. Cancelar uma confirmação repõe as unidades.
5. Em Artes para a A1, escolha um modelo, personalize, salve e exporte. Renderize o arquivo SCAD no OpenSCAD e exporte o STL para o Bambu Studio.

O repositório contém apenas um catálogo inicial de nomes, apresentações e preços públicos. A venda fica desabilitada até configurar o canal e informar estoque. O CSV privado, saldos reais e credenciais não devem ser versionados.

## Entregas e produtos a granel
Configure GOOGLE_MAPS_API_KEY como segredo do servidor com a API Routes habilitada. A tarifa inicial é R$ 1,50 por km e pode ser alterada em Canais de venda. O cálculo usa a distância rodoviária até o CEP, sem taxa fixa. Sem rota confirmada, permanece disponível a retirada. Na aba Produtos, selecione venda a granel, informe preço por kg e saldo em gramas. Reimporte o relatório para aplicar os nomes e unidades revisados. O painel aceita fotos de produtos e logo enviada pelo administrador.
