import { useEffect, useState } from 'react'
import type { ProdutoPublico } from '../lib/types'
import { formatarMoeda } from '../lib/format'
import { garantirClientePublico, obterClientePublicoAtual, definirItemCarrinhoPublico } from '../lib/clientePublico'
import { Badge, Button, Input, LightboxImagem, Modal } from './ui'

interface Props {
  produto: ProdutoPublico
  onClose: () => void
  onAdicionado: () => void
}

// Visualização pública (sem login) de um produto: preço, imagens e estoque
// disponível, com opção de montar um "carrinho de interesse" — sem desconto
// (isso só o vendedor define depois, por fora, no WhatsApp).
export function ProdutoPublicoModal({ produto, onClose, onAdicionado }: Props) {
  const imagens = produto.imagens_Path ?? []
  const [indiceImagem, setIndiceImagem] = useState(0)
  const [expandida, setExpandida] = useState(false)
  const [quantidade, setQuantidade] = useState(1)
  const [precisaCadastro, setPrecisaCadastro] = useState(false)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const semEstoque = produto.quantidade <= 0

  useEffect(() => {
    obterClientePublicoAtual().then((cliente) => setPrecisaCadastro(!cliente))
  }, [])

  async function adicionar(nomeParam?: string, whatsappParam?: string) {
    setSalvando(true)
    setErro(null)
    try {
      const clienteId = await garantirClientePublico(produto.empresa_id, nomeParam ?? nome, whatsappParam ?? whatsapp)
      await definirItemCarrinhoPublico({
        clienteId,
        empresaId: produto.empresa_id,
        produtoId: produto.id,
        quantidade,
        valorOriginal: produto.valor,
      })
      setPrecisaCadastro(false)
      onAdicionado()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível adicionar ao carrinho.')
    } finally {
      setSalvando(false)
    }
  }

  function aoEnviarCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !whatsapp.trim()) {
      setErro('Preencha nome e WhatsApp.')
      return
    }
    adicionar(nome, whatsapp)
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

          {semEstoque ? null : precisaCadastro ? (
            <form onSubmit={aoEnviarCadastro} className="space-y-3 rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-600">
                Pra montar um carrinho e falar com a loja, informe seu nome e WhatsApp:
              </p>
              <Input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Input placeholder="WhatsApp (com DDD)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              {erro && <p className="text-sm text-red-700">{erro}</p>}
              <Button type="submit" full disabled={salvando}>
                {salvando ? 'Enviando…' : 'Adicionar ao carrinho'}
              </Button>
            </form>
          ) : (
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
              <Button full disabled={salvando} onClick={() => adicionar()}>
                {salvando ? 'Adicionando…' : 'Adicionar ao carrinho'}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
