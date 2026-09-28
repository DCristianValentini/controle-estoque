import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Empresa } from '../lib/types'
import { Badge, Button, Card, Input, Modal, Spinner } from '../components/ui'

export function EmpresasPage() {
  const { isSuperAdmin, recarregar } = useAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<Empresa | 'novo' | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase.from('empresa').select('*').order('nome')
    if (error) setErro(error.message)
    setEmpresas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function alternarAtivo(empresa: Empresa) {
    setErro(null)
    const { error } = await supabase.from('empresa').update({ ativo: !empresa.ativo }).eq('id', empresa.id)
    if (error) {
      setErro(
        `Não foi possível alterar o status — a coluna "ativo" pode ainda não existir na tabela empresa: ${error.message}`,
      )
      return
    }
    await carregar()
  }

  if (!isSuperAdmin) {
    return <p className="py-12 text-center text-sm text-slate-500">Você não tem permissão para acessar esta tela.</p>
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Empresas</h1>
        <Button onClick={() => setEditando('novo')}>+ Nova empresa</Button>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-sky-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {empresas.map((e) => (
            <Card key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-slate-800">{e.nome}</p>
              {e.ativo === false && <Badge tone="slate">inativa</Badge>}
              <Button variant="secondary" onClick={() => setEditando(e)}>
                Editar
              </Button>
              <Button variant={e.ativo === false ? 'primary' : 'danger'} onClick={() => alternarAtivo(e)}>
                {e.ativo === false ? 'Reativar' : 'Inativar'}
              </Button>
            </Card>
          ))}
          {empresas.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Nenhuma empresa cadastrada.</p>}
        </div>
      )}

      {editando && (
        <EmpresaFormModal
          empresa={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
            recarregar()
          }}
        />
      )}
    </div>
  )
}

function EmpresaFormModal({
  empresa,
  onClose,
  onSalvo,
}: {
  empresa: Empresa | null
  onClose: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState(empresa?.nome ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }
    setSalvando(true)
    setErro(null)
    const { error } = empresa
      ? await supabase.from('empresa').update({ nome: nome.trim() }).eq('id', empresa.id)
      : await supabase.from('empresa').insert({ nome: nome.trim() })
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
      title={empresa ? 'Editar empresa' : 'Nova empresa'}
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
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
    </Modal>
  )
}
