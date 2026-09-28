import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Produto } from '../lib/types'
import { formatarMoeda, normalizarBusca } from '../lib/format'
import { Badge, Card, Input, Select, Spinner } from '../components/ui'
import { ProdutoDetalheModal } from '../components/ProdutoDetalheModal'

export function CatalogoPage() {
  const { empresaAtiva } = useAuth()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function carregar() {
    if (!empresaAtiva) return
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .eq('ativo', true)
      .order('nome')
    if (error) setErro(error.message)
    setProdutos(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const p of produtos) {
      if (p.categoria) set.add(p.categoria)
    }
    return Array.from(set).sort()
  }, [produtos])

  const filtrados = useMemo(() => {
    const buscaNormalizada = normalizarBusca(busca)
    return produtos.filter((p) => {
      if (categoria && p.categoria !== categoria) return false
      if (!buscaNormalizada) return true
      const alvo = normalizarBusca(`${p.nome} ${p.sku ?? ''}`)
      return alvo.includes(buscaNormalizada)
    })
  }, [produtos, busca, categoria])

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input placeholder="Buscar por nome ou SKU…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="sm:w-56">
          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Todas as categorias"
            options={categorias.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {mensagem && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensagem}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-red-600" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtrados.map((p) => (
            <Card key={p.id} className="p-3">
              <button className="flex w-full flex-col gap-2 text-left" onClick={() => setProdutoSelecionado(p)}>
                <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {p.imagens_Path?.[0] ? (
                    <img src={p.imagens_Path[0]} alt={p.nome} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">📦</div>
                  )}
                </div>
                <p className="min-w-0 truncate text-sm font-medium text-slate-800">{p.nome}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-red-700">{formatarMoeda(p.valor)}</span>
                  <Badge tone={p.quantidade > 0 ? 'green' : 'red'}>{p.quantidade > 0 ? `${p.quantidade} un.` : 'sem estoque'}</Badge>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {produtoSelecionado && (
        <ProdutoDetalheModal
          produto={produtoSelecionado}
          onClose={() => setProdutoSelecionado(null)}
          onAdicionado={() => {
            setProdutoSelecionado(null)
            setMensagem('Produto adicionado ao carrinho.')
            window.setTimeout(() => setMensagem(null), 3000)
          }}
        />
      )}
    </div>
  )
}
