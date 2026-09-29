import { supabase } from './supabase'

// Identidade do visitante sem conta: login anônimo do Supabase Auth (sem
// senha) — dá um auth.uid() de verdade, que é a base de toda a segurança do
// carrinho público (RLS: "é dono do carrinho" = "auth.uid() bate"). Fica
// persistido pelo próprio supabase-js (localStorage), sobrevive a reload.

export interface ClientePublico {
  id: string
  nome: string
  whatsapp: string
}

export async function sessaoClientePublicoAtual(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || !session.user.is_anonymous) return null
  return session.user.id
}

export async function obterClientePublicoAtual(): Promise<ClientePublico | null> {
  const clienteId = await sessaoClientePublicoAtual()
  if (!clienteId) return null
  const { data } = await supabase.from('clientes_publicos').select('*').eq('id', clienteId).maybeSingle()
  return data
}

// Garante uma sessão anônima + registro em clientes_publicos. O cadastro é
// único pra qualquer loja (pedido do usuário: "o login serve pra todas as
// lojas") — se já existe (retornando de outra visita, ou trocando de loja),
// não sobrescreve nome/whatsapp, só reaproveita.
export async function garantirClientePublico(nome: string, whatsapp: string): Promise<ClientePublico> {
  const {
    data: { session: sessaoAtual },
  } = await supabase.auth.getSession()
  let session = sessaoAtual

  if (!session || !session.user.is_anonymous) {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    session = data.session
  }
  if (!session) throw new Error('Não foi possível iniciar sua identificação como cliente.')

  const { data: existente } = await supabase.from('clientes_publicos').select('*').eq('id', session.user.id).maybeSingle()
  if (existente) return existente

  const nomeFinal = nome.trim()
  const whatsappFinal = whatsapp.trim()
  const { error } = await supabase
    .from('clientes_publicos')
    .insert({ id: session.user.id, nome: nomeFinal, whatsapp: whatsappFinal })
  if (error) throw error
  return { id: session.user.id, nome: nomeFinal, whatsapp: whatsappFinal }
}

// Adiciona/atualiza um item do carrinho público. Igual ao carrinho interno:
// reenviar o mesmo produto substitui a quantidade, não soma.
export async function definirItemCarrinhoPublico(params: {
  clienteId: string
  empresaId: number
  produtoId: number
  quantidade: number
  valorOriginal: number
}): Promise<void> {
  const { clienteId, empresaId, produtoId, quantidade, valorOriginal } = params
  const { data: existente } = await supabase
    .from('carrinho_publico')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('produto_id', produtoId)
    .maybeSingle()

  if (existente) {
    const { error } = await supabase.rpc('atualizar_quantidade_publico', { p_id: existente.id, p_quantidade: quantidade })
    if (error) throw error
    return
  }

  const { error } = await supabase.from('carrinho_publico').insert({
    cliente_id: clienteId,
    empresa_id: empresaId,
    produto_id: produtoId,
    quantidade,
    valor_original: valorOriginal,
  })
  if (error) throw error
}
