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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }

          if (id.includes('node_modules/@tiptap/')) {
            return 'tiptap-vendor';
          }

          if (id.includes('node_modules/prosemirror-')) {
            return 'prosemirror-vendor';
          }

          if (
            id.includes('node_modules/lowlight/') ||
            id.includes('node_modules/highlight.js/')
          ) {
            return 'syntax-vendor';
          }

          if (
            id.includes('node_modules/tippy.js/') ||
            id.includes('node_modules/@floating-ui/')
          ) {
            return 'floating-vendor';
          }

          if (
            id.includes('node_modules/react-pdf/') ||
            id.includes('node_modules/pdfjs-dist/')
          ) {
            return 'pdf-vendor';
          }

          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
        },
      },
    },
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
