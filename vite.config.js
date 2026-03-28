import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 1234,
    strictPort: true,
    allowedHosts: [
      'roadmap.ai-quazar.uk'
    ],
    proxy: {
      '/upload': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/api':    'http://localhost:3001',
    }
  },
  preview: {
    port: 1234,
    strictPort: true,
    allowedHosts: [
      'roadmap.ai-quazar.uk'
    ],
    proxy: {
      '/upload': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/api':    'http://localhost:3001',
    }
  }
})
