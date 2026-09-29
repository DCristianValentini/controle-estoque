-- =============================================================================
-- Controle de Estoque — migração de correção do schema (rodar no SQL Editor
-- do Supabase do projeto Sandiz, uma única vez, dentro de uma transação).
--
-- Contexto: produtos/usuarios/empresa tinham "id" gerado no CLIENTE
-- (MAX(id)+1 escopado por empresa) + upsert merge-duplicates -> isso permitiu
-- que a empresa 2 sobrescrevesse silenciosamente os produtos da empresa 1
-- (confirmado: as 284 linhas atuais de produtos sao todas empresa_id=2) e
-- criou duas linhas com usuarios.id=2 pertencendo a pessoas diferentes
-- (Bianca na empresa 1, "Mario2" na empresa 2) porque usuarios.id nunca teve
-- restricao de unicidade real.
--
-- Esta migracao: (1) corrige as PKs para serem geradas pelo Postgres,
-- (2) substitui a autenticacao por Supabase Auth (bcrypt de verdade, sem
-- senha mestra hardcoded), (3) permite um mesmo usuario acessar VARIAS
-- empresas (cada vinculo com seu proprio papel: admin ou vendedor),
-- (4) liga RLS em tudo (hoje nao ha RLS nenhuma — e por isso a anon key
-- le/escreve tudo), (5) cria a funcao atomica de confirmacao de venda.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EMPRESA — vira PK de verdade (so tinha 2 linhas, sem colisao aqui)
-- -----------------------------------------------------------------------------
-- Defensivo: em varios projetos Supabase o editor de tabelas ja cria "id"
-- como PK + identity por padrao (foi o caso aqui — descoberto so na hora de
-- rodar). Os blocos abaixo pulam o que ja existir em vez de falhar.
DO $$ BEGIN
  ALTER TABLE empresa ADD CONSTRAINT empresa_pkey PRIMARY KEY (id);
EXCEPTION WHEN invalid_table_definition THEN
  RAISE NOTICE 'empresa: ja tinha PK, ok';
END $$;
DO $$ BEGIN
  ALTER TABLE empresa ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (START WITH 3);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'empresa.id: ja e identity (ou ja tem default), ok (%: %)', SQLSTATE, SQLERRM;
END $$;
-- Resincroniza a sequencia MESMO se a identity ja existia de antes: quando o
-- cliente manda um "id" explicito no INSERT (era exatamente o bug), a
-- sequencia da identity NAO avanca sozinha — sem isso o proximo INSERT sem
-- id explicito podia sortear um numero baixo ja usado, reabrindo o mesmo bug.
SELECT setval(pg_get_serial_sequence('empresa', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 0) FROM empresa), 2), true);
ALTER TABLE empresa ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;  -- inativar (nao apagar) bloqueia o acesso, ver funcoes abaixo

-- -----------------------------------------------------------------------------
-- 2. PRODUTOS — vira PK de verdade, continua sequencial a partir do maior id
--    atual (284). Os 284 produtos existentes sao mantidos como estao — sao
--    dados legitimos da empresa 2, so a empresa 1 e que foi perdida (sem
--    backup disponivel para recuperar).
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE produtos ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);
EXCEPTION WHEN invalid_table_definition THEN
  RAISE NOTICE 'produtos: ja tinha PK, ok';
END $$;
DO $$ BEGIN
  ALTER TABLE produtos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (START WITH 285);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'produtos.id: ja e identity (ou ja tem default), ok (%: %)', SQLSTATE, SQLERRM;
END $$;
-- Mesmo motivo do resync de empresa acima: garante que o proximo produto
-- criado nunca saia com um id ja usado, independente do estado anterior da
-- sequencia.
SELECT setval(pg_get_serial_sequence('produtos', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 0) FROM produtos), 284), true);

