// `defineConfig` vem de 'vitest/config' (não de 'vite'): é o mesmo config do
// Vite, só que com o campo `test` tipado — sem isso o typecheck reclama de
// propriedade desconhecida.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // A taxonomia é dado do projeto, não do app: fonte única em /seeds.
      '@seeds': path.resolve(import.meta.dirname, '../seeds'),
      // Artefatos publicados pelo pipeline de ingestão — fonte única em /acervo.
      '@acervo': path.resolve(import.meta.dirname, '../acervo'),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    // Motor de domínio é TS puro — não precisa de DOM para testar.
    environment: 'node',
  },
})
