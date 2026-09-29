import { useState } from 'react'
import type { FormEvent } from 'react'
import { garantirClientePublico } from '../lib/clientePublico'
import type { ClientePublico } from '../lib/clientePublico'
import { Button, Input, Modal } from './ui'

interface Props {
  onCadastrado: (cliente: ClientePublico) => void
  onClose: () => void
}

// Cadastro prévio do visitante — tela própria (não mais um formulário
// encaixado dentro do card do produto). Uma vez feito, vale pra qualquer
// produto/loja na mesma sessão do navegador.
export function IdentificacaoClienteModal({ onCadastrado, onClose }: Props) {
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !whatsapp.trim()) {
      setErro('Preencha nome e WhatsApp.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const cliente = await garantirClientePublico(nome, whatsapp)
      onCadastrado(cliente)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível identificar você agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Identifique-se">
      <form onSubmit={aoEnviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Pra montar seu carrinho e a loja poder te chamar no WhatsApp pra fechar a compra, precisamos do seu nome e
          contato.
        </p>
        <Input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        <Input placeholder="WhatsApp (com DDD)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Button type="submit" full disabled={salvando}>
          {salvando ? 'Entrando…' : 'Continuar'}
        </Button>
      </form>
    </Modal>
  )
}
