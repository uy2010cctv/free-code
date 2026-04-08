import React from 'react'
import { createRoot } from 'react-dom/client'
import hljs from 'highlight.js'
import { AppWeb } from './AppWeb'

// Make hljs available globally
window.hljs = hljs

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <AppWeb />
  </React.StrictMode>
)
