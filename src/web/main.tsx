import React from 'react'
import { createRoot } from 'react-dom/client'
import hljs from 'highlight.js'
import { AppWeb } from './AppWeb'
import { I18nProvider } from './i18n'

// Make hljs available globally
window.hljs = hljs

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <I18nProvider>
      <AppWeb />
    </I18nProvider>
  </React.StrictMode>
)
