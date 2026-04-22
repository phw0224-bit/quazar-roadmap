import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.jsx'
import { LayoutProvider } from './hooks/useLayoutState.jsx'

if (import.meta.env.PROD) {
  const { registerSW } = await import('virtual:pwa-register')
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const shouldUpdate = window.confirm('새 버전이 배포되었습니다. 지금 새로고침할까요?')
      if (shouldUpdate) {
        updateSW(true)
      }
    },
  })
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.warn('Service Worker 해제 실패:', error))

  if ('caches' in window) {
    window.caches.keys()
      .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      .catch((error) => console.warn('Service Worker 캐시 삭제 실패:', error))
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LayoutProvider>
        <App />
      </LayoutProvider>
    </ThemeProvider>
  </StrictMode>,
)
