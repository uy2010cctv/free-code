import React, { useState, useRef, useEffect } from 'react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
}

export function PromptInput({ value, onChange, onSubmit, disabled }: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) {
        onSubmit(value)
      }
    }
  }

  function handleSubmit() {
    if (value.trim() && !disabled) {
      onSubmit(value)
    }
  }

  return (
    <div className="prompt-input-container">
      <div className="prompt-input-wrapper">
        <textarea
          ref={textareaRef}
          className="prompt-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select or create a session to start...' : 'Type a message (Enter to send, Shift+Enter for new line)'}
          disabled={disabled}
          rows={1}
        />
        <button
          className="prompt-submit-btn"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
        >
          Send
        </button>
      </div>
      <div className="mt-2 text-xs text-term-muted text-center">
        <span className="mx-2">Ctrl+R: History</span>
        <span className="mx-2">Ctrl+C: Cancel</span>
        <span className="mx-2">Tab: Autocomplete</span>
      </div>
    </div>
  )
}
