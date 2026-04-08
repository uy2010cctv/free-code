import React, { useRef, useEffect } from 'react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
  isLoading?: boolean
  onCancel?: () => void
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
  isLoading = false,
  onCancel,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault()
      if (value.trim() && !disabled && !isLoading) {
        onSubmit(value)
      }
    }
  }

  function handleSubmit() {
    if (value.trim() && !disabled && !isLoading) {
      onSubmit(value)
    }
  }

  function handleCancel() {
    onCancel?.()
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
          placeholder={
            disabled
              ? 'Select or create a session to start...'
              : isLoading
                ? 'Processing...'
                : 'Type a message (Enter to send, Shift+Enter for new line)'
          }
          disabled={disabled || isLoading}
          rows={1}
        />
        {isLoading ? (
          <button
            className="prompt-cancel-btn"
            onClick={handleCancel}
          >
            Stop
          </button>
        ) : (
          <button
            className="prompt-submit-btn"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
          >
            Send
          </button>
        )}
      </div>
      <div className="prompt-shortcuts">
        <span className="shortcut"><kbd>Enter</kbd> Send</span>
        <span className="shortcut"><kbd>Shift</kbd>+<kbd>Enter</kbd> New line</span>
        <span className="shortcut"><kbd>Ctrl</kbd>+<kbd>C</kbd> Cancel</span>
        <span className="shortcut"><kbd>Ctrl</kbd>+<kbd>R</kbd> History</span>
      </div>
    </div>
  )
}
