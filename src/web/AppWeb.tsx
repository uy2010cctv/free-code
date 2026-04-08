import React, { useState, useEffect, useCallback } from 'react'
import { SessionSidebar } from './components/SessionSidebar'
import { MessageList } from './components/MessageList'
import { PromptInput } from './components/PromptInput'
import { CommandToolbar } from './components/CommandToolbar'
import { CommandPalette } from './components/CommandPalette'
import { SettingsManager } from './components/SettingsManager'
import { useWebKeybindings } from './hooks/useWebKeybindings'
import type { Session, Message, StreamEvent } from './types'

export function AppWeb() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleCancelRequest = useCallback(() => {
    if (!isLoading || !activeSessionId) return
    fetch(`/api/sessions/${activeSessionId}/query`, { method: 'DELETE' }).catch(console.error)
  }, [isLoading, activeSessionId])

  const handleOpenCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true)
  }, [])

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const handleCloseCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  useWebKeybindings({
    onCancel: handleCancelRequest,
    onCommandPalette: handleOpenCommandPalette,
  })

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
        // Convert role to type for frontend compatibility
        const converted = data.map((msg: any) => ({
          ...msg,
          type: msg.role || msg.type || 'assistant',
        }))
        setMessages(converted)
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
        setError(null)
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

  function handleExecuteCommand(command: string) {
    if (command.startsWith('/')) {
      // Handle slash commands
      const cmd = command.slice(1).split(' ')[0]
      if (cmd === 'clear') {
        setMessages([])
      } else if (cmd === 'plan') {
        handleSubmitQuery('Please create a plan for the current task.')
      } else if (cmd === 'compact') {
        handleSubmitQuery('Please compact the conversation context.')
      } else if (cmd === 'undo') {
        handleSubmitQuery('Please undo the last change.')
      } else if (cmd === 'diff') {
        handleSubmitQuery('Please show the uncommitted changes.')
      } else if (cmd === 'status') {
        handleSubmitQuery('Please show the current status.')
      } else {
        handleSubmitQuery(`/${cmd}`)
      }
    } else {
      handleSubmitQuery(command)
    }
  }

  async function handleSubmitQuery(query: string) {
    if (!activeSessionId || !query.trim() || isLoading) return

    setIsLoading(true)
    setInputValue('')
    setError(null)

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
                const event = JSON.parse(line.slice(6)) as StreamEvent
                handleStreamEvent(event)
              } catch (e) {
                // Ignore parse errors for partial data
              }
            }
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(errorData.error || 'Request failed')
      }
    } catch (err: any) {
      console.error('Query failed:', err)
      setError(err.message || 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  function handleStreamEvent(event: StreamEvent) {
    switch (event.type) {
      case 'user':
        break

      case 'assistant':
        setMessages(prev => {
          const existing = prev.find(m => m.id === event.id)
          if (existing) {
            return prev.map(m => m.id === event.id ? { ...m, content: event.content } : m)
          }
          return [...prev, {
            id: event.id,
            type: 'assistant',
            content: event.content,
            timestamp: event.timestamp,
          }]
        })
        break

      case 'tool_use':
        setMessages(prev => [...prev, {
          id: event.id,
          type: 'tool_use',
          content: `Calling tool: ${event.toolName}`,
          toolName: event.toolName,
          toolInput: event.input,
          timestamp: event.timestamp,
        }])
        break

      case 'tool_result':
        setMessages(prev => [...prev, {
          id: event.id,
          type: 'tool_result',
          content: event.result.output || event.result.error || '',
          toolName: event.toolName,
          toolResult: event.result,
          timestamp: event.timestamp,
        }])
        break

      case 'system':
        setMessages(prev => [...prev, {
          id: event.id || crypto.randomUUID(),
          type: 'system',
          content: event.content,
          timestamp: event.timestamp,
        }])
        break

      case 'error':
        setError(event.error)
        break

      case 'done':
        break
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
        <CommandToolbar
          onOpenSettings={handleOpenSettings}
          onOpenCommandPalette={handleOpenCommandPalette}
          onExecuteCommand={handleExecuteCommand}
        />
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        <MessageList messages={messages} isLoading={isLoading} />
        <PromptInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmitQuery}
          disabled={isLoading || !activeSessionId}
          isLoading={isLoading}
          onCancel={handleCancelRequest}
        />
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={handleCloseCommandPalette}
        onExecuteCommand={handleExecuteCommand}
      />

      <SettingsManager
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
      />
    </div>
  )
}
