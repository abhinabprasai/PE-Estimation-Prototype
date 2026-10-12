import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 }, // 5173 is used by another local project on this machine
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
