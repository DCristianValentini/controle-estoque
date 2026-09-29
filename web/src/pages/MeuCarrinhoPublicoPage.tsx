import { useNavigate } from 'react-router-dom'
import { useClientePublico } from '../lib/ClientePublicoContext'
import { MeuCarrinhoPublicoModal } from '../components/MeuCarrinhoPublicoModal'

// Rota /meu-carrinho — carrinho do visitante já identificado. Se por algum
// motivo chegou aqui sem cliente (link direto, sessão perdida), volta pro
// catálogo em vez de mostrar uma tela quebrada.
export function MeuCarrinhoPublicoPage() {
  const { clienteAtual } = useClientePublico()
  const navigate = useNavigate()

  if (!clienteAtual) {
    navigate('/', { replace: true })
    return null
  }

  return <MeuCarrinhoPublicoModal clienteId={clienteAtual.id} onClose={() => navigate(-1)} />
}
