import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/playfair-display/600.css'
import '@fontsource/lora/600.css'
import '@fontsource/caveat/600.css'
import '@fontsource/marck-script/400.css'
import '@fontsource/pt-mono/400.css'
import './index.css'
import App from './App.tsx'

// HashRouter: на GitHub Pages немає серверного перенаправлення для вкладених адрес
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