-- -----------------------------------------------------------------------------
-- 3. USUARIOS antigo -> Supabase Auth + profiles + usuario_empresas
--
--    A tabela `usuarios` antiga (id int SEM pk real, nome, empresa_id fixo,
--    senha sha256, admin bool) e substituida por:
--      - auth.users        (identidade + senha, gerenciado pelo Supabase)
--      - profiles          (id uuid = auth.users.id; nome; super_admin bool
--                            -- dados GLOBAIS da pessoa, sem empresa)
--      - usuario_empresas   (profile_id, empresa_id, papel) -- vinculo N:N:
--                            um mesmo usuario pode ter acesso a varias
--                            empresas, com papel independente em cada uma
--                            (ex.: admin na loja 1, vendedor na loja 2).
--      - convites           (fluxo de criacao de usuario sem precisar de
--                            service_role: admin cria um convite por e-mail
--                            com a lista de empresas+papeis; a pessoa se
--                            cadastra com esse e-mail; um trigger cria o
--                            profile e os vinculos automaticamente).
--
--    As 3 linhas antigas de `usuarios` (Mario/empresa1, Bianca/empresa1,
--    "Mario2"/empresa2 com id=2 duplicado e ambiguo) NAO sao migradas
--    automaticamente — precisam ser recriadas manualmente via convite (ver
--    README-migracao.md), ja que nao da pra saber com certeza a senha
--    original (era sha256 sem salt, e o id=2 esta ambiguo entre 2 pessoas).
-- -----------------------------------------------------------------------------

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login TEXT NOT NULL UNIQUE,   -- nome de usuario (o que a pessoa digita pra entrar, sem @)
  nome TEXT NOT NULL,
  super_admin BOOLEAN NOT NULL DEFAULT false,   -- enxerga/administra TODAS as empresas
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuario_empresas (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  empresa_id INT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('admin','vendedor')),
  PRIMARY KEY (profile_id, empresa_id)
);

CREATE TABLE convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT NOT NULL,   -- nome de usuario escolhido pelo admin (a pessoa convidada precisa digitar EXATAMENTE isso no cadastro)
  email TEXT NOT NULL,   -- e-mail sintetico ja calculado no cliente a partir do login (ex.: mario@controle-estoque.local) -- so existe pra bater com o auth.users, ninguem digita
  nome TEXT NOT NULL,
  empresas JSONB NOT NULL,   -- [{"empresa_id":1,"papel":"admin"}, {"empresa_id":2,"papel":"vendedor"}]
  usado BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX convites_email_pendente ON convites (lower(email)) WHERE usado = false;

-- Helpers de RLS (SECURITY DEFINER pra poder ler profiles/usuario_empresas
-- mesmo com RLS ligada nelas, sem recursao infinita de policy)
CREATE OR REPLACE FUNCTION eh_super_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT super_admin FROM profiles WHERE id = auth.uid()), false);
$$;

-- Ambas so enxergam empresa ATIVA: inativar uma empresa (super_admin) corta
-- na hora o acesso de quem tem vinculo com ela (produtos/carrinho/vendas
-- ficam bloqueados em cascata, ja que todas as outras policies dependem
-- dessas duas funcoes).
CREATE OR REPLACE FUNCTION papel_na_empresa(p_empresa_id INT) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ue.papel FROM usuario_empresas ue
    JOIN empresa e ON e.id = ue.empresa_id
    WHERE ue.profile_id = auth.uid() AND ue.empresa_id = p_empresa_id AND e.ativo = true;
$$;

CREATE OR REPLACE FUNCTION minhas_empresas() RETURNS SETOF INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ue.empresa_id FROM usuario_empresas ue
    JOIN empresa e ON e.id = ue.empresa_id
    WHERE ue.profile_id = auth.uid() AND e.ativo = true;
$$;

