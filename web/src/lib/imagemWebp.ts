import imageCompression from 'browser-image-compression'

// Converte a imagem escolhida pelo usuário para WebP no navegador antes do
// upload — evita subir JPEG/PNG grandes e mantém o bucket consistente
// (imagens antigas em imagensProdutos/public/*.webp também são .webp).
export async function converterParaWebp(arquivo: File): Promise<Blob> {
  return imageCompression(arquivo, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    useWebWorker: true,
    fileType: 'image/webp',
  })
}

const CARACTERES = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function nomeAleatorio(tamanho = 8): string {
  const valores = new Uint32Array(tamanho)
  crypto.getRandomValues(valores)
  let resultado = ''
  for (let i = 0; i < tamanho; i++) {
    resultado += CARACTERES[valores[i] % CARACTERES.length]
  }
  return resultado
}
