import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CarrinhoItem, Produto } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Button, Card, Input, Spinner } from '../components/ui'

interface ItemComProduto extends CarrinhoItem {
  produto?: Produto
}

export function CarrinhoPage() {
  const { empresaAtiva, session } = useAuth()
  const [itens, setItens] = useState<ItemComProduto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nomeCliente, setNomeCliente] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)

  async function carregar() {
    if (!empresaAtiva || !session) return
    setCarregando(true)
    setErro(null)
    const { data: itensData, error } = await supabase
      .from('carrinho')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .eq('usuario_id', session.user.id)
      .order('id')
    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    const produtoIds = Array.from(new Set((itensData ?? []).map((i) => i.produto_id)))
    let produtosPorId = new Map<number, Produto>()
    if (produtoIds.length > 0) {
      const { data: produtosData } = await supabase.from('produtos').select('*').in('id', produtoIds)
      produtosPorId = new Map((produtosData ?? []).map((p) => [p.id, p]))
    }
    setItens((itensData ?? []).map((i) => ({ ...i, produto: produtosPorId.get(i.produto_id) })))
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id, session?.user.id])

  async function removerItem(id: number) {
    setErro(null)
    const { error } = await supabase.from('carrinho').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  async function esvaziar() {
    if (!empresaAtiva || !session) return
    if (!confirm('Esvaziar o carrinho?')) return
    setErro(null)
    const { error } = await supabase
      .from('carrinho')
      .delete()
      .eq('empresa_id', empresaAtiva.id)
      .eq('usuario_id', session.user.id)
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  async function confirmarVenda() {
    if (!empresaAtiva) return
    if (!nomeCliente.trim()) {
      setErro('Informe o nome do cliente.')
      return
    }
    setConfirmando(true)
    setErro(null)
    setSucesso(null)
    const { error } = await supabase.rpc('confirmar_venda', {
      p_empresa_id: empresaAtiva.id,
      p_nome_cliente: nomeCliente.trim(),
    })
    setConfirmando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setSucesso('Venda confirmada com sucesso!')
    setNomeCliente('')
    await carregar()
  }

  const total = itens.reduce((soma, item) => soma + item.valor_acertado * item.quantidade, 0)

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-red-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Carrinho</h1>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {sucesso && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sucesso}</p>}

      {itens.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Seu carrinho está vazio.</p>
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <Card key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {item.produto?.imagens_Path?.[0] ? (
                  <img src={item.produto.imagens_Path[0]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">📦</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="min-w-0 truncate text-sm font-medium text-slate-800">
                  {item.produto?.nome ?? `Produto #${item.produto_id}`}
                </p>
                <p className="text-xs text-slate-500">
                  {item.quantidade}× {formatarMoeda(item.valor_acertado)}
                  {item.perc_desc > 0 && ` (${item.perc_desc}% desc.)`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">{formatarMoeda(item.valor_acertado * item.quantidade)}</p>
                <button onClick={() => removerItem(item.id)} className="text-xs text-red-600 hover:underline">
                  Remover
                </button>
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <button onClick={esvaziar} className="text-sm text-red-600 hover:underline">
              Esvaziar carrinho
            </button>
            <p className="text-lg font-semibold text-slate-800">Total: {formatarMoeda(total)}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Input label="Nome do cliente" required value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
            <Button full disabled={confirmando} onClick={confirmarVenda}>
              {confirmando ? 'Confirmando…' : 'Confirmar venda'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
