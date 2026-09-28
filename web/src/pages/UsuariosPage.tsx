import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Empresa, Papel, Profile } from '../lib/types'
import { Badge, Button, Card, Input, Modal, Select, Spinner } from '../components/ui'

interface VinculoComPerfil {
  profile_id: string
  empresa_id: number
  papel: Papel
  profile?: Pick<Profile, 'id' | 'nome'>
}

export function UsuariosPage() {
  const { empresaAtiva, isAdmin, isSuperAdmin, todasEmpresas, profile: meuPerfil } = useAuth()
  const [vinculos, setVinculos] = useState<VinculoComPerfil[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [mostrarConvite, setMostrarConvite] = useState(false)

  async function carregar() {
    if (!empresaAtiva) return
    setCarregando(true)
    setErro(null)
    const { data: ligacoes, error } = await supabase
      .from('usuario_empresas')
      .select('profile_id, empresa_id, papel')
      .eq('empresa_id', empresaAtiva.id)
    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    const profileIds = Array.from(new Set((ligacoes ?? []).map((l) => l.profile_id)))
    let perfisPorId = new Map<string, Pick<Profile, 'id' | 'nome'>>()
    if (profileIds.length > 0) {
      const { data: perfis } = await supabase.from('profiles').select('id, nome').in('id', profileIds)
      perfisPorId = new Map((perfis ?? []).map((p) => [p.id, p]))
    }
    setVinculos((ligacoes ?? []).map((l) => ({ ...l, papel: l.papel as Papel, profile: perfisPorId.get(l.profile_id) })))
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id])

  async function alterarPapel(vinculo: VinculoComPerfil, papel: Papel) {
    setErro(null)
    const { error } = await supabase
      .from('usuario_empresas')
      .update({ papel })
      .eq('profile_id', vinculo.profile_id)
      .eq('empresa_id', vinculo.empresa_id)
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  async function removerVinculo(vinculo: VinculoComPerfil) {
    if (!confirm(`Remover o acesso de "${vinculo.profile?.nome ?? vinculo.profile_id}" a esta empresa?`)) return
    setErro(null)
    const { error } = await supabase
      .from('usuario_empresas')
      .delete()
      .eq('profile_id', vinculo.profile_id)
      .eq('empresa_id', vinculo.empresa_id)
    if (error) {
      setErro(error.message)
      return
    }
    setMensagem('Acesso removido.')
    await carregar()
  }

  if (!isAdmin || !empresaAtiva) {
    return <p className="py-12 text-center text-sm text-slate-500">Você não tem permissão para acessar esta tela.</p>
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Usuários</h1>
        <Button onClick={() => setMostrarConvite(true)}>+ Convidar</Button>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {mensagem && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensagem}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-sky-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {vinculos.map((v) => (
            <Card key={v.profile_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">{v.profile?.nome ?? v.profile_id}</span>
                {v.profile_id === meuPerfil?.id && <Badge tone="sky">você</Badge>}
              </div>
              <Select
                value={v.papel}
                onChange={(e) => alterarPapel(v, e.target.value as Papel)}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'vendedor', label: 'Vendedor' },
                ]}
              />
              <Button variant="danger" onClick={() => removerVinculo(v)}>
                Remover
              </Button>
            </Card>
          ))}
          {vinculos.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Nenhum usuário vinculado.</p>}
        </div>
      )}

      {mostrarConvite && (
        <ConviteModal
          empresaAtivaId={empresaAtiva.id}
          isSuperAdmin={isSuperAdmin}
          todasEmpresas={todasEmpresas}
          onClose={() => setMostrarConvite(false)}
          onCriado={() => {
            setMostrarConvite(false)
            setMensagem('Convite criado. Peça para a pessoa se cadastrar com este e-mail em "Aceitar convite / criar conta".')
          }}
        />
      )}
    </div>
  )
}

interface AcessoConvite {
  empresa_id: number
  papel: Papel
}

interface ConviteModalProps {
  empresaAtivaId: number
  isSuperAdmin: boolean
  todasEmpresas: Empresa[]
  onClose: () => void
  onCriado: () => void
}

function ConviteModal({ empresaAtivaId, isSuperAdmin, todasEmpresas, onClose, onCriado }: ConviteModalProps) {
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [acessos, setAcessos] = useState<AcessoConvite[]>([{ empresa_id: empresaAtivaId, papel: 'vendedor' }])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function atualizarEmpresa(indice: number, empresaId: string) {
    setAcessos((lista) => lista.map((a, i) => (i === indice ? { ...a, empresa_id: Number(empresaId) } : a)))
  }

  function atualizarPapel(indice: number, papel: string) {
    setAcessos((lista) => lista.map((a, i) => (i === indice ? { ...a, papel: papel as Papel } : a)))
  }

  function adicionarAcesso() {
    setAcessos((lista) => [...lista, { empresa_id: empresaAtivaId, papel: 'vendedor' }])
  }

  function removerAcesso(indice: number) {
    setAcessos((lista) => lista.filter((_, i) => i !== indice))
  }

  async function criar() {
    if (!email.trim() || !nome.trim()) {
      setErro('Preencha nome e e-mail.')
      return
    }
    if (acessos.length === 0) {
      setErro('Escolha ao menos uma empresa.')
      return
    }
    setSalvando(true)
    setErro(null)
    const { error } = await supabase.from('convites').insert({
      email: email.trim().toLowerCase(),
      nome: nome.trim(),
      empresas: acessos,
    })
    setSalvando(false)
    if (error) {
      setErro(traduzirErroConvite(error.message))
      return
    }
    onCriado()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Convidar usuário"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? 'Criando…' : 'Criar convite'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">Acesso</span>
          <div className="space-y-2">
            {acessos.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                {isSuperAdmin ? (
                  <Select
                    value={String(a.empresa_id)}
                    onChange={(e) => atualizarEmpresa(i, e.target.value)}
                    options={todasEmpresas.map((e) => ({ value: String(e.id), label: e.nome }))}
                  />
                ) : (
                  <span className="flex-1 text-sm text-slate-600">Esta empresa</span>
                )}
                <Select
                  value={a.papel}
                  onChange={(e) => atualizarPapel(i, e.target.value)}
                  options={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'vendedor', label: 'Vendedor' },
                  ]}
                />
                {isSuperAdmin && acessos.length > 1 && (
                  <button type="button" onClick={() => removerAcesso(i)} aria-label="Remover acesso" className="shrink-0 text-red-600">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {isSuperAdmin && (
            <button type="button" onClick={adicionarAcesso} className="mt-2 text-sm text-sky-600 hover:underline">
              + adicionar outra empresa
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function traduzirErroConvite(msg: string): string {
  if (msg.includes('convites_email_pendente') || msg.includes('duplicate key')) {
    return 'Já existe um convite pendente para este e-mail.'
  }
  if (msg.includes('Sem permissao de admin')) return 'Você só pode convidar para empresas onde é admin.'
  return msg
}
