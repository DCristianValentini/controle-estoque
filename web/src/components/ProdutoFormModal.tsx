import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Produto } from '../lib/types'
import { enviarImagemProduto, listarImagensOrfas } from '../lib/storage'
import type { ImagemOrfa } from '../lib/storage'
import { Button, Input, Modal, Spinner, Textarea } from './ui'

interface Props {
  produto: Produto | null
  onClose: () => void
  onSalvo: () => void
}

export function ProdutoFormModal({ produto, onClose, onSalvo }: Props) {
  const { empresaAtiva } = useAuth()
  const [sku, setSku] = useState(produto?.sku ?? '')
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [descricao, setDescricao] = useState(produto?.descricao ?? '')
  const [categoria, setCategoria] = useState(produto?.categoria ?? '')
  const [quantidade, setQuantidade] = useState(produto?.quantidade ?? 0)
  const [valor, setValor] = useState(produto?.valor ?? 0)
  const [custo, setCusto] = useState(produto?.custo ?? 0)
  const [descontoMax, setDescontoMax] = useState(produto?.descontoMax ?? 0)
  const [ativo, setAtivo] = useState(produto?.ativo ?? true)
  const [imagens, setImagens] = useState<string[]>(produto?.imagens_Path ?? [])
  const [categorias, setCategorias] = useState<string[]>([])
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarOrfas, setMostrarOrfas] = useState(false)

  useEffect(() => {
    if (!empresaAtiva) return
    supabase
      .from('produtos')
      .select('categoria')
      .eq('empresa_id', empresaAtiva.id)
      .then(({ data }) => {
        const set = new Set<string>()
        for (const p of data ?? []) {
          if (p.categoria) set.add(p.categoria)
        }
        setCategorias(Array.from(set).sort())
      })
  }, [empresaAtiva])

  async function onSelecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo || !empresaAtiva) return
    setEnviandoImagem(true)
    setErro(null)
    try {
      const url = await enviarImagemProduto(empresaAtiva.id, arquivo)
      setImagens((imgs) => [...imgs, url])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao enviar imagem.')
    } finally {
      setEnviandoImagem(false)
    }
  }

  function removerImagem(url: string) {
    setImagens((imgs) => imgs.filter((i) => i !== url))
  }

  async function salvar() {
    if (!empresaAtiva) return
    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }
    setSalvando(true)
    setErro(null)
    const payload = {
      empresa_id: empresaAtiva.id,
      sku: sku.trim() || null,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria: categoria.trim() || null,
      quantidade,
      valor,
      custo,
      descontoMax,
      ativo,
      imagens_Path: imagens,
    }
    const { error } = produto
      ? await supabase.from('produtos').update(payload).eq('id', produto.id)
      : await supabase.from('produtos').insert(payload)
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    onSalvo()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={produto ? 'Editar produto' : 'Novo produto'}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Categoria</span>
            <input
              list="categorias-produto"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[clamp(0.88rem,0.84rem+0.15vw,1rem)] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
            <datalist id="categorias-produto">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <Input label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Textarea label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input
            label="Quantidade"
            type="number"
            min={0}
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
          />
          <Input
            label="Valor"
            type="number"
            min={0}
            step="0.01"
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
          />
          <Input
            label="Custo"
            type="number"
            min={0}
            step="0.01"
            value={custo}
            onChange={(e) => setCusto(Number(e.target.value))}
          />
          <Input
            label="Desconto máx. (%)"
            type="number"
            min={0}
            max={100}
            value={descontoMax}
            onChange={(e) => setDescontoMax(Number(e.target.value))}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ativo
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">Imagens</span>
          <div className="flex flex-wrap gap-2">
            {imagens.map((url) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerImagem(url)}
                  aria-label="Remover imagem"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-red-400 hover:text-red-600">
              {enviandoImagem ? (
                <Spinner className="h-4 w-4 text-red-600" />
              ) : (
                <>
                  <span aria-hidden>📷</span>
                  <span>Enviar</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onSelecionarArquivo} disabled={enviandoImagem} />
            </label>
            <button
              type="button"
              onClick={() => setMostrarOrfas(true)}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-red-400 hover:text-red-600"
            >
              <span aria-hidden>🗂️</span>
              <span>Já existente</span>
            </button>
          </div>
        </div>
      </div>

      {mostrarOrfas && (
        <ImagensOrfasModal
          onClose={() => setMostrarOrfas(false)}
          onEscolher={(url) => {
            setImagens((imgs) => [...imgs, url])
            setMostrarOrfas(false)
          }}
        />
      )}
    </Modal>
  )
}

function ImagensOrfasModal({ onClose, onEscolher }: { onClose: () => void; onEscolher: (url: string) => void }) {
  const [imagens, setImagens] = useState<ImagemOrfa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarImagensOrfas()
      .then(setImagens)
      .catch((err) => setErro(err instanceof Error ? err.message : 'Falha ao listar imagens.'))
  }, [])

  return (
    <Modal open onClose={onClose} title="Usar foto já existente" wide>
      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {!imagens ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-red-600" />
        </div>
      ) : imagens.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhuma imagem disponível (todas já estão em uso).</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {imagens.map((img) => (
            <button
              key={img.caminho}
              onClick={() => onEscolher(img.url)}
              className="aspect-square overflow-hidden rounded-lg border border-slate-200 hover:border-red-400"
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
