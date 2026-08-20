import { defineConfig } from 'vite'
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
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
})
