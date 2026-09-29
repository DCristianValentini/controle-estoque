import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useClientePublico } from '../lib/ClientePublicoContext'
import type { Empresa, ProdutoPublico } from '../lib/types'
import { formatarMoeda, normalizarBusca } from '../lib/format'
import { Badge, Card, Input, Select, Spinner } from '../components/ui'
import { ProdutoPublicoModal } from '../components/ProdutoPublicoModal'
import logoUrl from '../assets/branding/logo.webp'

type Ordenacao = 'nome-asc' | 'nome-desc' | 'preco-asc' | 'preco-desc'

// Catálogo visível sem login: /  (escolher loja) e /loja/:empresaId
// (catálogo daquela loja). Visitante vê preço/imagens/estoque, mas não vê
// desconto. Pra montar carrinho (e pra ver o próprio carrinho) precisa se
// identificar antes — tela dedicada "Identifique-se" (ClientePublicoContext),
// nunca um formulário encaixado dentro do produto.
export function CatalogoPublicoPage() {
  const { empresaId: empresaIdParam } = useParams()
  const navigate = useNavigate()
  const { clienteAtual, contadorCarrinho, exigirCliente, atualizarContador } = useClientePublico()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)

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

  const empresaAtiva = empresas.find((e) => String(e.id) === empresaIdParam) ?? null

  async function abrirCarrinho() {
    await exigirCliente()
    navigate('/meu-carrinho')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
          {empresaAtiva && (
            <>
              <span className="min-w-0 truncate font-medium text-slate-800">{empresaAtiva.nome}</span>
              <button
                onClick={() => navigate('/')}
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Trocar loja
              </button>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {clienteAtual && <span className="hidden text-sm text-slate-500 sm:inline">Olá, {clienteAtual.nome}</span>}
          <button onClick={abrirCarrinho} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Meu carrinho">
            🛒
            {contadorCarrinho > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
                {contadorCarrinho}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Entrar
          </button>
        </div>
      </header>

      <main className="p-4 lg:p-6">
        {carregandoEmpresas ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6 text-red-600" />
          </div>
        ) : !empresaAtiva ? (
          <SelecaoLoja empresas={empresas} onEscolher={(id) => navigate(`/loja/${id}`)} />
        ) : (
          <CatalogoDaLoja empresaId={empresaAtiva.id} exigirCliente={exigirCliente} onAdicionadoAoCarrinho={atualizarContador} />
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

const OPCOES_ORDENACAO: { value: Ordenacao; label: string }[] = [
  { value: 'nome-asc', label: 'Nome (A-Z)' },
  { value: 'nome-desc', label: 'Nome (Z-A)' },
  { value: 'preco-asc', label: 'Menor preço' },
  { value: 'preco-desc', label: 'Maior preço' },
]

function CatalogoDaLoja({
  empresaId,
  exigirCliente,
  onAdicionadoAoCarrinho,
}: {
  empresaId: number
  exigirCliente: ReturnType<typeof useClientePublico>['exigirCliente']
  onAdicionadoAoCarrinho: () => void
}) {
  const [produtos, setProdutos] = useState<ProdutoPublico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('nome-asc')
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
    const lista = produtos.filter((p) => {
      if (categoria && p.categoria !== categoria) return false
      if (!buscaNormalizada) return true
      const alvo = normalizarBusca(`${p.nome} ${p.sku ?? ''}`)
      return alvo.includes(buscaNormalizada)
    })
    const ordenada = [...lista]
    ordenada.sort((a, b) => {
      switch (ordenacao) {
        case 'nome-desc':
          return b.nome.localeCompare(a.nome, 'pt-BR')
        case 'preco-asc':
          return a.valor - b.valor
        case 'preco-desc':
          return b.valor - a.valor
        default:
          return a.nome.localeCompare(b.nome, 'pt-BR')
      }
    })
    return ordenada
  }, [produtos, busca, categoria, ordenacao])

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
        <div className="sm:w-48">
          <Select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as Ordenacao)} options={OPCOES_ORDENACAO} />
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
          onAdicionado={() => {
            setProdutoSelecionado(null)
            onAdicionadoAoCarrinho()
          }}
          exigirCliente={exigirCliente}
        />
      )}
    </div>
  )
}
