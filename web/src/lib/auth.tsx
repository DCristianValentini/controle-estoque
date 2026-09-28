import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Empresa, Papel, Profile } from './types'

interface Vinculo {
  empresa: Empresa
  papel: Papel
}

interface EmpresaAtiva {
  id: number
  nome: string
  papel: Papel | 'super_admin'
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  vinculos: Vinculo[]
  todasEmpresas: Empresa[]
  empresaAtiva: EmpresaAtiva | null
  modoGerenciarEmpresas: boolean
  loading: boolean
  /** logou mas não tem profile (sem convite aceito) ou profile.ativo=false */
  semAcesso: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  selecionarEmpresa: (id: number) => void
  entrarModoGerenciar: () => void
  trocarEmpresa: () => void
  recarregar: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [todasEmpresas, setTodasEmpresas] = useState<Empresa[]>([])
  const [empresaAtivaId, setEmpresaAtivaId] = useState<number | null>(null)
  const [modoGerenciarEmpresas, setModoGerenciarEmpresas] = useState(false)
  const [loading, setLoading] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)

  const carregarPerfil = useCallback(async (userId: string) => {
    setSemAcesso(false)

    const { data: perfilData } = await supabase
      .from('profiles')
      .select('id, nome, super_admin, ativo')
      .eq('id', userId)
      .maybeSingle()

    if (!perfilData || perfilData.ativo === false) {
      setProfile(null)
      setVinculos([])
      setTodasEmpresas([])
      setSemAcesso(true)
      return
    }
    setProfile(perfilData)

    if (perfilData.super_admin) {
      const { data: empresasData } = await supabase.from('empresa').select('id, nome, ativo').order('nome')
      setTodasEmpresas(empresasData ?? [])
    } else {
      setTodasEmpresas([])
    }

    // Duas consultas + combinação no cliente em vez de embed do PostgREST —
    // mais simples de garantir correto sem um banco migrado pra testar
    // contra o cache de relacionamentos do schema.
    const { data: vinculosData } = await supabase
      .from('usuario_empresas')
      .select('empresa_id, papel')
      .eq('profile_id', userId)

    const empresaIds = Array.from(new Set((vinculosData ?? []).map((v) => v.empresa_id)))
    let empresasPorId = new Map<number, Empresa>()
    if (empresaIds.length > 0) {
      const { data: empresasData } = await supabase.from('empresa').select('id, nome, ativo').in('id', empresaIds)
      empresasPorId = new Map((empresasData ?? []).map((e) => [e.id, e]))
    }

    const vs: Vinculo[] = (vinculosData ?? [])
      .filter((v) => empresasPorId.has(v.empresa_id))
      .map((v) => ({ empresa: empresasPorId.get(v.empresa_id)!, papel: v.papel as Papel }))
    setVinculos(vs)
  }, [])

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      if (data.session) {
        carregarPerfil(data.session.user.id).finally(() => {
          if (ativo) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
      if (novaSessao) {
        setLoading(true)
        carregarPerfil(novaSessao.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setVinculos([])
        setTodasEmpresas([])
        setEmpresaAtivaId(null)
        setModoGerenciarEmpresas(false)
        setSemAcesso(false)
        setLoading(false)
      }
    })

    return () => {
      ativo = false
      assinatura.subscription.unsubscribe()
    }
  }, [carregarPerfil])

  // Requisito explícito: usuário com vínculo em 1 empresa só pula a tela de
  // seleção. Super_admin sempre escolhe explicitamente (pode gerenciar sem
  // selecionar nenhuma).
  useEffect(() => {
    if (!profile || profile.super_admin) return
    if (empresaAtivaId === null && vinculos.length === 1) {
      setEmpresaAtivaId(vinculos[0].empresa.id)
    }
  }, [profile, vinculos, empresaAtivaId])

  const empresaAtiva = useMemo<EmpresaAtiva | null>(() => {
    if (empresaAtivaId === null) return null
    const vinculo = vinculos.find((v) => v.empresa.id === empresaAtivaId)
    if (vinculo) return { id: vinculo.empresa.id, nome: vinculo.empresa.nome, papel: vinculo.papel }
    if (profile?.super_admin) {
      const empresa = todasEmpresas.find((e) => e.id === empresaAtivaId)
      if (empresa) return { id: empresa.id, nome: empresa.nome, papel: 'super_admin' }
    }
    return null
  }, [empresaAtivaId, vinculos, todasEmpresas, profile])

  const isSuperAdmin = !!profile?.super_admin
  const isAdmin = isSuperAdmin || empresaAtiva?.papel === 'admin'

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const selecionarEmpresa = useCallback((id: number) => {
    setModoGerenciarEmpresas(false)
    setEmpresaAtivaId(id)
  }, [])

  const entrarModoGerenciar = useCallback(() => {
    setEmpresaAtivaId(null)
    setModoGerenciarEmpresas(true)
  }, [])

  const trocarEmpresa = useCallback(() => {
    setEmpresaAtivaId(null)
    setModoGerenciarEmpresas(false)
  }, [])

  const recarregar = useCallback(async () => {
    if (session) await carregarPerfil(session.user.id)
  }, [session, carregarPerfil])

  const value: AuthState = {
    session,
    profile,
    vinculos,
    todasEmpresas,
    empresaAtiva,
    modoGerenciarEmpresas,
    loading,
    semAcesso,
    isSuperAdmin,
    isAdmin,
    signOut,
    selecionarEmpresa,
    entrarModoGerenciar,
    trocarEmpresa,
    recarregar,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
