import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'icons.svg',
      ],
      manifest: {
        id: '/',
        name: 'Quazar Roadmap',
        short_name: 'Quazar',
        description: '팀별 커스텀 로드맵 및 작업 관리 도구',
        start_url: '/',
        scope: '/',
        display_override: ['window-controls-overlay', 'standalone'],
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0B1020',
        theme_color: '#111827',
        lang: 'ko-KR',
        prefer_related_applications: false,
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-network-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'express-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 10,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
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
