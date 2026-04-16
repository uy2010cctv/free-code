import React, { useState, useEffect } from 'react'
import type { Message } from '../types'
import { useTranslation } from '../i18n'

interface Props {
  messages: Message[]
  onSelect: (messageId: string) => void
  onClose: () => void
}

export function MessageSelector({ messages, onSelect, onClose }: Props) {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter selectable user messages (same logic as CLI)
  const selectableMessages = messages.filter(msg => {
    if (msg.type !== 'user' && msg.role !== 'user') return false

    const content = typeof msg.content === 'string' ? msg.content : ''
    if (content.includes('<tool_result>')) return false
    if (msg.isMeta || msg.isSynthetic || msg.isCompactSummary) return false
    if (content.includes('<local_command_stdout>') ||
        content.includes('<local_command_stderr>') ||
        content.includes('<bash_stdout>') ||
        content.includes('<bash_stderr>') ||
        content.includes('<task_notification>') ||
        content.includes('<tick>')) {
      return false
    }
    return true
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          setSelectedIndex(i => Math.max(0, i - 1))
          break
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          setSelectedIndex(i => Math.min(selectableMessages.length - 1, i + 1))
          break
        case 'Enter':
          e.preventDefault()
          if (selectableMessages[selectedIndex]) {
            onSelect(selectableMessages[selectedIndex].id)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, selectableMessages, onSelect, onClose])

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function truncateContent(content: string, maxLength: number = 100): string {
    const clean = content.replace(/<[^>]+>/g, '').trim()
    if (clean.length <= maxLength) return clean
    return clean.slice(0, maxLength) + '...'
  }

  if (selectableMessages.length === 0) {
    return (
      <div className="message-selector-overlay" onClick={onClose}>
        <div className="message-selector" onClick={e => e.stopPropagation()}>
          <div className="message-selector-header">
            <h3>{t('rewind')}</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="message-selector-empty">
            {t('noMessagesToRewind')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-selector-overlay" onClick={onClose}>
      <div className="message-selector" onClick={e => e.stopPropagation()}>
        <div className="message-selector-header">
          <h3>{t('rewindToPrevious')}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="message-selector-hint">
          {t('useArrowKeys')}
        </div>
        <div className="message-selector-list">
          {selectableMessages.map((msg, index) => {
            const isSelected = index === selectedIndex
            return (
              <div
                key={msg.id}
                className={`message-selector-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(msg.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="message-selector-item-header">
                  <span className="message-index">#{selectableMessages.length - index}</span>
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="message-selector-item-content">
                  {truncateContent(msg.content)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
