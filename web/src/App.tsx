import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import type { View } from './components/Layout'
import { Spinner } from './components/ui'
import { LoginPage } from './pages/LoginPage'
import { CatalogoPublicoPage } from './pages/CatalogoPublicoPage'
import { SelecionarEmpresaPage } from './pages/SelecionarEmpresaPage'
import { CatalogoPage } from './pages/CatalogoPage'
import { CarrinhoPage } from './pages/CarrinhoPage'
import { ProdutosAdminPage } from './pages/ProdutosAdminPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { EmpresasPage } from './pages/EmpresasPage'
import { RelatorioPage } from './pages/RelatorioPage'

function AppShell() {
  const { session, loading, profile, semAcesso, empresaAtiva, modoGerenciarEmpresas, signOut } = useAuth()
  const [view, setView] = useState<View>('catalogo')
  const [mostrarLogin, setMostrarLogin] = useState(false)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-8 w-8 text-red-600" />
      </div>
    )
  }

  // Sem sessão: abre no catálogo público (visitante navega sem conta) — o
  // botão "Entrar" no topo alterna pra tela de login. Pedido explícito do
  // usuário: quem não tem conta ainda deve conseguir ver preço/imagens/
  // estoque antes de precisar logar.
  if (!session) {
    return mostrarLogin ? <LoginPage /> : <CatalogoPublicoPage onEntrar={() => setMostrarLogin(true)} />
  }

  if (semAcesso || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800">
            Seu cadastro foi feito, mas você ainda não tem nenhum acesso liberado. Peça para um administrador te
            convidar.
          </p>
          <button onClick={() => signOut()} className="mt-4 text-sm font-medium text-amber-700 underline">
            Sair
          </button>
        </div>
      </div>
    )
  }

  if (!empresaAtiva && !modoGerenciarEmpresas) {
    return <SelecionarEmpresaPage />
  }

  return (
    <Layout view={view} onNavigate={setView}>
      {modoGerenciarEmpresas ? (
        <EmpresasPage />
      ) : (
        <>
          {view === 'catalogo' && <CatalogoPage />}
          {view === 'carrinho' && <CarrinhoPage />}
          {view === 'produtos' && <ProdutosAdminPage />}
          {view === 'usuarios' && <UsuariosPage />}
          {view === 'relatorio' && <RelatorioPage />}
          {view === 'empresas' && <EmpresasPage />}
        </>
      )}
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
