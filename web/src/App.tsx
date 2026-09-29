import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ClientePublicoProvider } from './lib/ClientePublicoContext'
import { Spinner } from './components/ui'
import { LoginPage } from './pages/LoginPage'
import { CatalogoPublicoPage } from './pages/CatalogoPublicoPage'
import { MeuCarrinhoPublicoPage } from './pages/MeuCarrinhoPublicoPage'
import { PainelRoutes } from './PainelRoutes'

// Rotas com hash (#/...): funciona tanto publicado no GitHub Pages quanto
// no arquivo único aberto por duplo-clique (file://), sem precisar de
// nenhuma configuração de servidor pra rotas "profundas".
function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-8 w-8 text-red-600" />
      </div>
    )
  }

  const autenticado = !!session && !session.user.is_anonymous

  return (
    <Routes>
      <Route path="/login" element={autenticado ? <Navigate to="/painel" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          autenticado ? (
            <Navigate to="/painel" replace />
          ) : (
            <ClientePublicoProvider>
              <CatalogoPublicoPage />
            </ClientePublicoProvider>
          )
        }
      />
      <Route
        path="/loja/:empresaId"
        element={
          autenticado ? (
            <Navigate to="/painel" replace />
          ) : (
            <ClientePublicoProvider>
              <CatalogoPublicoPage />
            </ClientePublicoProvider>
          )
        }
      />
      <Route
        path="/meu-carrinho"
        element={
          autenticado ? (
            <Navigate to="/painel" replace />
          ) : (
            <ClientePublicoProvider>
              <MeuCarrinhoPublicoPage />
            </ClientePublicoProvider>
          )
        }
      />
      <Route path="/painel/*" element={autenticado ? <PainelRoutes /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

export default App
