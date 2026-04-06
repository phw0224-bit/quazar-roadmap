import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.jsx'
import { LayoutProvider } from './hooks/useLayoutState.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LayoutProvider>
        <App />
      </LayoutProvider>
    </ThemeProvider>
  </StrictMode>,
)
