import { useState } from 'react'
import type { ProdutoPublico } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { Badge, LightboxImagem, Modal } from './ui'

interface Props {
  produto: ProdutoPublico
  onClose: () => void
}

// Visualização pública (sem login) de um produto: só imagem, preço e
// estoque disponível — sem desconto, sem carrinho. Quem quiser comprar
// precisa entrar (botão "Entrar" no topo do catálogo público).
export function ProdutoPublicoModal({ produto, onClose }: Props) {
  const imagens = produto.imagens_Path ?? []
  const [indiceImagem, setIndiceImagem] = useState(0)
  const [expandida, setExpandida] = useState(false)
  const semEstoque = produto.quantidade <= 0

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
                  <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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

          <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">
            Entre com sua conta pra adicionar ao carrinho e comprar.
          </p>
        </div>
      </Modal>
    </>
  )
}
