import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sessaoClientePublicoAtual } from '../lib/clientePublico'
import type { CarrinhoPublicoItem, ProdutoPublico } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Badge, Button, Card, Modal, Spinner } from './ui'

interface ItemComProduto extends CarrinhoPublicoItem {
  produto?: Pick<ProdutoPublico, 'nome' | 'imagens_Path'>
}

interface Props {
  onClose: () => void
}

// Carrinho do visitante: lê os itens pendentes e escuta mudanças em tempo
// real (Realtime) — quando o vendedor definir um desconto pelo WhatsApp, o
// valor aparece aqui sozinho, sem precisar recarregar a página.
export function MeuCarrinhoPublicoModal({ onClose }: Props) {
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [itens, setItens] = useState<ItemComProduto[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar(id: string) {
    const { data } = await supabase
      .from('carrinho_publico')
      .select('*, produto:produtos(nome, imagens_Path)')
      .eq('cliente_id', id)
      .eq('status', 'pendente')
      .order('id')
    setItens((data as ItemComProduto[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    let ativo = true
    sessaoClientePublicoAtual().then((id) => {
      if (!ativo) return
      setClienteId(id)
      if (id) carregar(id)
      else setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!clienteId) return
    const canal = supabase
      .channel(`carrinho-publico-${clienteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carrinho_publico', filter: `cliente_id=eq.${clienteId}` },
        () => carregar(clienteId),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const total = itens.reduce((soma, item) => soma + (item.valor_acertado ?? item.valor_original) * item.quantidade, 0)

  return (
    <Modal open onClose={onClose} title="Meu carrinho" footer={null}>
      {carregando ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-red-600" />
        </div>
      ) : itens.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Seu carrinho está vazio.</p>
      ) : (
        <div className="space-y-3">
          {itens.map((item) => {
            const negociado = item.valor_acertado != null
            return (
              <Card key={item.id} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {item.produto?.imagens_Path?.[0] ? (
                    <img src={item.produto.imagens_Path[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">📦</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-800">{item.produto?.nome}</p>
                  <p className="text-xs text-slate-500">{item.quantidade}x</p>
                </div>
                <div className="shrink-0 text-right">
                  {negociado ? (
                    <>
                      <p className="text-xs text-slate-400 line-through">{formatarMoeda(item.valor_original * item.quantidade)}</p>
                      <p className="text-sm font-semibold text-green-700">
                        {formatarMoeda(item.valor_acertado! * item.quantidade)}
                      </p>
                      <Badge tone="green">preço combinado</Badge>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800">{formatarMoeda(item.valor_original * item.quantidade)}</p>
                  )}
                </div>
              </Card>
            )
          })}

          <div className="rounded-lg bg-slate-50 p-3 text-right">
            <span className="text-sm text-slate-500">Total: </span>
            <span className="text-lg font-semibold text-red-700">{formatarMoeda(total)}</span>
          </div>

          <p className="text-center text-xs text-slate-400">
            Fale com a loja pelo WhatsApp pra combinar valores e fechar a compra.
          </p>
          <Button full variant="secondary" onClick={onClose}>
            Continuar comprando
          </Button>
        </div>
      )}
    </Modal>
  )
}
