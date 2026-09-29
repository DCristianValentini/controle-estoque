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
  sairComoCliente: () => Promise<void>
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
  // Espelha clienteAtual num ref: atualizarContador() é repassada como prop
  // pra baixo (catálogo -> modal de produto) e o clique em "adicionar" pode
  // já estar em andamento (fechado sobre o clienteAtual de ANTES de se
  // identificar) quando o cadastro conclui. Ler do ref em vez do valor
  // fechado por closure garante o valor atual mesmo nesse caso -- sem isso
  // o contador só atualizava depois de um F5.
  const clienteAtualRef = useRef<ClientePublico | null>(null)

  useEffect(() => {
    obterClientePublicoAtual().then((cliente) => {
      clienteAtualRef.current = cliente
      setClienteAtual(cliente)
    })
  }, [])

  async function atualizarContador() {
    const cliente = clienteAtualRef.current
    if (!cliente) return
    const { count } = await supabase
      .from('carrinho_publico')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', cliente.id)
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
    clienteAtualRef.current = cliente
    setClienteAtual(cliente)
    setMostrarIdentificacao(false)
    callbackRef.current?.(cliente)
    callbackRef.current = null
  }

  // "Sair" do cadastro de cliente: encerra a sessão anônima (assim um F5
  // depois não recupera o mesmo cadastro) e limpa o estado local -- a
  // próxima ação que precisar de identificação mostra o formulário de novo,
  // pra outra pessoa poder se identificar no mesmo aparelho.
  async function sairComoCliente() {
    await supabase.auth.signOut()
    clienteAtualRef.current = null
    setClienteAtual(null)
    setContadorCarrinho(0)
  }

  return (
    <Contexto.Provider value={{ clienteAtual, exigirCliente, contadorCarrinho, atualizarContador, sairComoCliente }}>
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
