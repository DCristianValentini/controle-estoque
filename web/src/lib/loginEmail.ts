// O Supabase Auth só sabe autenticar por e-mail (ou telefone), mas o app
// pede um simples "nome de usuário" (como o app antigo: "Mario", sem @).
// A ponte é essa: transformamos o login digitado, de forma determinística,
// num e-mail sintético fixo — nunca existe uma consulta ao banco antes do
// login (o que exigiria liberar isso pra anon key sem sessão), é só uma
// função pura no cliente. O mesmo "Mario" sempre vira o mesmo e-mail, tanto
// na hora de criar o convite quanto na hora da pessoa se cadastrar/logar.
const DOMINIO = 'controle-estoque.local'

export function normalizarLogin(login: string): string {
  return login
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, '') // sem espaços, igual ao app antigo
    .replace(/[^a-z0-9._-]/g, '')
}

export function loginParaEmail(login: string): string {
  return `${normalizarLogin(login)}@${DOMINIO}`
}
