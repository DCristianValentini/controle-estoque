import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Isso não deveria acontecer em produção (o build embute o .env.local),
  // mas ajuda a diagnosticar rápido se o arquivo sumir ou o nome da
  // variável mudar.
  console.error(
    'Supabase não configurado: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local',
  )
}

// A anon key fica embutida no bundle de propósito — é o modelo de
// distribuição deste app (arquivo único, sem backend próprio). A segurança
// real está nas policies de RLS do Postgres, não em esconder essa chave.
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
