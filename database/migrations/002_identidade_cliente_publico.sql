-- -----------------------------------------------------------------------------
-- 002: identidade do cliente publico pelo WHATSAPP, nao pela sessao anonima
-- -----------------------------------------------------------------------------
-- Bug relatado: 2 cadastros em clientes_publicos com mesmo nome/whatsapp.
-- Causa raiz: garantirClientePublico() so checava "ja existe uma linha para
-- ESTE auth.uid()" -- se o visitante troca de navegador, limpa dados do site,
-- ou a sessao anonima expira e o supabase-js cria outra, o auth.uid() muda e
-- o codigo (corretamente, dentro da logica que tinha) conclui que e' gente
-- nova e insere de novo, com o mesmo nome/telefone. O numero de whatsapp e' a
-- identidade real da pessoa; o auth.uid() e' so o "crachA" da sessao atual.
--
-- Rodar isto INTEIRO no SQL Editor do Supabase, depois do 001.
-- -----------------------------------------------------------------------------

-- 1) Limpar duplicatas ja existentes: para cada whatsapp com mais de um
--    cadastro, mantem o mais antigo (canonico), migra os itens de carrinho
--    dos outros pra ele e apaga os cadastros extras.
DO $$
DECLARE
  grp RECORD;
  canonico UUID;
  duplicado UUID;
BEGIN
  FOR grp IN
    SELECT regexp_replace(whatsapp, '\D', '', 'g') AS whatsapp_norm
    FROM clientes_publicos
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    SELECT id INTO canonico
      FROM clientes_publicos
      WHERE regexp_replace(whatsapp, '\D', '', 'g') = grp.whatsapp_norm
      ORDER BY criado_em ASC
      LIMIT 1;

    FOR duplicado IN
      SELECT id FROM clientes_publicos
      WHERE regexp_replace(whatsapp, '\D', '', 'g') = grp.whatsapp_norm AND id <> canonico
    LOOP
      -- Migra so os itens que nao colidem com algo que o canonico ja tem
      -- daquele produto (respeita a UNIQUE(cliente_id, produto_id)); o raro
      -- caso de colisao fica com o item do canonico, o do duplicado e' apagado.
      UPDATE carrinho_publico cp SET cliente_id = canonico
        WHERE cp.cliente_id = duplicado
          AND NOT EXISTS (
            SELECT 1 FROM carrinho_publico cp2
            WHERE cp2.cliente_id = canonico AND cp2.produto_id = cp.produto_id
          );
      DELETE FROM carrinho_publico WHERE cliente_id = duplicado;
      DELETE FROM clientes_publicos WHERE id = duplicado;
    END LOOP;
  END LOOP;
END $$;

-- 2) Coluna normalizada (so digitos) + indice UNICO -- trava estruturalmente
--    a duplicata na origem, nao so no codigo do app.
ALTER TABLE clientes_publicos
  ADD COLUMN IF NOT EXISTS whatsapp_normalizado TEXT
  GENERATED ALWAYS AS (regexp_replace(whatsapp, '\D', '', 'g')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_publicos_whatsapp_unico
  ON clientes_publicos (whatsapp_normalizado);

-- 3) A FK de carrinho_publico precisa acompanhar se o id do cadastro mudar de
--    dono (passo 4 abaixo recupera a identidade antiga fazendo isso).
ALTER TABLE carrinho_publico DROP CONSTRAINT carrinho_publico_cliente_id_fkey;
ALTER TABLE carrinho_publico ADD CONSTRAINT carrinho_publico_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes_publicos(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Substitui o "select-then-insert" feito no cliente por uma funcao atomica:
--    se ja existe cadastro com esse whatsapp (de QUALQUER sessao anterior),
--    reaproveita a identidade -- move o id dela pra sessao atual (auth.uid()),
--    arrastando o historico de carrinho junto via ON UPDATE CASCADE acima.
--    So insere de verdade quando o whatsapp e' inedito.
CREATE OR REPLACE FUNCTION identificar_cliente_publico(p_nome TEXT, p_whatsapp TEXT)
RETURNS clientes_publicos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_whatsapp_norm TEXT := regexp_replace(p_whatsapp, '\D', '', 'g');
  v_nome TEXT := trim(p_nome);
  v_whatsapp TEXT := trim(p_whatsapp);
  v_existente clientes_publicos%ROWTYPE;
BEGIN
  IF v_whatsapp_norm = '' THEN
    RAISE EXCEPTION 'Whatsapp invalido';
  END IF;

  SELECT * INTO v_existente FROM clientes_publicos WHERE whatsapp_normalizado = v_whatsapp_norm;

  IF v_existente.id IS NOT NULL THEN
    IF v_existente.id <> auth.uid() THEN
      UPDATE clientes_publicos SET id = auth.uid(), nome = v_nome
        WHERE id = v_existente.id
        RETURNING * INTO v_existente;
    END IF;
    RETURN v_existente;
  END IF;

  INSERT INTO clientes_publicos (id, nome, whatsapp) VALUES (auth.uid(), v_nome, v_whatsapp)
    RETURNING * INTO v_existente;
  RETURN v_existente;
END;
$$;
REVOKE ALL ON FUNCTION identificar_cliente_publico(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION identificar_cliente_publico(TEXT, TEXT) TO authenticated;

-- 5) Pedido do usuario: vendedor/admin precisa poder esvaziar o carrinho de um
--    cliente sem confirmar venda (ex.: negociacao caiu, cliente desistiu).
--    So mexe nos itens 'pendente' daquela empresa -- nao apaga historico de
--    venda ja confirmada.
CREATE OR REPLACE FUNCTION esvaziar_carrinho_publico(p_cliente_id UUID, p_empresa_id INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT eh_super_admin() AND papel_na_empresa(p_empresa_id) IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  DELETE FROM carrinho_publico
    WHERE cliente_id = p_cliente_id AND empresa_id = p_empresa_id AND status = 'pendente';
END;
$$;
REVOKE ALL ON FUNCTION esvaziar_carrinho_publico(UUID, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION esvaziar_carrinho_publico(UUID, INT) TO authenticated;
