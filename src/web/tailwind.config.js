/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'term-bg': '#1a1a2e',
        'term-surface': '#16213e',
        'term-border': '#0f3460',
        'term-text': '#e8e8e8',
        'term-muted': '#8892a0',
        'term-accent': '#00d9ff',
        'term-user': '#4ade80',
        'term-assistant': '#60a5fa',
        'term-tool': '#f59e0b',
        'term-error': '#ef4444',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
