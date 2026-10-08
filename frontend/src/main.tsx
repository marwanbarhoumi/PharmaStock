import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { DEFAULT_LOCALE, getDirection, isLocale } from '@/i18n'
import '@/index.css'

const STORAGE_KEY = 'pharmastock-locale'
const stored = window.localStorage.getItem(STORAGE_KEY)
const initialLocale = isLocale(stored) ? stored : DEFAULT_LOCALE
document.documentElement.lang = initialLocale
document.documentElement.dir = getDirection(initialLocale)

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
