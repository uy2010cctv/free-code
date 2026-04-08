import React, { useState, useEffect } from 'react'
import { SessionSidebar } from './components/SessionSidebar'
import { MessageList } from './components/MessageList'
import { PromptInput } from './components/PromptInput'
import { useWebKeybindings } from './hooks/useWebKeybindings'
import type { Session, Message } from './types'

export function AppWeb() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useWebKeybindings()

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId)
    }
  }, [activeSessionId])

  async function loadSessions() {
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    }
  }

  async function loadSessionMessages(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  async function handleCreateSession() {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (res.ok) {
        const session = await res.json()
        setSessions(prev => [...prev, session])
        setActiveSessionId(session.id)
        setMessages([])
      }
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter(s => s.id !== sessionId)
          setActiveSessionId(remaining.length > 0 ? remaining[0].id : null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  async function handleSubmitQuery(query: string) {
    if (!activeSessionId || !query.trim() || isLoading) return

    setIsLoading(true)
    setInputValue('')

    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content: query,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      })

      if (response.ok && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                handleStreamEvent(event)
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      console.error('Query failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleStreamEvent(event: any) {
    if (event.type === 'assistant') {
      setMessages(prev => {
        const existing = prev.find(m => m.id === event.id)
        if (existing) {
          return prev.map(m => m.id === event.id ? { ...m, ...event } : m)
        }
        return [...prev, event]
      })
    } else if (event.type === 'tool_use') {
      setMessages(prev => [...prev, {
        id: event.id || crypto.randomUUID(),
        type: 'tool_use',
        content: event.content,
        toolName: event.toolName,
        timestamp: Date.now(),
      }])
    }
  }

  return (
    <div className="flex h-screen bg-term-bg text-term-text font-mono">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <MessageList messages={messages} isLoading={isLoading} />
        <PromptInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmitQuery}
          disabled={isLoading || !activeSessionId}
        />
      </main>
    </div>
  )
}
