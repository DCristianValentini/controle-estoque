import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import logoUrl from '../assets/branding/logo.webp'

interface NavItem {
  path: string
  label: string
  icon: string
}

// Menu lateral vira drawer (hambúrguer) em telas estreitas — padrão de
// responsividade obrigatório do dono do projeto. Cada item é uma URL de
// verdade (/painel/...) — o botão voltar do navegador navega entre as
// abas normalmente.
export function Layout() {
  const { profile, empresaAtiva, isAdmin, isSuperAdmin, modoGerenciarEmpresas, vinculos, trocarEmpresa, signOut } =
    useAuth()
  const [drawerAberto, setDrawerAberto] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const itens: NavItem[] = []
  if (!modoGerenciarEmpresas) {
    itens.push({ path: '/painel/catalogo', label: 'Catálogo', icon: '🛍️' })
    itens.push({ path: '/painel/carrinho', label: 'Carrinho', icon: '🛒' })
    // vendedor e admin — pedido explicito do usuario, nao so admin
    itens.push({ path: '/painel/carrinhos-clientes', label: 'Carrinhos de clientes', icon: '💬' })
    if (isAdmin) itens.push({ path: '/painel/produtos', label: 'Produtos', icon: '📦' })
    if (isAdmin) itens.push({ path: '/painel/usuarios', label: 'Usuários', icon: '👥' })
    itens.push({ path: '/painel/relatorio', label: 'Relatório', icon: '📊' })
  }
  if (isSuperAdmin) itens.push({ path: '/painel/empresas', label: 'Empresas', icon: '🏢' })

  const podeTrocarEmpresa = vinculos.length > 1 || isSuperAdmin

  function aoTrocarEmpresa() {
    trocarEmpresa()
    navigate('/painel/selecionar-empresa')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {drawerAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawerAberto(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          drawerAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
          <span className="min-w-0 truncate text-[clamp(0.95rem,0.9rem+0.2vw,1.1rem)] font-semibold text-slate-800">
            Controle de Estoque
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {itens.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setDrawerAberto(false)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                location.pathname === item.path ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3 text-sm">
          <p className="min-w-0 truncate font-medium text-slate-700">{profile?.nome}</p>
          <button
            onClick={() => signOut()}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawerAberto(true)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <div className="flex min-w-0 items-center justify-center gap-2 text-sm text-slate-600 lg:justify-start">
            {modoGerenciarEmpresas ? (
              <span className="font-medium text-slate-800">Gerenciamento de empresas</span>
            ) : (
              <span className="min-w-0 truncate font-medium text-slate-800">{empresaAtiva?.nome}</span>
            )}
            {podeTrocarEmpresa && (
              <button
                onClick={aoTrocarEmpresa}
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Trocar
              </button>
            )}
          </div>
          <div className="hidden min-w-0 truncate text-sm text-slate-500 sm:block">{profile?.nome}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
