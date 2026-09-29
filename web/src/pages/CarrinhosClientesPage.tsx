import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CarrinhoPublicoItem, Produto } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Button, Card, Spinner } from '../components/ui'

interface ItemComProduto extends CarrinhoPublicoItem {
  produto?: Pick<Produto, 'nome' | 'descontoMax'>
}

interface Cliente {
  id: string
  nome: string
  whatsapp: string
  itens: ItemComProduto[]
}

function linkWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  return `https://wa.me/${digitos}`
}

// Tela do vendedor/admin: carrinhos de visitantes sem conta (nome + WhatsApp)
// pra negociar por fora e confirmar a venda daqui — desconto/valor acertado
// só é escrito por essas funções (RPC), o cliente nunca grava isso direto.
export function CarrinhosClientesPage() {
  const { empresaAtiva } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function carregar() {
    if (!empresaAtiva) return
    setCarregando(true)
    setErro(null)
    const { data: itens, error } = await supabase
      .from('carrinho_publico')
      .select('*, produto:produtos(nome, descontoMax)')
      .eq('empresa_id', empresaAtiva.id)
      .eq('status', 'pendente')
      .order('atualizado_em', { ascending: false })
    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    const clienteIds = Array.from(new Set((itens ?? []).map((i) => i.cliente_id)))
    let clientesPorId = new Map<string, { nome: string; whatsapp: string }>()
    if (clienteIds.length > 0) {
      const { data: dadosClientes } = await supabase.from('clientes_publicos').select('id, nome, whatsapp').in('id', clienteIds)
      clientesPorId = new Map((dadosClientes ?? []).map((c) => [c.id, c]))
    }

    const agrupado = new Map<string, Cliente>()
    for (const item of (itens ?? []) as ItemComProduto[]) {
      const dados = clientesPorId.get(item.cliente_id)
      if (!dados) continue
      if (!agrupado.has(item.cliente_id)) {
        agrupado.set(item.cliente_id, { id: item.cliente_id, nome: dados.nome, whatsapp: dados.whatsapp, itens: [] })
      }
      agrupado.get(item.cliente_id)!.itens.push(item)
    }
    setClientes(Array.from(agrupado.values()))
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id])

  async function aplicarDesconto(itemId: number, percDesc: number) {
    setErro(null)
    const { error } = await supabase.rpc('definir_desconto_publico', { p_id: itemId, p_perc_desc: percDesc })
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  async function confirmarVenda(clienteId: string) {
    if (!empresaAtiva) return
    if (!confirm('Confirmar a venda de todos os itens do carrinho deste cliente?')) return
    setErro(null)
    const { error } = await supabase.rpc('confirmar_carrinho_publico', {
      p_cliente_id: clienteId,
      p_empresa_id: empresaAtiva.id,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setMensagem('Venda confirmada.')
    window.setTimeout(() => setMensagem(null), 3000)
    await carregar()
  }

  if (!empresaAtiva) return null

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Carrinhos de clientes</h1>
      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {mensagem && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensagem}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-red-600" />
        </div>
      ) : clientes.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Nenhum carrinho de visitante no momento.</p>
      ) : (
        <div className="space-y-4">
          {clientes.map((cliente) => (
            <Card key={cliente.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{cliente.nome}</p>
                  <a
                    href={linkWhatsapp(cliente.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-green-700 hover:underline"
                  >
                    📱 {cliente.whatsapp}
                  </a>
                </div>
                <Button onClick={() => confirmarVenda(cliente.id)}>Confirmar venda</Button>
              </div>
              <div className="space-y-3">
                {cliente.itens.map((item) => (
                  <ItemLinha key={item.id} item={item} onAplicarDesconto={(perc) => aplicarDesconto(item.id, perc)} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemLinha({ item, onAplicarDesconto }: { item: ItemComProduto; onAplicarDesconto: (perc: number) => void }) {
  const descontoMax = item.produto?.descontoMax ?? 0
  const [desconto, setDesconto] = useState(item.perc_desc)
  const valorFinal = item.valor_acertado ?? item.valor_original

  return (
    <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          {item.quantidade}x {item.produto?.nome}
        </span>
        <span className="shrink-0 text-slate-500">{formatarMoeda(item.valor_original)} un.</span>
      </div>

      {descontoMax > 0 ? (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={descontoMax}
            step={0.1}
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value))}
            className="w-full accent-red-600"
          />
          <span className="w-14 shrink-0 text-right text-xs text-slate-500">{desconto.toFixed(1)}%</span>
          <Button variant="secondary" className="shrink-0" onClick={() => onAplicarDesconto(desconto)}>
            Aplicar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Este produto não permite desconto.</p>
      )}

      <p className="text-right font-semibold text-red-700">{formatarMoeda(valorFinal)}</p>
    </div>
  )
}
