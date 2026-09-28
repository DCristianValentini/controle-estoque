import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { loginParaEmail } from '../lib/loginEmail'
import { Button, Card, Input, PasswordInput } from '../components/ui'
import logoUrl from '../assets/branding/logo.webp'

type Modo = 'login' | 'cadastro'

export function LoginPage() {
  const [modo, setModo] = useState<Modo>('login')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  function trocarModo(novoModo: Modo) {
    setErro(null)
    setMensagem(null)
    setModo(novoModo)
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginParaEmail(usuario),
      password: senha,
    })
    setCarregando(false)
    if (error) setErro(traduzirErro(error.message))
  }

  async function cadastrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setMensagem(null)
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setCarregando(true)
    const { error, data } = await supabase.auth.signUp({
      email: loginParaEmail(usuario),
      password: senha,
    })
    setCarregando(false)
    if (error) {
      setErro(traduzirErro(error.message))
      return
    }
    // Se já veio com sessão (confirmação de e-mail desligada no projeto), o
    // AuthProvider assume a partir daqui — inclusive detectando se havia ou
    // não convite pendente pra esse e-mail.
    if (data.session) return
    setMensagem('Cadastro feito. Confirme seu e-mail, se solicitado, e depois faça login.')
    trocarModo('login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#EB3334] to-[#7a2b2a] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <img src={logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
        </div>
        <Card className="p-6">
          <h1 className="mb-4 text-center text-lg font-semibold text-slate-800">
            {modo === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>

          {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          {mensagem && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensagem}</p>}

          {modo === 'login' ? (
            <form className="space-y-4" onSubmit={entrar}>
              <Input
                label="Usuário"
                type="text"
                required
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
              <PasswordInput
                label="Senha"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <Button type="submit" full disabled={carregando}>
                {carregando ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={cadastrar}>
              <Input
                label="Usuário"
                type="text"
                required
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
              <PasswordInput
                label="Senha"
                required
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <PasswordInput
                label="Confirmar senha"
                required
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Isso só libera acesso se um administrador já tiver te convidado com este nome de usuário.
              </p>
              <Button type="submit" full disabled={carregando}>
                {carregando ? 'Criando…' : 'Criar conta'}
              </Button>
            </form>
          )}

          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-red-600 hover:underline"
            onClick={() => trocarModo(modo === 'login' ? 'cadastro' : 'login')}
          >
            {modo === 'login' ? 'Aceitar convite / criar conta' : 'Já tenho conta — entrar'}
          </button>
        </Card>
      </div>
    </div>
  )
}

function traduzirErro(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Usuário ou senha incorretos.'
  if (msg.includes('User already registered')) return 'Já existe uma conta com este nome de usuário — faça login.'
  if (msg.toLowerCase().includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
  return msg
}