-- Valida (fora do super_admin) que quem cria um convite so oferece acesso a
-- empresas onde ELE MESMO e admin — sem isso, RLS sozinha nao consegue
-- checar dentro do array JSONB de forma simples.
CREATE OR REPLACE FUNCTION valida_convite() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT eh_super_admin() THEN
    FOR r IN SELECT * FROM jsonb_to_recordset(NEW.empresas) AS x(empresa_id INT, papel TEXT) LOOP
      IF papel_na_empresa(r.empresa_id) IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Sem permissao de admin na empresa %', r.empresa_id;
      END IF;
    END LOOP;
  END IF;
  NEW.criado_por := auth.uid();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_valida_convite BEFORE INSERT ON convites
  FOR EACH ROW EXECUTE FUNCTION valida_convite();

-- Quando alguem se cadastra (supabase.auth.signUp) com um e-mail que tem
-- convite pendente, cria o profile e os vinculos usuario_empresas certos.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_convite convites%ROWTYPE;
  r RECORD;
BEGIN
  SELECT * INTO v_convite FROM convites
    WHERE lower(email) = lower(NEW.email) AND usado = false
    ORDER BY criado_em DESC LIMIT 1;

  IF v_convite.id IS NOT NULL THEN
    INSERT INTO profiles (id, login, nome, super_admin) VALUES (NEW.id, v_convite.login, v_convite.nome, false);
    FOR r IN SELECT * FROM jsonb_to_recordset(v_convite.empresas) AS x(empresa_id INT, papel TEXT) LOOP
      INSERT INTO usuario_empresas (profile_id, empresa_id, papel) VALUES (NEW.id, r.empresa_id, r.papel);
    END LOOP;
    UPDATE convites SET usado = true WHERE id = v_convite.id;
  END IF;
  -- sem convite pendente: usuario fica sem profile -> RLS bloqueia tudo
  -- (login funciona, mas nao enxerga nenhuma empresa/produto/etc.)
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. CARRINHO e VENDAS — trocam usuario_id (int, apontava pro usuarios antigo)
--    por usuario_id (uuid, aponta pra profiles). Como as tabelas antigas tem
--    poucas linhas (carrinho esta vazio hoje; vendasEfetivadas tem poucas
--    vendas historicas com usuario_id ja ambiguo por causa do bug), apenas
--    zeramos o carrinho (nao ha carrinho aberto hoje) e preservamos
--    vendasEfetivadas como historico "congelado" (usuario_id antigo vira uma
--    coluna de arquivo, sem FK, ja que nao da pra mapear com confianca).
--    empresa_id continua em cada linha — e o que diz "essa venda/item e da
--    loja X", mesmo que o usuario tenha acesso a varias.
-- -----------------------------------------------------------------------------

TRUNCATE carrinho;
ALTER TABLE carrinho
  DROP COLUMN usuario_id,
  ADD COLUMN usuario_id UUID REFERENCES profiles(id),
  ADD COLUMN id BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD CONSTRAINT carrinho_item_unico UNIQUE (empresa_id, usuario_id, produto_id);
-- Defensivo (mesmo motivo de empresa/produtos): se a tabela ja tiver PK numa
-- outra coluna (ex.: um id oculto que o app antigo nunca lia), "id" so fica
-- como identity sem ser PK formal — funciona igual pra tudo que o app usa.
DO $$ BEGIN
  ALTER TABLE carrinho ADD CONSTRAINT carrinho_pkey PRIMARY KEY (id);
EXCEPTION WHEN invalid_table_definition THEN
  RAISE NOTICE 'carrinho: ja tinha PK em outra coluna, "id" fica so como identity, sem PK formal - ok';
END $$;

ALTER TABLE "vendasEfetivadas"
  RENAME COLUMN usuario_id TO usuario_id_legado;
-- a coluna renomeada fazia parte da PK original da tabela (composta) -- por
-- isso nao da so pra tirar o NOT NULL, precisa derrubar essa PK antiga
-- primeiro (coluna de PK nunca pode ser nula em Postgres). Descobre o nome
-- da constraint dinamicamente (varia por instalacao) e remove.
DO $$
DECLARE pk_antiga TEXT;
BEGIN
  SELECT conname INTO pk_antiga FROM pg_constraint
    WHERE conrelid = '"vendasEfetivadas"'::regclass AND contype = 'p';
  IF pk_antiga IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "vendasEfetivadas" DROP CONSTRAINT %I', pk_antiga);
    RAISE NOTICE 'vendasEfetivadas: PK antiga % removida', pk_antiga;
  END IF;
