import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import Router from './router.tsx'
import { ThemeProvider } from './components/theme-provider.tsx'
import { MpaProvider } from './context/mpaProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <MpaProvider>
        <Router />
      </MpaProvider>
    </ThemeProvider>
  </StrictMode>,
)
