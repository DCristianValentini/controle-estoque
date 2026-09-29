import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { obterClientePublicoAtual } from './clientePublico'
import type { ClientePublico } from './clientePublico'
import { IdentificacaoClienteModal } from '../components/IdentificacaoClienteModal'

interface ContextoClientePublico {
  clienteAtual: ClientePublico | null
  exigirCliente: () => Promise<ClientePublico>
  contadorCarrinho: number
  atualizarContador: () => void
}

const Contexto = createContext<ContextoClientePublico | null>(null)

// Compartilha a identidade do visitante (cliente sem conta) entre as
// páginas públicas (catálogo por loja, meu carrinho) — pra ele só precisar
// se identificar uma vez, não importa em qual tela/loja isso aconteça.
export function ClientePublicoProvider({ children }: { children: ReactNode }) {
  const [clienteAtual, setClienteAtual] = useState<ClientePublico | null>(null)
  const [mostrarIdentificacao, setMostrarIdentificacao] = useState(false)
  const [contadorCarrinho, setContadorCarrinho] = useState(0)
  const callbackRef = useRef<((cliente: ClientePublico) => void) | null>(null)

  useEffect(() => {
    obterClientePublicoAtual().then(setClienteAtual)
  }, [])

  async function atualizarContador() {
    if (!clienteAtual) return
    const { count } = await supabase
      .from('carrinho_publico')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteAtual.id)
      .eq('status', 'pendente')
    setContadorCarrinho(count ?? 0)
  }

  useEffect(() => {
    atualizarContador()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteAtual])

  function exigirCliente(): Promise<ClientePublico> {
    if (clienteAtual) return Promise.resolve(clienteAtual)
    return new Promise((resolve) => {
      callbackRef.current = resolve
      setMostrarIdentificacao(true)
    })
  }

  function aoIdentificar(cliente: ClientePublico) {
    setClienteAtual(cliente)
    setMostrarIdentificacao(false)
    callbackRef.current?.(cliente)
    callbackRef.current = null
  }

  return (
    <Contexto.Provider value={{ clienteAtual, exigirCliente, contadorCarrinho, atualizarContador }}>
      {children}
      {mostrarIdentificacao && (
        <IdentificacaoClienteModal
          onCadastrado={aoIdentificar}
          onClose={() => {
            setMostrarIdentificacao(false)
            callbackRef.current = null
          }}
        />
      )}
    </Contexto.Provider>
  )
}

export function useClientePublico(): ContextoClientePublico {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useClientePublico precisa estar dentro de <ClientePublicoProvider>')
  return ctx
}