END $$;
-- agora sim: sem PK nenhuma travando, a coluna pode ficar nula (vendas novas
-- nao tem "id antigo" nenhum -- confirmar_venda() nao escreve nela).
ALTER TABLE "vendasEfetivadas" ALTER COLUMN usuario_id_legado DROP NOT NULL;
ALTER TABLE "vendasEfetivadas"
  ADD COLUMN usuario_id UUID REFERENCES profiles(id),
  ADD COLUMN id BIGINT GENERATED ALWAYS AS IDENTITY;
ALTER TABLE "vendasEfetivadas" ADD CONSTRAINT vendas_pkey PRIMARY KEY (id);
COMMENT ON COLUMN "vendasEfetivadas".usuario_id_legado IS
  'ID antigo (int) do app FlutterFlow — AMBIGUO para usuario_id=2 (Bianca ou Mario2, ver bug de duplicidade). Mantido só como referência histórica, sem FK.';

-- -----------------------------------------------------------------------------
-- 5. RLS — ligada em tudo. Sem excecao: qualquer tabela nova precisa ganhar
--    politica explicita, senao fica bloqueada por padrao (fail-closed).
-- -----------------------------------------------------------------------------
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrinho ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendasEfetivadas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;

-- profiles: cada um ve o proprio; super_admin ve todos; admin ve quem
-- compartilha alguma empresa onde ele e admin
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR eh_super_admin()
  OR EXISTS (
    SELECT 1 FROM usuario_empresas mine
    JOIN usuario_empresas theirs ON theirs.empresa_id = mine.empresa_id
    WHERE mine.profile_id = auth.uid() AND mine.papel = 'admin' AND theirs.profile_id = profiles.id
  )
);
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (id = auth.uid());

-- usuario_empresas: visivel pro proprio usuario, super_admin, ou admin da
-- mesma empresa (pra gerenciar a equipe); escrita so super_admin/admin da empresa
CREATE POLICY usuario_empresas_select ON usuario_empresas FOR SELECT USING (
  profile_id = auth.uid() OR eh_super_admin() OR papel_na_empresa(empresa_id) = 'admin'
);
CREATE POLICY usuario_empresas_write ON usuario_empresas FOR ALL USING (
  eh_super_admin() OR papel_na_empresa(empresa_id) = 'admin'
);

-- convites: super_admin ve/cria todos; admin ve/cria os que ele mesmo criou
CREATE POLICY convites_select ON convites FOR SELECT USING (
  eh_super_admin() OR criado_por = auth.uid()
);
CREATE POLICY convites_insert ON convites FOR INSERT WITH CHECK (true); -- checagem real esta no trigger valida_convite

-- empresa: super_admin ve/edita todas; demais so leem as que tem vinculo
CREATE POLICY empresa_select ON empresa FOR SELECT USING (
  eh_super_admin() OR id IN (SELECT minhas_empresas())
);
CREATE POLICY empresa_write ON empresa FOR ALL USING (eh_super_admin());

-- produtos: leitura por quem tem vinculo com a empresa (qualquer papel);
-- escrita so quem e admin (ou super_admin) NAQUELA empresa especifica
CREATE POLICY produtos_select ON produtos FOR SELECT USING (
  eh_super_admin() OR empresa_id IN (SELECT minhas_empresas())
);
CREATE POLICY produtos_insert ON produtos FOR INSERT WITH CHECK (
  eh_super_admin() OR papel_na_empresa(empresa_id) = 'admin'
);
CREATE POLICY produtos_update ON produtos FOR UPDATE USING (
  eh_super_admin() OR papel_na_empresa(empresa_id) = 'admin'
);
CREATE POLICY produtos_delete ON produtos FOR DELETE USING (
  eh_super_admin() OR papel_na_empresa(empresa_id) = 'admin'
);

