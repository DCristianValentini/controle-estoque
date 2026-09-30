import { supabase } from './supabase'
import { converterParaWebp, nomeAleatorio } from './imagemWebp'

const BUCKET = 'imagensProdutos'

// Uploads NOVOS vão para <empresa_id>/<random8>.webp — a policy de RLS do
// storage restringe escrita nessa pasta a quem é admin daquela empresa
// (lê o 1º segmento do path). Ver seção 8 da migração.
export async function enviarImagemProduto(empresaId: number, arquivo: File): Promise<string> {
  const blob = await converterParaWebp(arquivo)
  const caminho = `${empresaId}/${nomeAleatorio(8)}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
    contentType: 'image/webp',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  return data.publicUrl
}

export interface ImagemOrfa {
  caminho: string
  url: string
}

// Lista arquivos em imagensProdutos/public/ (172+ imagens legadas, ~176
// órfãs sem produto associado) que ainda não aparecem em NENHUM
// imagens_Path de NENHUM produto visível ao usuário atual. RLS de
// `produtos` já filtra automaticamente pra empresa(s) que o usuário
// enxerga, então a query "select imagens_Path" sem filtro de empresa é
// segura aqui.
export async function listarImagensOrfas(): Promise<ImagemOrfa[]> {
  const { data: arquivos, error } = await supabase.storage
    .from(BUCKET)
    .list('public', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error

  const { data: produtos, error: erroProdutos } = await supabase.from('produtos').select('imagens_Path')
  if (erroProdutos) throw erroProdutos

  const usadas = new Set<string>()
  for (const produto of produtos ?? []) {
    for (const url of produto.imagens_Path ?? []) {
      usadas.add(url)
    }
  }

  return (arquivos ?? [])
    .filter((arquivo) => arquivo.name && !arquivo.name.startsWith('.'))
    .map((arquivo) => {
      const caminho = `public/${arquivo.name}`
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
      return { caminho, url: data.publicUrl }
    })
    .filter((imagem) => !usadas.has(imagem.url))
}
