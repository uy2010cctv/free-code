import React, { useState, useEffect, useCallback } from 'react'
import { SessionSidebar } from './components/SessionSidebar'
import { MessageList } from './components/MessageList'
import { PromptInput } from './components/PromptInput'
import { CommandToolbar } from './components/CommandToolbar'
import { CommandPalette } from './components/CommandPalette'
import { MessageSelector } from './components/MessageSelector'
import { WorkspacePanel } from './components/WorkspacePanel'
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
  const [isMessageSelectorVisible, setIsMessageSelectorVisible] = useState(false)
  const [selectableMessages, setSelectableMessages] = useState<Message[]>([])
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [workspaceFile, setWorkspaceFile] = useState<string | null>(null)
  const [workspaceContent, setWorkspaceContent] = useState('')
  const [workspaceOriginalContent, setWorkspaceOriginalContent] = useState('')
  const [workspaceFileTree, setWorkspaceFileTree] = useState<Array<{ name: string; path: string; isDirectory: boolean }>>([])

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

  const openMessageSelector = useCallback(async () => {
    if (!activeSessionId) return
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/rewind/messages`)
      if (res.ok) {
        const msgs = await res.json()
        setSelectableMessages(msgs)
        setIsMessageSelectorVisible(true)
      }
    } catch (err) {
      console.error('Failed to load selectable messages:', err)
    }
  }, [activeSessionId])

  const handleRewindSelect = useCallback(async (messageId: string) => {
    if (!activeSessionId) return
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/rewind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
      }
    } catch (err) {
      console.error('Failed to rewind:', err)
    } finally {
      setIsMessageSelectorVisible(false)
    }
  }, [activeSessionId])

  const handleCloseMessageSelector = useCallback(() => {
    setIsMessageSelectorVisible(false)
  }, [])

  async function handleWorkspaceFileSelect(path: string) {
    if (!activeSessionId) return
    try {
      // Store the full path for preview components
      setWorkspaceFile(path)

      // For text files, read content via workspace endpoint
      const ext = path.toLowerCase().split('.').pop()
      const isBinary = ['docx', 'xlsx', 'doc', 'xls', 'pdf'].includes(ext || '')

      if (isBinary) {
        // Binary files don't need content loaded - preview components handle them
        setWorkspaceContent('')
        setWorkspaceOriginalContent('')
      } else {
        // Text files - read content
        const fileName = path.split('/').pop() || path
        const res = await fetch(`/api/sessions/${activeSessionId}/workspace/read?path=${encodeURIComponent(fileName)}`)
        if (res.ok) {
          const data = await res.json()
          setWorkspaceContent(data.content)
          setWorkspaceOriginalContent(data.content)
        }
      }
    } catch (err) {
      console.error('Failed to read file:', err)
    }
  }

  async function loadWorkspaceFileTree() {
    if (!activeSessionId) return
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/workspace/files`)
      if (res.ok) {
        const files = await res.json()
        setWorkspaceFileTree(files)
      }
    } catch (err) {
      console.error('Failed to load file tree:', err)
    }
  }

  const handleToggleWorkspace = useCallback(() => {
    setIsWorkspaceOpen(prev => {
      if (!prev && activeSessionId) {
        // Loading file tree when opening
        loadWorkspaceFileTree()
      }
      return !prev
    })
  }, [activeSessionId])

  async function handleWorkspaceSave() {
    if (!workspaceFile || !activeSessionId) return
    try {
      await fetch(`/api/sessions/${activeSessionId}/workspace/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workspaceFile, content: workspaceContent }),
      })
      setWorkspaceOriginalContent(workspaceContent)
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }

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

  async function handleExecuteCommand(command: string) {
    if (command.startsWith('/')) {
      // Handle slash commands
      const parts = command.slice(1).split(' ')
      const cmd = parts[0]
      const args = parts.slice(1).join(' ')

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
      } else if (cmd === 'rewind' || cmd === 'checkpoint') {
        openMessageSelector()
      } else {
        // Try to execute as a skill
        await executeSkill(cmd, args)
      }
    } else {
      handleSubmitQuery(command)
    }
  }

  async function executeSkill(skillName: string, args: string) {
    if (!activeSessionId) return
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName, args }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          // Add skill output as assistant message
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            type: 'assistant',
            content: data.output || '(no output)',
            timestamp: Date.now(),
          }
          setMessages(prev => [...prev, assistantMessage])
        } else {
          setError(data.error || 'Skill execution failed')
        }
      }
    } catch (err) {
      console.error('Failed to execute skill:', err)
      setError('Failed to execute skill')
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
        // Reload workspace after agent completes - may have created/edited files
        loadWorkspaceFileTree()
        // Auto-select first document if none selected and workspace has files
        if (!workspaceFile && workspaceFileTree.length > 0) {
          const firstDoc = workspaceFileTree.find(f =>
            !f.isDirectory && ['docx', 'doc', 'xlsx', 'xls'].includes(f.name.toLowerCase().split('.').pop() || '')
          )
          if (firstDoc) {
            handleWorkspaceFileSelect(firstDoc.path)
            setIsWorkspaceOpen(true)
          }
        }
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
          onToggleWorkspace={handleToggleWorkspace}
          isWorkspaceOpen={isWorkspaceOpen}
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

      {isMessageSelectorVisible && (
        <MessageSelector
          messages={selectableMessages}
          onSelect={handleRewindSelect}
          onClose={handleCloseMessageSelector}
        />
      )}

      <WorkspacePanel
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        currentFile={workspaceFile}
        fileContent={workspaceContent}
        onContentChange={setWorkspaceContent}
        onSave={handleWorkspaceSave}
        hasUnsavedChanges={workspaceContent !== workspaceOriginalContent}
        fileTree={workspaceFileTree}
        onFileSelect={handleWorkspaceFileSelect}
        activeSessionId={activeSessionId}
      />
    </div>
  )
}
