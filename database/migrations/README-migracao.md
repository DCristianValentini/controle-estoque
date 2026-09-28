# Como aplicar a migração

## 1. Rodar o SQL

Abra o projeto Supabase da Sandiz → **SQL Editor** → cole o conteúdo de
`001_schema_fix.sql` → Run. É uma transação só (`BEGIN`/`COMMIT`): se algo
falhar no meio, nada é aplicado.

Eu (Claude) não consigo rodar isso sozinho — só tenho a `anon key` (que dá
para ler/escrever linhas via REST, mas não executa DDL). Precisa ser você,
logado no painel do Supabase, ou alguém com acesso a ele.

## 2. Criar o primeiro super_admin

Não existe mais senha mestra hardcoded. O app pede um "nome de usuário"
simples (tipo "Mario", sem @) na tela de login, mas por baixo dos panos isso
é sempre transformado num e-mail sintético fixo (`<usuário>@controle-estoque.local`
— ver `web/src/lib/loginEmail.ts`), porque o Supabase Auth só autentica por
e-mail. O primeiro acesso é manual:

0. Antes de tudo, em **Authentication → Settings**, desmarque **"Confirm
   email"** — os e-mails são sintéticos (`@controle-estoque.local`), não
   existe caixa de entrada de verdade pra receber o link de confirmação.
1. Em **Authentication → Users → Add user**, crie um usuário com e-mail
   `<seu-usuario-escolhido>@controle-estoque.local` (ex.:
   `admin@controle-estoque.local`) e uma senha seguindo o mesmo padrão de
   normalização do app (minúsculo, sem espaços/acentos) — marque "Auto
   Confirm User".
2. No **SQL Editor**, rode (troque o e-mail, o login e o nome):
   ```sql
   insert into profiles (id, login, nome, super_admin)
   values (
     (select id from auth.users where email = 'admin@controle-estoque.local'),
     'admin',           -- é isso que você vai digitar no campo "Usuário" pra logar
     'Seu Nome',
     true                -- super_admin: enxerga/administra todas as empresas
   );
   ```
3. Pronto — logue no painel web digitando `admin` (ou o usuário que você
   escolheu) + a senha. A partir daí, tudo mais (criar empresas, convidar
   usuários) é feito pela própria interface — os convites já cuidam de
   calcular o e-mail sintético de cada pessoa nova automaticamente.

## 3. Recriar os usuários antigos (Mario, Bianca, "Mario2")

As 3 linhas da tabela `usuarios` antiga **não são migradas automaticamente**
— a senha era um hash SHA-256 sem salt (não dá pra recuperar a senha
original, só o hash) e o `id=2` estava duplicado entre duas pessoas
diferentes (Bianca na empresa 1, "Mario2" na empresa 2), então não dá pra
saber com certeza qual delas é qual em registros antigos.

Fluxo (dentro do painel web novo, tela "Usuários", já com o super_admin
logado):
1. Criar um **convite** para cada pessoa (nome de usuário — ex. "mario" —,
   nome, empresa, papel — admin ou vendedor).
2. Avisar a pessoa (WhatsApp) para abrir a tela de cadastro com aquele MESMO
   nome de usuário e escolher a própria senha.
3. Ao se cadastrar, um trigger no banco (`handle_new_user`) liga
   automaticamente o cadastro ao convite e cria o `profile` certo — a pessoa
   já entra com o papel/empresa corretos, sem passo manual extra.

## 4. Tabela `usuarios` antiga

Depois de conferir que ninguém mais depende dela, pode ser renomeada
(`ALTER TABLE usuarios RENAME TO usuarios_legado;`) e mantida só como
referência histórica, ou apagada. Ela não é mais usada pelo app novo.
