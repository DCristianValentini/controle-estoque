import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Produto } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Badge, Button, LightboxImagem, Modal } from './ui'

interface Props {
  produto: Produto
  onClose: () => void
  onAdicionado: () => void
}

export function ProdutoDetalheModal({ produto, onClose, onAdicionado }: Props) {
  const { empresaAtiva, session } = useAuth()
  const imagens = produto.imagens_Path ?? []
  const [indiceImagem, setIndiceImagem] = useState(0)
  const [expandida, setExpandida] = useState(false)
  const [quantidade, setQuantidade] = useState(1)
  const [desconto, setDesconto] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const semEstoque = produto.quantidade <= 0
  const valorUnitarioComDesconto = produto.valor * (1 - desconto / 100)
  const valorTotal = valorUnitarioComDesconto * quantidade

  async function adicionar() {
    if (!empresaAtiva || !session) return
    setSalvando(true)
    setErro(null)
    const { error } = await supabase.from('carrinho').upsert(
      {
        empresa_id: empresaAtiva.id,
        usuario_id: session.user.id,
        produto_id: produto.id,
        quantidade,
        valor_acertado: valorUnitarioComDesconto,
        perc_desc: desconto,
      },
      { onConflict: 'empresa_id,usuario_id,produto_id' },
    )
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    onAdicionado()
  }

  return (
    <>
    {expandida && imagens[indiceImagem] && (
      <LightboxImagem src={imagens[indiceImagem]} onClose={() => setExpandida(false)} />
    )}
    <Modal open onClose={onClose} title={produto.nome} wide>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => imagens.length > 0 && setExpandida(true)}
          className="block h-64 w-full cursor-zoom-in overflow-hidden rounded-lg bg-slate-100 sm:h-80"
          aria-label="Ver imagem em tamanho maior"
        >
          {imagens.length > 0 ? (
            <img src={imagens[indiceImagem]} alt={produto.nome} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl">📦</div>
          )}
        </button>

        {imagens.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {imagens.map((src, i) => (
              <button
                key={src}
                onClick={() => setIndiceImagem(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                  i === indiceImagem ? 'border-red-500' : 'border-transparent'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {produto.sku && <p className="text-xs text-slate-400">SKU: {produto.sku}</p>}
        {produto.descricao && <p className="text-sm text-slate-600">{produto.descricao}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-semibold text-slate-800">{formatarMoeda(produto.valor)}</span>
          <Badge tone={semEstoque ? 'red' : 'green'}>{semEstoque ? 'sem estoque' : `${produto.quantidade} em estoque`}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Quantidade</span>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} disabled={quantidade <= 1}>
                −
              </Button>
              <span className="w-8 text-center text-lg font-medium">{quantidade}</span>
              <Button
                variant="secondary"
                onClick={() => setQuantidade((q) => Math.min(produto.quantidade, q + 1))}
                disabled={quantidade >= produto.quantidade}
              >
                +
              </Button>
            </div>
          </div>

          {produto.descontoMax > 0 && (
            <div className="min-w-0">
              <div className="mb-1 flex justify-between text-sm font-medium text-slate-700">
                <span>Desconto</span>
                <span>{desconto.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={produto.descontoMax}
                step={0.1}
                value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value))}
                className="w-full accent-red-600"
              />
              <p className="mt-1 text-xs text-slate-400">Máximo permitido: {produto.descontoMax}%</p>
            </div>
          )}
        </div>

        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
          <span className="min-w-0 truncate">
            <span className="text-sm text-slate-500">Total: </span>
            <span className="text-lg font-semibold text-red-700">{formatarMoeda(valorTotal)}</span>
          </span>
          <Button className="shrink-0" disabled={salvando || semEstoque} onClick={adicionar}>
            {salvando ? 'Adicionando…' : semEstoque ? 'Sem estoque' : 'Adicionar ao carrinho'}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  )
}
