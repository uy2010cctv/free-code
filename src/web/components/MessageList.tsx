import React, { useRef, useEffect } from 'react'
import type { Message } from '../types'
import { CodeBlock } from './CodeBlock'
import { ToolResultPanel } from './ToolResultPanel'

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
    if (!content) return null

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    // Match code blocks and inline code
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const inlineCodeRegex = /`([^`]+)`/g

    // Find all matches
    const matches: { type: 'block' | 'inline'; start: number; end: number; content: string; lang?: string }[] = []

    let match

    // Code blocks
    while ((match = codeBlockRegex.exec(content)) !== null) {
      matches.push({
        type: 'block',
        start: match.index,
        end: match.index + match[0].length,
        content: match[2],
        lang: match[1] || 'plaintext',
      })
    }

    // Find inline code (that isn't already in a code block)
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      const isInBlock = matches.some(m => m.start <= match!.index && m.end >= match!.index + match![0].length)
      if (!isInBlock) {
        matches.push({
          type: 'inline',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
        })
      }
    }

    // Sort by position
    matches.sort((a, b) => a.start - b.start)

    // Build parts
    for (const m of matches) {
      if (m.start > lastIndex) {
        parts.push(content.slice(lastIndex, m.start))
      }

      if (m.type === 'block') {
        parts.push(
          <CodeBlock key={m.start} code={m.content} language={m.lang} />
        )
      } else {
        parts.push(
          <code key={m.start} className="inline-code">{m.content}</code>
        )
      }

      lastIndex = m.end
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return parts.length > 0 ? parts : content
  }

  function renderMessage(msg: Message): React.ReactNode {
    if (msg.type === 'tool_result' && msg.toolResult) {
      return (
        <ToolResultPanel
          toolName={msg.toolName || 'tool'}
          input={msg.toolInput || {}}
          result={msg.toolResult}
          isExpanded={true}
        />
      )
    }

    return renderContent(msg.content)
  }

  function getRoleLabel(msg: Message): string {
    switch (msg.type) {
      case 'user':
        return 'user'
      case 'assistant':
        return 'assistant'
      case 'tool_use':
        return msg.toolName || 'tool'
      case 'tool_result':
        return `${msg.toolName} result`
      case 'system':
        return 'system'
      default:
        return msg.type
    }
  }

  function getRoleClass(msg: Message): string {
    switch (msg.type) {
      case 'user':
        return 'user'
      case 'assistant':
        return 'assistant'
      case 'tool_use':
        return 'tool'
      case 'tool_result':
        return msg.toolResult?.success ? 'tool-success' : 'tool-error'
      case 'system':
        return 'system'
      default:
        return 'default'
    }
  }

  return (
    <div ref={containerRef} className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`message-row message-${msg.type}`}>
          <div className="message-header">
            <span className={`message-role ${getRoleClass(msg)}`}>
              {getRoleLabel(msg)}
            </span>
            <span className="message-timestamp">{formatTime(msg.timestamp)}</span>
          </div>
          <div className="message-content">
            {renderMessage(msg)}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="message-row message-assistant">
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
