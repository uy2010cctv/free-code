import { useEffect } from 'react'

interface UseWebKeybindingsOptions {
  onCancel?: () => void
  onClear?: () => void
  onHistorySearch?: () => void
  onCommandPalette?: () => void
}

export function useWebKeybindings(options: UseWebKeybindingsOptions = {}) {
  const { onCancel, onClear, onHistorySearch, onCommandPalette } = options

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K: Command palette
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        onCommandPalette?.()
        return
      }

      // Ctrl+R: History search
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        onHistorySearch?.()
        return
      }

      // Ctrl+C: Cancel request (when no text selected)
      if (e.ctrlKey && e.key === 'c') {
        if (!window.getSelection()?.toString()) {
          e.preventDefault()
          onCancel?.()
        }
        return
      }

      // Ctrl+L: Clear screen
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        onClear?.()
        return
      }

      // Escape: Cancel request
      if (e.key === 'Escape') {
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, onClear, onHistorySearch, onCommandPalette])
}
