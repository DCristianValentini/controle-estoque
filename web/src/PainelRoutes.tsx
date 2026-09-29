import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { SelecionarEmpresaPage } from './pages/SelecionarEmpresaPage'
import { CatalogoPage } from './pages/CatalogoPage'
import { CarrinhoPage } from './pages/CarrinhoPage'
import { CarrinhosClientesPage } from './pages/CarrinhosClientesPage'
import { ProdutosAdminPage } from './pages/ProdutosAdminPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { EmpresasPage } from './pages/EmpresasPage'
import { RelatorioPage } from './pages/RelatorioPage'

// Área autenticada (equipe: vendedor/admin/super_admin), toda sob /painel/*.
// Cada aba do menu é uma URL de verdade (Layout usa <Link>/useLocation) —
// o botão voltar do navegador navega entre elas normalmente.
export function PainelRoutes() {
  const { profile, semAcesso, empresaAtiva, modoGerenciarEmpresas, signOut } = useAuth()

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
    return (
      <Routes>
        <Route path="selecionar-empresa" element={<SelecionarEmpresaPage />} />
        <Route path="*" element={<Navigate to="/painel/selecionar-empresa" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={modoGerenciarEmpresas ? 'empresas' : 'catalogo'} replace />} />
        {/* Se ja tem empresa ativa (ex.: auto-selecionada por so ter 1 vinculo)
            e a URL ainda aponta pra essa tela, avanca sozinho pro catalogo —
            sem isso ficava preso aqui depois da auto-selecao. */}
        <Route path="selecionar-empresa" element={<Navigate to="/painel/catalogo" replace />} />
        <Route path="catalogo" element={<CatalogoPage />} />
        <Route path="carrinho" element={<CarrinhoPage />} />
        <Route path="carrinhos-clientes" element={<CarrinhosClientesPage />} />
        <Route path="produtos" element={<ProdutosAdminPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="relatorio" element={<RelatorioPage />} />
        <Route path="empresas" element={<EmpresasPage />} />
        <Route path="*" element={<Navigate to="/painel/catalogo" replace />} />
      </Route>
    </Routes>
  )
}
