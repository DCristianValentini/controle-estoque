import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useClientePublico } from '../lib/ClientePublicoContext'
import type { CarrinhoPublicoItem, ProdutoPublico } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Badge, Button, Card, Modal, Spinner } from './ui'

interface ItemComProduto extends CarrinhoPublicoItem {
  produto?: Pick<ProdutoPublico, 'nome' | 'imagens_Path'>
}

interface Props {
  clienteId: string
  onClose: () => void
}

// Carrinho do visitante já identificado: lê os itens pendentes, deixa
// editar quantidade ou remover, e escuta mudanças em tempo real (Realtime)
// — quando o vendedor definir um desconto pelo WhatsApp, o valor aparece
// aqui sozinho, sem precisar recarregar a página.
export function MeuCarrinhoPublicoModal({ clienteId, onClose }: Props) {
  const { sairComoCliente } = useClientePublico()
  const [itens, setItens] = useState<ItemComProduto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function sair() {
    if (!confirm('Sair do seu cadastro? Na próxima vez vai precisar se identificar de novo.')) return
    await sairComoCliente()
    onClose()
  }

  async function carregar() {
    const { data } = await supabase
      .from('carrinho_publico')
      .select('*, produto:produtos(nome, imagens_Path)')
      .eq('cliente_id', clienteId)
      .eq('status', 'pendente')
      .order('id')
    setItens((data as ItemComProduto[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  useEffect(() => {
    const canal = supabase
      .channel(`carrinho-publico-${clienteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carrinho_publico', filter: `cliente_id=eq.${clienteId}` },
        () => carregar(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  async function alterarQuantidade(itemId: number, novaQuantidade: number) {
    setErro(null)
    const { error } = await supabase.rpc('atualizar_quantidade_publico', { p_id: itemId, p_quantidade: novaQuantidade })
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  const total = itens.reduce((soma, item) => soma + (item.valor_acertado ?? item.valor_original) * item.quantidade, 0)

  return (
    <Modal open onClose={onClose} title="Meu carrinho" footer={null}>
      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {carregando ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-red-600" />
        </div>
      ) : itens.length === 0 ? (
        <div className="space-y-4">
          <p className="py-8 text-center text-sm text-slate-500">Seu carrinho está vazio.</p>
          <button onClick={sair} className="block w-full text-center text-xs text-slate-400 hover:underline">
            Sair do meu cadastro
          </button>
        </div>
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
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => alterarQuantidade(item.id, item.quantidade - 1)}
                      disabled={item.quantidade <= 1}
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm">{item.quantidade}</span>
                    <button
                      onClick={() => alterarQuantidade(item.id, item.quantidade + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                    <button
                      onClick={() => alterarQuantidade(item.id, 0)}
                      className="ml-1 text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
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
          <button onClick={sair} className="block w-full text-center text-xs text-slate-400 hover:underline">
            Sair do meu cadastro
          </button>
        </div>
      )}
    </Modal>
  )
}
