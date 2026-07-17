import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),   // ← doit être AVANT react() pour que les classes soient dispo
    react(),
  ],
  server: {
    port: 5173,
  },
})
