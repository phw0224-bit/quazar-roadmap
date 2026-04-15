import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { registerSW } from 'virtual:pwa-register'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.jsx'
import { LayoutProvider } from './hooks/useLayoutState.jsx'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const shouldUpdate = window.confirm('새 버전이 배포되었습니다. 지금 새로고침할까요?')
    if (shouldUpdate) {
      updateSW(true)
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LayoutProvider>
        <App />
      </LayoutProvider>
    </ThemeProvider>
  </StrictMode>,
)
