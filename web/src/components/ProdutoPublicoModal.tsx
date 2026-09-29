import { useState } from 'react'
import type { ProdutoPublico } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import type { ClientePublico } from '../lib/clientePublico'
import { definirItemCarrinhoPublico } from '../lib/clientePublico'
import { Badge, Button, LightboxImagem, Modal } from './ui'

interface Props {
  produto: ProdutoPublico
  onClose: () => void
  onAdicionado: () => void
  // Garante que exista um cliente identificado antes de prosseguir — se
  // ainda não tem cadastro, o pai mostra a tela "Identifique-se" e só
  // resolve quando a pessoa concluir (ou nunca resolve, se ela desistir).
  exigirCliente: () => Promise<ClientePublico>
}

// Visualização pública (sem login) de um produto: preço, imagens e estoque
// disponível, com opção de montar um "carrinho de interesse" — sem desconto
// (isso só o vendedor define depois, por fora, no WhatsApp).
export function ProdutoPublicoModal({ produto, onClose, onAdicionado, exigirCliente }: Props) {
  const imagens = produto.imagens_Path ?? []
  const [indiceImagem, setIndiceImagem] = useState(0)
  const [expandida, setExpandida] = useState(false)
  const [quantidade, setQuantidade] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const semEstoque = produto.quantidade <= 0

  async function adicionar() {
    setSalvando(true)
    setErro(null)
    try {
      const cliente = await exigirCliente()
      await definirItemCarrinhoPublico({
        clienteId: cliente.id,
        empresaId: produto.empresa_id,
        produtoId: produto.id,
        quantidade,
        valorOriginal: produto.valor,
      })
      onAdicionado()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível adicionar ao carrinho.')
    } finally {
      setSalvando(false)
    }
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

          {!semEstoque && (
            <>
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
              {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
              <Button full disabled={salvando} onClick={adicionar}>
                {salvando ? 'Adicionando…' : 'Adicionar ao carrinho'}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
