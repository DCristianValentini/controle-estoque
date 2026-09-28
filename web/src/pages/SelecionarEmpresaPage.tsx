import { useAuth } from '../lib/auth'
import { Badge, Button, Card } from '../components/ui'

// Requisito explícito: usuário vinculado a mais de uma empresa escolhe uma
// delas logo após o login validado. Super_admin sempre passa por aqui (pode
// escolher qualquer empresa, ou entrar em modo "gerenciar empresas").
export function SelecionarEmpresaPage() {
  const { vinculos, todasEmpresas, isSuperAdmin, selecionarEmpresa, entrarModoGerenciar, signOut, profile } = useAuth()

  const lista = isSuperAdmin
    ? todasEmpresas.map((empresa) => ({ empresa, papel: 'super_admin' as const }))
    : vinculos.map((v) => ({ empresa: v.empresa, papel: v.papel as string }))

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-lg font-semibold text-slate-800">Selecione a empresa</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Olá, {profile?.nome}</p>

        <div className="space-y-3">
          {lista.map(({ empresa, papel }) => (
            <Card key={empresa.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="min-w-0 truncate font-medium text-slate-800">{empresa.nome}</p>
                <Badge tone={papel === 'vendedor' ? 'slate' : 'sky'}>{papel === 'super_admin' ? 'super admin' : papel}</Badge>
              </div>
              <Button onClick={() => selecionarEmpresa(empresa.id)}>Entrar</Button>
            </Card>
          ))}
          {lista.length === 0 && (
            <p className="text-center text-sm text-slate-500">Nenhuma empresa vinculada ao seu usuário.</p>
          )}
        </div>

        {isSuperAdmin && (
          <button onClick={entrarModoGerenciar} className="mt-6 w-full text-center text-sm text-red-600 hover:underline">
            Gerenciar empresas (criar nova, etc.)
          </button>
        )}
        <button onClick={() => signOut()} className="mt-3 w-full text-center text-sm text-slate-500 hover:underline">
          Sair
        </button>
      </div>
    </div>
  )
}
