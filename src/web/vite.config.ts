import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: path.join(__dirname),
  resolve: {
    alias: {
      '@': path.join(__dirname),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(__dirname, 'dist'),
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-monaco': ['@monaco-editor/react'],
          'vendor-xlsx': ['xlsx'],
          'vendor-docx': ['docx', 'docx-preview'],
        },
      },
    },
    chunkSizeWarningLimit: 1700, // MCP SDK (@modelcontextprotocol/sdk) is CJS-only and cannot be code-split; main bundle (~1.6MB) includes MCP SDK, Anthropic SDK, and Express which are all non-splitable vendor deps
  },
})
