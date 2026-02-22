import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/upload': 'http://localhost:8000',
      '/invoices': 'http://localhost:8000',
      '/export': 'http://localhost:8000',
    },
  },
})
