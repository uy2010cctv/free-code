import React, { useRef, useEffect } from 'react'
import type { Message } from '../types'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="message-list">
        <div className="empty-state">
          <div className="empty-state-icon">[ ]</div>
          <div className="empty-state-title">Ready to Assist</div>
          <div className="empty-state-description">
            Type a message below to start a conversation with the AI coding agent.
          </div>
        </div>
      </div>
    )
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function renderContent(content: string): React.ReactNode {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```|`([^`]+)`/
    if (codeBlockRegex.test(content)) {
      const parts: React.ReactNode[] = []
      let lastIndex = 0
      const regex = /```(\w+)?\n([\s\S]*?)```|`([^`]+)`/g
      let match

      while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.slice(lastIndex, match.index))
        }
        if (match[3]) {
          parts.push(<code key={match.index} className="bg-term-surface px-1.5 py-0.5 rounded text-sm">{match[3]}</code>)
        } else {
          const lang = match[1] || ''
          const code = match[2]
          parts.push(
            <pre key={match.index} className="bg-term-surface p-3 rounded-md overflow-x-auto my-2">
              <code>{code}</code>
            </pre>
          )
        }
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex))
      }
      return parts
    }
    return content
  }

  return (
    <div ref={containerRef} className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className="message-row">
          <div className="message-header">
            <span className={`message-role ${msg.type === 'user' ? 'user' : msg.type === 'assistant' ? 'assistant' : 'tool'}`}>
              {msg.type === 'tool_use' ? (msg.toolName || 'tool') : msg.type}
            </span>
            <span className="message-timestamp">{formatTime(msg.timestamp)}</span>
          </div>
          <div className="message-content">
            {renderContent(msg.content)}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="message-row">
          <div className="message-header">
            <span className="message-role assistant">assistant</span>
            <span className="message-timestamp">thinking...</span>
          </div>
          <div className="message-content">
            <div className="loading-indicator">
              <div className="loading-spinner" />
              <span>Processing your request...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
