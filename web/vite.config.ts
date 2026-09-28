import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build gera UM ÚNICO arquivo dist/index.html (JS+CSS inline) — o cliente
// recebe esse arquivo, dá duplo-clique e abre no navegador dele, sem precisar
// instalar nada nem hospedar em servidor algum. Toda a "API" é o Supabase,
// acessado direto pelo navegador.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000_000,
  },
})
