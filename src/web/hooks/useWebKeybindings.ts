import { useEffect } from 'react'

export function useWebKeybindings() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        console.log('History search (Ctrl+R) - TODO: implement')
      }
      if (e.ctrlKey && e.key === 'c') {
        if (!window.getSelection()?.toString()) {
          e.preventDefault()
          console.log('Cancel request (Ctrl+C) - TODO: implement')
        }
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        console.log('Clear screen (Ctrl+L) - TODO: implement')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
