import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sessaoClientePublicoAtual } from '../lib/clientePublico'
import type { Empresa, ProdutoPublico } from '../lib/types'
import { formatarMoeda, normalizarBusca } from '../lib/format'
import { Badge, Card, Input, Select, Spinner } from '../components/ui'
import { ProdutoPublicoModal } from '../components/ProdutoPublicoModal'
import { MeuCarrinhoPublicoModal } from '../components/MeuCarrinhoPublicoModal'
import logoUrl from '../assets/branding/logo.webp'

interface Props {
  onEntrar: () => void
}

// Catálogo visível sem login: visitante escolhe a loja, vê preço/imagens/
// estoque de cada produto, mas não vê desconto nem consegue comprar — só
// "Entrar" (topo direito) libera carrinho e desconto.
export function CatalogoPublicoPage({ onEntrar }: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const [mostrarCarrinho, setMostrarCarrinho] = useState(false)
  const [contadorCarrinho, setContadorCarrinho] = useState(0)

  useEffect(() => {
    supabase
      .from('empresa')
      .select('id, nome, ativo')
      .order('nome')
      .then(({ data }) => {
        setEmpresas(data ?? [])
        setCarregandoEmpresas(false)
      })
  }, [])

  async function atualizarContador() {
    const clienteId = await sessaoClientePublicoAtual()
    if (!clienteId) return
    const { count } = await supabase
      .from('carrinho_publico')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('status', 'pendente')
    setContadorCarrinho(count ?? 0)
  }

  useEffect(() => {
    atualizarContador()
  }, [])

  const empresaAtiva = empresas.find((e) => e.id === empresaId) ?? null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
          {empresaAtiva && (
            <>
              <span className="min-w-0 truncate font-medium text-slate-800">{empresaAtiva.nome}</span>
              <button
                onClick={() => setEmpresaId(null)}
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Trocar loja
              </button>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setMostrarCarrinho(true)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Meu carrinho"
          >
            🛒
            {contadorCarrinho > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
                {contadorCarrinho}
              </span>
            )}
          </button>
          <button
            onClick={onEntrar}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Entrar
          </button>
        </div>
      </header>

      {mostrarCarrinho && (
        <MeuCarrinhoPublicoModal
          onClose={() => {
            setMostrarCarrinho(false)
            atualizarContador()
          }}
        />
      )}

      <main className="p-4 lg:p-6">
        {carregandoEmpresas ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6 text-red-600" />
          </div>
        ) : !empresaAtiva ? (
          <SelecaoLoja empresas={empresas} onEscolher={setEmpresaId} />
        ) : (
          <CatalogoDaLoja empresaId={empresaAtiva.id} onAdicionadoAoCarrinho={atualizarContador} />
        )}
      </main>
    </div>
  )
}

function SelecaoLoja({ empresas, onEscolher }: { empresas: Empresa[]; onEscolher: (id: number) => void }) {
  return (
    <div className="mx-auto max-w-md pt-8 text-center">
      <h1 className="mb-1 text-lg font-semibold text-slate-800">Escolha a loja</h1>
      <p className="mb-6 text-sm text-slate-500">Veja o catálogo sem precisar entrar com uma conta.</p>
      <div className="space-y-2">
        {empresas.map((e) => (
          <Card key={e.id} className="flex items-center justify-between">
            <span className="font-medium text-slate-800">{e.nome}</span>
            <button
              onClick={() => onEscolher(e.id)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Ver produtos
            </button>
          </Card>
        ))}
        {empresas.length === 0 && <p className="text-sm text-slate-500">Nenhuma loja disponível no momento.</p>}
      </div>
    </div>
  )
}

function CatalogoDaLoja({
  empresaId,
  onAdicionadoAoCarrinho,
}: {
  empresaId: number
  onAdicionadoAoCarrinho: () => void
}) {
  const [produtos, setProdutos] = useState<ProdutoPublico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoPublico | null>(null)

  useEffect(() => {
    setCarregando(true)
    supabase
      .from('produtos_publico')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome')
      .then(({ data }) => {
        setProdutos(data ?? [])
        setCarregando(false)
      })
  }, [empresaId])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const p of produtos) if (p.categoria) set.add(p.categoria)
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
                    <img
                      src={p.imagens_Path[0]}
                      alt={p.nome}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
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
        <ProdutoPublicoModal
          produto={produtoSelecionado}
          onClose={() => setProdutoSelecionado(null)}
          onAdicionado={onAdicionadoAoCarrinho}
        />
      )}
    </div>
  )
}
