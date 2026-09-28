import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Produto, VendaEfetivada } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Button, Card, Select, Spinner } from '../components/ui'

function mesAtual(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

export function RelatorioPage() {
  const { empresaAtiva, isAdmin, session } = useAuth()
  const [mes, setMes] = useState(mesAtual())
  const [vendedorId, setVendedorId] = useState('todos')
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([])
  const [vendas, setVendas] = useState<VendaEfetivada[]>([])
  const [produtosPorId, setProdutosPorId] = useState<Map<number, Produto>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!empresaAtiva || !isAdmin) return
    supabase
      .from('usuario_empresas')
      .select('profile_id')
      .eq('empresa_id', empresaAtiva.id)
      .then(async ({ data }) => {
        const ids = Array.from(new Set((data ?? []).map((d) => d.profile_id)))
        if (ids.length === 0) {
          setVendedores([])
          return
        }
        const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', ids)
        setVendedores((perfis ?? []).map((p) => ({ id: p.id as string, nome: p.nome as string })))
      })
  }, [empresaAtiva, isAdmin])

  async function carregar() {
    if (!empresaAtiva || !session) return
    setCarregando(true)
    setErro(null)

    const [ano, mesNum] = mes.split('-').map(Number)
    const inicio = new Date(ano, mesNum - 1, 1).toISOString()
    const fim = new Date(ano, mesNum, 1).toISOString()

    let query = supabase
      .from('vendasEfetivadas')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .gte('dataHora', inicio)
      .lt('dataHora', fim)
      .order('dataHora', { ascending: false })

    if (isAdmin) {
      if (vendedorId !== 'todos') query = query.eq('usuario_id', vendedorId)
    } else {
      query = query.eq('usuario_id', session.user.id)
    }

    const { data, error } = await query
    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    const produtoIds = Array.from(new Set((data ?? []).map((v) => v.produto_id)))
    let mapa = new Map<number, Produto>()
    if (produtoIds.length > 0) {
      const { data: produtosData } = await supabase.from('produtos').select('*').in('id', produtoIds)
      mapa = new Map((produtosData ?? []).map((p) => [p.id, p]))
    }
    setProdutosPorId(mapa)
    setVendas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id, mes, vendedorId])

  const total = useMemo(() => vendas.reduce((soma, v) => soma + v.valor_acertado * v.quantidade, 0), [vendas])

  function exportarExcel() {
    const linhas = vendas.map((v) => ({
      'Data/Hora': new Date(v.dataHora).toLocaleString('pt-BR'),
      Produto: produtosPorId.get(v.produto_id)?.nome ?? `#${v.produto_id}`,
      Quantidade: v.quantidade,
      'Valor Unitário': v.valor_acertado,
      'Valor Total': v.valor_acertado * v.quantidade,
      '% Desconto': v.perc_desc,
      Cliente: v.nomeCli,
    }))
    const planilha = XLSX.utils.json_to_sheet(linhas)
    const livro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(livro, planilha, 'Vendas')
    XLSX.writeFile(livro, `vendas-${mes}.xlsx`)
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Relatório de vendas</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Mês</span>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {isAdmin && (
            <Select
              label="Vendedor"
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              options={[{ value: 'todos', label: 'Todos' }, ...vendedores.map((v) => ({ value: v.id, label: v.nome }))]}
            />
          )}
          <Button variant="secondary" onClick={exportarExcel} disabled={vendas.length === 0}>
            Exportar Excel
          </Button>
        </div>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-sky-600" />
        </div>
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">{vendas.length} venda(s)</span>
            <span className="text-lg font-semibold text-slate-800">Total: {formatarMoeda(total)}</span>
          </Card>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Data/Hora</th>
                  <th className="px-4 py-2">Produto</th>
                  <th className="px-4 py-2">Qtd.</th>
                  <th className="px-4 py-2">Valor unit.</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Desc.</th>
                  <th className="px-4 py-2">Cliente</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-2">{new Date(v.dataHora).toLocaleString('pt-BR')}</td>
                    <td className="min-w-0 max-w-[220px] truncate px-4 py-2">{produtosPorId.get(v.produto_id)?.nome ?? `#${v.produto_id}`}</td>
                    <td className="px-4 py-2">{v.quantidade}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formatarMoeda(v.valor_acertado)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formatarMoeda(v.valor_acertado * v.quantidade)}</td>
                    <td className="px-4 py-2">{v.perc_desc}%</td>
                    <td className="min-w-0 max-w-[200px] truncate px-4 py-2">{v.nomeCli}</td>
                  </tr>
                ))}
                {vendas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma venda no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
