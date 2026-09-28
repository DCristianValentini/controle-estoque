// Tipos espelhando o schema criado por
// database/migrations/001_schema_fix.sql — ver esse arquivo para o contrato
// completo (colunas, constraints, RLS). Nomes de campo em camelCase com
// colunas entre aspas no Postgres (ex.: "descontoMax", "imagens_Path")
// precisam bater exatamente com o nome da coluna.

export type Papel = 'admin' | 'vendedor'

export interface Empresa {
  id: number
  nome: string
  // Não confirmado no schema resumido da migração (que só ALTERa a tabela
  // existente) — tratado como opcional; ver aviso no EmpresasPage se a
  // coluna não existir ainda no banco.
  ativo?: boolean
}

export interface Profile {
  id: string
  login: string
  nome: string
  super_admin: boolean
  ativo: boolean
}

export interface Produto {
  id: number
  empresa_id: number
  sku: string | null
  nome: string
  descricao: string | null
  quantidade: number
  ativo: boolean
  descontoMax: number
  valor: number
  imagens_Path: string[] | null
  categoria: string | null
  custo: number | null
}

export interface CarrinhoItem {
  id: number
  empresa_id: number
  usuario_id: string
  produto_id: number
  quantidade: number
  valor_acertado: number
  perc_desc: number
}

export interface VendaEfetivada {
  id: number
  empresa_id: number
  usuario_id: string | null
  produto_id: number
  quantidade: number
  valor_acertado: number
  perc_desc: number
  dataHora: string
  nomeCli: string
}

export interface Convite {
  id: string
  login: string
  email: string
  nome: string
  empresas: { empresa_id: number; papel: Papel }[]
  usado: boolean
  criado_por: string | null
  criado_em: string
}
