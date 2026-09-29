import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Produto } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Badge, Button, Card, Input, Spinner } from '../components/ui'
import { ProdutoFormModal } from '../components/ProdutoFormModal'

export function ProdutosAdminPage() {
  const { empresaAtiva, isAdmin } = useAuth()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function carregar() {
    if (!empresaAtiva) return
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase.from('produtos').select('*').eq('empresa_id', empresaAtiva.id).order('nome')
    if (error) setErro(error.message)
    setProdutos(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id])

  async function excluirOuInativar(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"?`)) return
    setErro(null)
    setMensagem(null)
    const { error } = await supabase.from('produtos').delete().eq('id', produto.id)
    if (!error) {
      setMensagem(`Produto "${produto.nome}" excluído.`)
      await carregar()
      return
    }
    // 23503 = violação de FK — produto já usado em alguma venda: em vez de
    // excluir, inativa (padrão "excluir ou inativar" usado no resto do sistema).
    if (error.code === '23503') {
      const { error: erroUpdate } = await supabase.from('produtos').update({ ativo: false }).eq('id', produto.id)
      if (erroUpdate) {
        setErro(erroUpdate.message)
        return
      }
      setMensagem(`"${produto.nome}" já foi usado em vendas — em vez de excluir, foi apenas inativado.`)
      await carregar()
      return
    }
    setErro(error.message)
  }

  const filtrados = produtos.filter((p) => {
    if (!busca.trim()) return true
    const alvo = `${p.nome} ${p.sku ?? ''}`.toLowerCase()
    return alvo.includes(busca.toLowerCase())
  })

  if (!isAdmin) {
    return <p className="py-12 text-center text-sm text-slate-500">Você não tem permissão para acessar esta tela.</p>
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Produtos</h1>
        <div className="flex gap-2">
          <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Button onClick={() => setEditando('novo')}>+ Novo</Button>
        </div>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {mensagem && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensagem}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-red-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => (
            <Card key={p.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {p.imagens_Path?.[0] ? (
                  <img src={p.imagens_Path[0]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">📦</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="min-w-0 truncate text-sm font-medium text-slate-800">{p.nome}</p>
                <p className="min-w-0 truncate text-xs text-slate-500">
                  {p.sku ?? 'sem SKU'} · {formatarMoeda(p.valor)} · estoque {p.quantidade}
                </p>
              </div>
              {!p.ativo && <Badge tone="slate">inativo</Badge>}
              <Button variant="secondary" onClick={() => setEditando(p)}>
                Editar
              </Button>
              <Button variant="danger" onClick={() => excluirOuInativar(p)}>
                Excluir
              </Button>
            </Card>
          ))}
          {filtrados.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Nenhum produto.</p>}
        </div>
      )}

      {editando && (
        <ProdutoFormModal
          produto={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}
    </div>
  )
}