-- carrinho: cada usuario mexe so no proprio, e so em empresa onde tem vinculo
CREATE POLICY carrinho_dono ON carrinho FOR ALL USING (
  usuario_id = auth.uid() AND (eh_super_admin() OR papel_na_empresa(empresa_id) IS NOT NULL)
) WITH CHECK (
  usuario_id = auth.uid() AND (eh_super_admin() OR papel_na_empresa(empresa_id) IS NOT NULL)
);

-- vendasEfetivadas: leitura por quem vendeu, ou admin/super_admin da empresa;
-- NENHUMA politica de INSERT/UPDATE/DELETE direto -- so a funcao
-- confirmar_venda() (SECURITY DEFINER) pode gravar.
CREATE POLICY vendas_select ON "vendasEfetivadas" FOR SELECT USING (
  eh_super_admin() OR papel_na_empresa(empresa_id) = 'admin' OR usuario_id = auth.uid()
);

-- -----------------------------------------------------------------------------
-- 6. Trava a anon key de vez: sem sessao autenticada, nada e visivel.
-- -----------------------------------------------------------------------------
REVOKE ALL ON empresa, produtos, carrinho, "vendasEfetivadas", profiles, usuario_empresas, convites
  FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON empresa, produtos, carrinho, "vendasEfetivadas", profiles, usuario_empresas, convites
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Funcao atomica de confirmacao de venda. Recebe a empresa explicitamente
--    (o usuario pode ter carrinho aberto em mais de uma empresa ao mesmo tempo).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_venda(p_empresa_id INT, p_nome_cliente TEXT)
RETURNS TABLE(venda_id BIGINT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  item RECORD;
  v_venda_id BIGINT;
BEGIN
  IF NOT eh_super_admin() AND papel_na_empresa(p_empresa_id) IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a empresa %', p_empresa_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM carrinho WHERE usuario_id = v_usuario_id AND empresa_id = p_empresa_id) THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  FOR item IN
    SELECT c.produto_id, c.quantidade, c.valor_acertado, c.perc_desc,
           p.quantidade AS estoque, p."descontoMax" AS desconto_max
    FROM carrinho c
    JOIN produtos p ON p.id = c.produto_id
    WHERE c.usuario_id = v_usuario_id AND c.empresa_id = p_empresa_id
    FOR UPDATE OF p
  LOOP
    IF item.perc_desc > item.desconto_max THEN
      RAISE EXCEPTION 'Desconto % acima do maximo permitido (%) para o produto %',
        item.perc_desc, item.desconto_max, item.produto_id;
    END IF;

    UPDATE produtos SET quantidade = quantidade - item.quantidade
      WHERE id = item.produto_id AND quantidade >= item.quantidade;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', item.produto_id;
    END IF;

    INSERT INTO "vendasEfetivadas"
      (empresa_id, usuario_id, produto_id, quantidade, valor_acertado, perc_desc, "dataHora", "nomeCli")
      VALUES (p_empresa_id, v_usuario_id, item.produto_id, item.quantidade,
              item.valor_acertado, item.perc_desc, now(), p_nome_cliente)
      RETURNING id INTO v_venda_id;
  END LOOP;

  DELETE FROM carrinho WHERE usuario_id = v_usuario_id AND empresa_id = p_empresa_id;
  venda_id := v_venda_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION confirmar_venda(INT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION confirmar_venda(INT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Storage (bucket imagensProdutos) — leitura publica (mantem URLs antigas
--    funcionando, todas sob o prefixo "public/"). Novos uploads vao para
--    "<empresa_id>/<random8>.webp" (fica facil restringir escrita por
--    empresa lendo o 1o segmento do path); escrita so pra quem e admin
--    (ou super_admin) naquela empresa.
-- -----------------------------------------------------------------------------
CREATE POLICY imagens_leitura_publica ON storage.objects FOR SELECT
  USING (bucket_id = 'imagensProdutos');

CREATE POLICY imagens_escrita_admin ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'imagensProdutos'
  AND (eh_super_admin() OR papel_na_empresa(NULLIF((storage.foldername(name))[1], 'public')::int) = 'admin')
);
CREATE POLICY imagens_update_admin ON storage.objects FOR UPDATE USING (
  bucket_id = 'imagensProdutos'
  AND (eh_super_admin() OR papel_na_empresa(NULLIF((storage.foldername(name))[1], 'public')::int) = 'admin')
);
CREATE POLICY imagens_delete_admin ON storage.objects FOR DELETE USING (
  bucket_id = 'imagensProdutos' AND eh_super_admin()
  -- delete de foto vinculada (dentro de "public/") fica restrito a super_admin
  -- de proposito -- e a pasta com os 176 orfaos, remover de la e definitivo.
  OR (bucket_id = 'imagensProdutos'
      AND papel_na_empresa(NULLIF((storage.foldername(name))[1], 'public')::int) = 'admin')
);

-- -----------------------------------------------------------------------------
-- 9. Catalogo publico (sem login) -- visitante pode ver produtos (preco,
--    imagens, quantidade em estoque) de uma empresa ativa, SEM ver desconto
--    maximo nem custo, e sem poder escrever nada. A view roda com os
--    privilegios de quem a criou (dono da tabela, que ignora RLS por
--    padrao no Postgres/Supabase) -- e assim que da pra expor so ALGUMAS
--    colunas de uma tabela que continua trancada por RLS pra escrita.
-- -----------------------------------------------------------------------------
CREATE VIEW produtos_publico AS
SELECT p.id, p.empresa_id, p.sku, p.nome, p.descricao, p.quantidade,
       p.valor, p."imagens_Path", p.categoria
FROM produtos p
JOIN empresa e ON e.id = p.empresa_id
WHERE p.ativo = true AND e.ativo = true;

GRANT SELECT ON produtos_publico TO anon;

-- Visitante precisa listar as empresas ativas pra escolher qual loja ver
-- (so id/nome/ativo -- nao tem nada sensivel nessa tabela mesmo pra quem
-- esta logado).
GRANT SELECT ON empresa TO anon;
CREATE POLICY empresa_select_publico ON empresa FOR SELECT TO anon USING (ativo = true);

-- -----------------------------------------------------------------------------
-- 10. Carrinho de cliente (lead) -- visitante sem conta se identifica (nome +
--     whatsapp) via login anonimo do Supabase Auth (signInAnonymously -- da
--     um auth.uid() de verdade, sem senha, que e a base de toda a seguranca
--     daqui pra baixo: "e o dono desse carrinho" = "auth.uid() bate"). Monta
--     um carrinho, o vendedor/admin ve numa tela propria com o contato,
--     negocia por fora (whatsapp) e so ELE consegue definir desconto/valor
--     acertado e confirmar a venda -- o cliente nunca escreve nessas colunas,
--     so le (via Realtime, a tela dele atualiza sozinha quando o vendedor mexe).
--
--     REQUISITO NO PAINEL DO SUPABASE: Authentication -> Settings -> habilitar
--     "Allow anonymous sign-ins" (desligado por padrao).
-- -----------------------------------------------------------------------------

-- Identidade do cliente e' unica pra TODAS as lojas (pedido explicito do
-- usuario: "o login serve pra todas as lojas") -- por isso sem empresa_id
-- aqui; quem sabe de qual loja e' cada item e' o carrinho_publico, nao o
-- cadastro da pessoa.
CREATE TABLE clientes_publicos (
  id UUID PRIMARY KEY,   -- = auth.uid() da sessao anonima, nunca gerado a parte
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carrinho_publico (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes_publicos(id) ON DELETE CASCADE,
  empresa_id INT NOT NULL REFERENCES empresa(id),
  produto_id INT NOT NULL REFERENCES produtos(id),
  quantidade INT NOT NULL CHECK (quantidade > 0),
  valor_original NUMERIC NOT NULL,     -- preco de tabela no momento que o cliente adicionou
  valor_acertado NUMERIC,               -- NULL ate o vendedor negociar; so ele escreve aqui
  perc_desc NUMERIC NOT NULL DEFAULT 0, -- so o vendedor escreve; cliente nunca manda isso
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado')),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, produto_id)
);

ALTER TABLE clientes_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrinho_publico ENABLE ROW LEVEL SECURITY;

-- clientes_publicos: cliente cria/ve so o proprio registro; vendedor/admin
-- ve quem tem item de carrinho na PROPRIA empresa (a pessoa pode ter
-- comprado em varias lojas com o mesmo cadastro -- so aparece pra quem
-- tem vinculo com a loja daquele item especifico).
CREATE POLICY clientes_publicos_self_insert ON clientes_publicos FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY clientes_publicos_select ON clientes_publicos FOR SELECT USING (
  id = auth.uid()
  OR eh_super_admin()
  OR EXISTS (
    SELECT 1 FROM carrinho_publico cp
    WHERE cp.cliente_id = clientes_publicos.id AND papel_na_empresa(cp.empresa_id) IS NOT NULL
  )
);

-- carrinho_publico: cliente so insere/le/apaga o proprio (apagar = tirar item
-- do carrinho, so enquanto pendente); NUNCA tem UPDATE liberado pra ele --
-- por isso valor_acertado/perc_desc so mudam pelas funcoes de vendedor abaixo.
CREATE POLICY carrinho_publico_cliente_insert ON carrinho_publico FOR INSERT
  WITH CHECK (cliente_id = auth.uid());
CREATE POLICY carrinho_publico_select ON carrinho_publico FOR SELECT USING (
  cliente_id = auth.uid() OR eh_super_admin() OR papel_na_empresa(empresa_id) IS NOT NULL
);
CREATE POLICY carrinho_publico_cliente_delete ON carrinho_publico FOR DELETE USING (
  cliente_id = auth.uid() AND status = 'pendente'
);

REVOKE ALL ON clientes_publicos, carrinho_publico FROM anon;
GRANT SELECT, INSERT, DELETE ON clientes_publicos, carrinho_publico TO authenticated;
-- (sessao anonima do Supabase Auth usa o papel "authenticated" com claim
-- is_anonymous=true -- so nao tem GRANT de UPDATE em carrinho_publico, que e
-- exatamente o que impede o cliente de mexer em valor_acertado/perc_desc)

-- Cliente ajusta a propria quantidade (unica coisa que pode mudar depois de
-- inserido, sem precisar apagar e recriar o item).
CREATE OR REPLACE FUNCTION atualizar_quantidade_publico(p_id BIGINT, p_quantidade INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_quantidade <= 0 THEN
    DELETE FROM carrinho_publico WHERE id = p_id AND cliente_id = auth.uid() AND status = 'pendente';
    RETURN;
  END IF;
  UPDATE carrinho_publico SET quantidade = p_quantidade, atualizado_em = now()
    WHERE id = p_id AND cliente_id = auth.uid() AND status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item nao encontrado ou nao pertence a este carrinho';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION atualizar_quantidade_publico(BIGINT, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION atualizar_quantidade_publico(BIGINT, INT) TO authenticated;

-- Vendedor/admin define o desconto negociado (por fora, no whatsapp) pra um
-- item do carrinho de um cliente. Valida contra o descontoMax do produto,
-- igual a venda normal.
CREATE OR REPLACE FUNCTION definir_desconto_publico(p_id BIGINT, p_perc_desc NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item RECORD;
BEGIN
  SELECT cp.*, p.valor, p."descontoMax" AS desconto_max INTO item
    FROM carrinho_publico cp JOIN produtos p ON p.id = cp.produto_id
    WHERE cp.id = p_id;
  IF item.id IS NULL THEN
    RAISE EXCEPTION 'Item nao encontrado';
  END IF;
  IF NOT eh_super_admin() AND papel_na_empresa(item.empresa_id) IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a empresa deste carrinho';
  END IF;
  IF p_perc_desc < 0 OR p_perc_desc > item.desconto_max THEN
    RAISE EXCEPTION 'Desconto % fora do permitido (max %)', p_perc_desc, item.desconto_max;
  END IF;
  UPDATE carrinho_publico
    SET perc_desc = p_perc_desc, valor_acertado = item.valor * (1 - p_perc_desc / 100), atualizado_em = now()
    WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION definir_desconto_publico(BIGINT, NUMERIC) FROM public, anon;
GRANT EXECUTE ON FUNCTION definir_desconto_publico(BIGINT, NUMERIC) TO authenticated;

-- Vendedor/admin confirma a venda de um carrinho de cliente inteiro --
-- mesma logica atomica de confirmar_venda (valida estoque, debita, grava
-- vendasEfetivadas), so que a origem e carrinho_publico e quem "vendeu"
-- (usuario_id em vendasEfetivadas) e o vendedor logado, nao o cliente.
-- Recebe a empresa explicitamente: como o cadastro do cliente agora vale
-- pra qualquer loja, ele pode ter itens pendentes em mais de uma empresa ao
-- mesmo tempo -- confirmar so processa os itens DAQUELA loja.
CREATE OR REPLACE FUNCTION confirmar_carrinho_publico(p_cliente_id UUID, p_empresa_id INT)
RETURNS TABLE(venda_id BIGINT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome_cliente TEXT;
  item RECORD;
  v_venda_id BIGINT;
BEGIN
  SELECT nome INTO v_nome_cliente FROM clientes_publicos WHERE id = p_cliente_id;
  IF v_nome_cliente IS NULL THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;
  IF NOT eh_super_admin() AND papel_na_empresa(p_empresa_id) IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM carrinho_publico WHERE cliente_id = p_cliente_id AND empresa_id = p_empresa_id AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  FOR item IN
    SELECT cp.id, cp.produto_id, cp.quantidade, cp.valor_original, cp.valor_acertado, cp.perc_desc
    FROM carrinho_publico cp
    WHERE cp.cliente_id = p_cliente_id AND cp.empresa_id = p_empresa_id AND cp.status = 'pendente'
    FOR UPDATE
  LOOP
    UPDATE produtos SET quantidade = quantidade - item.quantidade
      WHERE id = item.produto_id AND quantidade >= item.quantidade;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', item.produto_id;
    END IF;

    INSERT INTO "vendasEfetivadas"
      (empresa_id, usuario_id, produto_id, quantidade, valor_acertado, perc_desc, "dataHora", "nomeCli")
      VALUES (p_empresa_id, auth.uid(), item.produto_id, item.quantidade,
              COALESCE(item.valor_acertado, item.valor_original), item.perc_desc, now(), v_nome_cliente)
      RETURNING id INTO v_venda_id;

    UPDATE carrinho_publico SET status = 'confirmado', atualizado_em = now() WHERE id = item.id;
  END LOOP;

  venda_id := v_venda_id;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_carrinho_publico(UUID, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION confirmar_carrinho_publico(UUID, INT) TO authenticated;

-- Realtime: a tela do cliente escuta mudancas no proprio carrinho (pra ver o
-- desconto/valor aparecer sozinho quando o vendedor negociar).
ALTER PUBLICATION supabase_realtime ADD TABLE carrinho_publico;

COMMIT;

-- =============================================================================
-- DEPOIS DE RODAR ISSO: siga o README-migracao.md na mesma pasta para:
--  1. Criar o primeiro super_admin (convite + cadastro).
--  2. Recriar os usuarios (Mario, Bianca, Mario2) via convite, com senha nova
--     e, se fizer sentido, acesso as duas empresas de uma vez.
--  3. A antiga tabela `usuarios` pode ser renomeada usuarios_legado ou
--     apagada depois de conferir que nada mais referencia ela.
-- =============================================================================
