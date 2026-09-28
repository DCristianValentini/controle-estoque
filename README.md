# Controle de Estoque

Reescrita do app de controle de estoque/vendas da Sandiz — React + Supabase, sem backend próprio.

Projeto **totalmente independente** de qualquer outro sistema: banco de dados, autenticação e deploy são só dele.

## Estrutura

- **`web/`** — painel único (Vite + React + TypeScript + Tailwind). Cobre catálogo, carrinho, venda, relatório de vendas e cadastros (empresas, usuários, produtos), com controle de acesso por Row Level Security no Postgres. Build (`npm run build`) gera um `dist/index.html` **único e autocontido** — pode ser enviado ao cliente e aberto direto no navegador, sem instalar nada, ou hospedado via GitHub Pages.
- **`database/migrations/`** — SQL de correção do schema (o bug original: IDs gerados no cliente, sem Row Level Security) e `README-migracao.md` com o passo a passo pra aplicar no projeto Supabase existente.
- **`mobile/`** — app do vendedor (Capacitor + React), reaproveitando a mesma lógica do painel web.

## Rodando localmente

```bash
cd web
npm install
cp .env.local.example .env.local   # preencha com a URL/anon key do projeto Supabase
npm run dev
```

## Publicando pro cliente

```bash
cd web
npm run build
# dist/index.html é o arquivo único a enviar/hospedar
```

Veja `database/migrations/README-migracao.md` antes do primeiro uso — a migração precisa rodar no Supabase antes do app funcionar de verdade.
