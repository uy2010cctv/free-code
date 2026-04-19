import { useEffect } from 'react'

interface UseWebKeybindingsOptions {
  onSubmit?: () => void
  onCancel?: () => void
  onClear?: () => void
  onHistorySearch?: () => void
  onCommandPalette?: () => void
}

export function useWebKeybindings(options: UseWebKeybindingsOptions = {}) {
  const { onSubmit, onCancel, onClear, onHistorySearch, onCommandPalette } = options

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const modKey = e.ctrlKey || e.metaKey

      // Ctrl/Cmd+K: Command palette
      if (modKey && e.key === 'k') {
        e.preventDefault()
        onCommandPalette?.()
        return
      }

      // Ctrl/Cmd+R: History search
      if (modKey && e.key === 'r') {
        e.preventDefault()
        onHistorySearch?.()
        return
      }

      // Ctrl/Cmd+Enter: Submit message
      if (modKey && e.key === 'Enter') {
        e.preventDefault()
        onSubmit?.()
        return
      }

      // Ctrl/Cmd+C: Cancel request (when no text selected)
      if (modKey && e.key === 'c') {
        if (!window.getSelection()?.toString()) {
          e.preventDefault()
          onCancel?.()
        }
        return
      }

      // Ctrl/Cmd+Shift+L: Clear session conversation
      if (modKey && e.key === 'L') {
        e.preventDefault()
        onClear?.()
        return
      }

      // Escape: Cancel request
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSubmit, onCancel, onClear, onHistorySearch, onCommandPalette])
}
