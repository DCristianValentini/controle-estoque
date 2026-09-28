# Como aplicar a migração

## 1. Rodar o SQL

Abra o projeto Supabase da Sandiz → **SQL Editor** → cole o conteúdo de
`001_schema_fix.sql` → Run. É uma transação só (`BEGIN`/`COMMIT`): se algo
falhar no meio, nada é aplicado.

Eu (Claude) não consigo rodar isso sozinho — só tenho a `anon key` (que dá
para ler/escrever linhas via REST, mas não executa DDL). Precisa ser você,
logado no painel do Supabase, ou alguém com acesso a ele.

## 2. Criar o primeiro super_admin

Não existe mais senha mestra hardcoded. O primeiro acesso é manual:

1. No painel do Supabase → **Authentication → Users → Add user** → crie um
   usuário com seu e-mail e uma senha (marque "Auto Confirm User").
2. No **SQL Editor**, rode (troque o e-mail e o nome):
   ```sql
   insert into profiles (id, empresa_id, papel, nome)
   values (
     (select id from auth.users where email = 'seu-email@exemplo.com'),
     null,              -- null = super_admin, enxerga todas as empresas
     'super_admin',
     'Seu Nome'
   );
   ```
3. Pronto — logue no painel web com esse e-mail/senha. A partir daí, tudo
   mais (criar empresas, convidar usuários) é feito pela própria interface.

## 3. Recriar os usuários antigos (Mario, Bianca, "Mario2")

As 3 linhas da tabela `usuarios` antiga **não são migradas automaticamente**
— a senha era um hash SHA-256 sem salt (não dá pra recuperar a senha
original, só o hash) e o `id=2` estava duplicado entre duas pessoas
diferentes (Bianca na empresa 1, "Mario2" na empresa 2), então não dá pra
saber com certeza qual delas é qual em registros antigos.

Fluxo (dentro do painel web novo, tela "Usuários", já com o super_admin
logado):
1. Criar um **convite** para cada pessoa (e-mail, nome, empresa, papel —
   admin ou vendedor).
2. Avisar a pessoa (WhatsApp/e-mail) para abrir a tela de cadastro com
   aquele e-mail exato e escolher a própria senha.
3. Ao se cadastrar, um trigger no banco (`handle_new_user`) liga
   automaticamente o cadastro ao convite e cria o `profile` certo — a pessoa
   já entra com o papel/empresa corretos, sem passo manual extra.

## 4. Tabela `usuarios` antiga

Depois de conferir que ninguém mais depende dela, pode ser renomeada
(`ALTER TABLE usuarios RENAME TO usuarios_legado;`) e mantida só como
referência histórica, ou apagada. Ela não é mais usada pelo app novo.
