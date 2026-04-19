import React, { useState, useEffect, useCallback } from 'react'
import { SessionSidebar } from './components/SessionSidebar'
import { MessageList } from './components/MessageList'
import { PromptInput } from './components/PromptInput'
import { CommandToolbar } from './components/CommandToolbar'
import { CommandPalette } from './components/CommandPalette'
import { MessageSelector } from './components/MessageSelector'
import { WorkspacePanel } from './components/WorkspacePanel'
import { SettingsManager } from './components/SettingsManager'
import { AdminStudio } from './components/AdminStudio'
import { useWebKeybindings } from './hooks/useWebKeybindings'
import { clearAdminToken, loadAdminToken, saveAdminToken } from './utils/adminSession'
import type {
  BusinessModule,
  DataSourceConnector,
  Message,
  ReportPlan,
  Session,
  StreamEvent,
} from './types'

export function AppWeb() {
  const initialUrl = typeof window !== 'undefined' ? new URL(window.location.href) : null
  const initialSurface = initialUrl?.searchParams.get('surface') === 'admin' ? 'admin' : 'workspace'
  const initialAdminPanel = (initialUrl?.searchParams.get('adminPanel') || 'overview') as 'overview' | 'sources' | 'modules' | 'reports'
  const [adminToken, setAdminToken] = useState<string | null>(() => loadAdminToken())
  const [hasAdminAccount, setHasAdminAccount] = useState(false)
  const [adminUsername, setAdminUsername] = useState<string | null>(null)
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
  const [connectors, setConnectors] = useState<DataSourceConnector[]>([])
  const [modules, setModules] = useState<BusinessModule[]>([])
  const [latestReportPlan, setLatestReportPlan] = useState<ReportPlan | null>(null)
  const [activeSurface, setActiveSurface] = useState<'workspace' | 'admin'>(initialSurface)
  const [adminPanel, setAdminPanel] = useState<'overview' | 'sources' | 'modules' | 'reports'>(
    ['overview', 'sources', 'modules', 'reports'].includes(initialAdminPanel) ? initialAdminPanel : 'overview',
  )

  function adminFetch(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers)
    if (adminToken) {
      headers.set('x-admin-session', adminToken)
    }
    return fetch(path, {
      ...init,
      headers,
    })
  }

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
    loadAdminStatus()
    if (adminToken) {
      loadConnectors()
      loadModules()
    } else {
      setConnectors([])
      setModules([])
    }
  }, [adminToken])

  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId)
    }
  }, [activeSessionId])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('surface', activeSurface)
    if (activeSurface === 'admin') {
      url.searchParams.set('adminPanel', adminPanel)
    } else {
      url.searchParams.delete('adminPanel')
    }
    window.history.replaceState({}, '', url)
  }, [activeSurface, adminPanel])

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

  async function loadConnectors() {
    if (!adminToken) return
    try {
      const res = await adminFetch('/api/admin/connectors')
      if (res.ok) {
        setConnectors(await res.json())
      }
    } catch (err) {
      console.error('Failed to load connectors:', err)
    }
  }

  async function loadModules() {
    if (!adminToken) return
    try {
      const res = await adminFetch('/api/admin/modules')
      if (res.ok) {
        setModules(await res.json())
      }
    } catch (err) {
      console.error('Failed to load modules:', err)
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

  async function handleRenameSession(sessionId: string, title: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s))
      }
    } catch (err) {
      console.error('Failed to rename session:', err)
    }
  }

  async function handleRetryMessage(messageId: string, content: string) {
    // Remove the failed message
    setMessages(prev => prev.filter(m => m.id !== messageId))
    // Resubmit the query
    handleSubmitQuery(content)
  }

  async function updateSessionConnectors(connectorIds: string[]) {
    if (!activeSessionId) return
    await adminFetch(`/api/sessions/${activeSessionId}/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectorIds }),
    })
    setSessions(prev => prev.map(session => (
      session.id === activeSessionId ? { ...session, selectedConnectorIds: connectorIds } : session
    )))
  }

  async function updateSessionModules(moduleIds: string[]) {
    if (!activeSessionId) return
    await adminFetch(`/api/admin/sessions/${activeSessionId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleIds }),
    })
    setSessions(prev => prev.map(session => (
      session.id === activeSessionId ? { ...session, selectedModuleIds: moduleIds } : session
    )))
  }

  async function publishModule(moduleId: string) {
    const res = await adminFetch(`/api/admin/modules/${moduleId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to publish module')
    }

    await loadModules()
  }

  async function createConnector(input: {
    id: string
    name: string
    kind: DataSourceConnector['kind']
    description: string
    capabilities: string[]
    schemaHints: string[]
    authType: DataSourceConnector['authType']
    status: DataSourceConnector['status']
    compatibilityStatus: DataSourceConnector['compatibilityStatus']
  }) {
    if (!adminToken) throw new Error('Admin login required')
    const res = await adminFetch('/api/admin/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        config: {},
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to register connector')
    }

    await loadConnectors()
  }

  async function createModule(input: {
    id: string
    name: string
    description: string
    prompts: string[]
    requiredConnectorKinds: BusinessModule['requiredConnectorKinds']
    reportTemplates: string[]
    outputFormats: BusinessModule['outputFormats']
  }) {
    if (!adminToken) throw new Error('Admin login required')
    const res = await adminFetch('/api/admin/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to save module')
    }

    await loadModules()
  }

  async function refreshModule(moduleId: string) {
    if (!adminToken) throw new Error('Admin login required')
    const res = await adminFetch(`/api/admin/modules/${moduleId}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to refresh module')
    }

    await loadModules()
  }

  async function loadAdminStatus() {
    try {
      const headers = new Headers()
      if (adminToken) {
        headers.set('x-admin-session', adminToken)
      }
      const res = await fetch('/api/admin/auth/status', { headers })
      if (!res.ok) return
      const data = await res.json()
      setHasAdminAccount(Boolean(data.hasAdminAccount))
      setAdminUsername(data.username || null)
      if (!data.isAuthenticated && adminToken) {
        setAdminToken(null)
        clearAdminToken()
        setConnectors([])
        setModules([])
      }
    } catch (err) {
      console.error('Failed to load admin status:', err)
    }
  }

  async function setupAdmin(credentials: { username: string; password: string; bootstrapSecret: string }) {
    const res = await fetch('/api/admin/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create admin account')
    }
    setAdminToken(data.token)
    setHasAdminAccount(true)
    setAdminUsername(data.username || credentials.username)
    saveAdminToken(data.token)
    await loadConnectors()
    await loadModules()
  }

  async function loginAdmin(credentials: { username: string; password: string }) {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to login')
    }
    setAdminToken(data.token)
    setHasAdminAccount(true)
    setAdminUsername(data.username || credentials.username)
    saveAdminToken(data.token)
    await loadConnectors()
    await loadModules()
  }

  async function logoutAdmin() {
    if (adminToken) {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { 'x-admin-session': adminToken },
      }).catch(() => {})
    }
    setAdminToken(null)
    setAdminUsername(null)
    setConnectors([])
    setModules([])
    clearAdminToken()
  }

  function toggleConnector(id: string) {
    const active = sessions.find(session => session.id === activeSessionId)
    const current = active?.selectedConnectorIds || []
    const next = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]
    updateSessionConnectors(next).catch(console.error)
  }

  function toggleModule(id: string) {
    const active = sessions.find(session => session.id === activeSessionId)
    const current = active?.selectedModuleIds || []
    const next = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]
    updateSessionModules(next).catch(console.error)
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
        // Mark the user's last message as failed so retry button appears
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.type === 'user' ? { ...m, failed: true } : m))
      }
    } catch (err: any) {
      console.error('Query failed:', err)
      setError(err.message || 'Request failed')
      // Mark the user's last message as failed so retry button appears
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.type === 'user' ? { ...m, failed: true } : m))
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

      case 'tool_start':
        setMessages(prev => [...prev, {
          id: event.id,
          type: 'tool_start',
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

      case 'tool_error':
        setMessages(prev => [...prev, {
          id: `${event.id}-error`,
          type: 'tool_error',
          content: event.error,
          toolName: event.toolName,
          timestamp: event.timestamp,
        }])
        break

      case 'state_update':
        setMessages(prev => [...prev, {
          id: `state-${event.phase}-${event.timestamp}`,
          type: 'state_update',
          content: event.detail,
          timestamp: event.timestamp,
          isMeta: true,
        }])
        break

      case 'report_plan':
        setLatestReportPlan({
          reportType: event.reportType,
          summary: event.summary,
          trace: event.trace,
          exports: event.exports,
        })
        setMessages(prev => [...prev, {
          id: `report-plan-${event.timestamp}`,
          type: 'report_plan',
          content: event.summary,
          timestamp: event.timestamp,
          reportPlan: {
            reportType: event.reportType,
            summary: event.summary,
            trace: event.trace,
            exports: event.exports,
          },
        }])
        break

      case 'system':
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
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
        onRenameSession={handleRenameSession}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <CommandToolbar
          onOpenSettings={handleOpenSettings}
          onOpenCommandPalette={handleOpenCommandPalette}
          onExecuteCommand={handleExecuteCommand}
          onToggleWorkspace={handleToggleWorkspace}
          isWorkspaceOpen={isWorkspaceOpen}
          activeSurface={activeSurface}
          onSelectSurface={setActiveSurface}
        />
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {activeSurface === 'workspace' ? (
          <>
            <MessageList messages={messages} isLoading={isLoading} onRetry={handleRetryMessage} />
            <PromptInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmitQuery}
              disabled={isLoading || !activeSessionId}
              isLoading={isLoading}
              onCancel={handleCancelRequest}
            />
          </>
        ) : (
          <AdminStudio
            connectors={connectors}
            modules={modules}
            selectedConnectorIds={sessions.find(session => session.id === activeSessionId)?.selectedConnectorIds || []}
            selectedModuleIds={sessions.find(session => session.id === activeSessionId)?.selectedModuleIds || []}
            latestReportPlan={latestReportPlan}
            onToggleConnector={toggleConnector}
            onToggleModule={toggleModule}
            onPublishModule={(id) => publishModule(id).catch(err => setError(err.message))}
            onCreateConnector={(input) => createConnector(input).catch(err => setError(err.message))}
            onCreateModule={(input) => createModule(input).catch(err => setError(err.message))}
            onRefreshModule={(id) => refreshModule(id).catch(err => setError(err.message))}
            hasAdminAccount={hasAdminAccount}
            isAdminAuthenticated={Boolean(adminToken)}
            adminUsername={adminUsername}
            onSetupAdmin={(credentials) => setupAdmin(credentials).catch(err => setError(err.message))}
            onLoginAdmin={(credentials) => loginAdmin(credentials).catch(err => setError(err.message))}
            onLogoutAdmin={() => logoutAdmin().catch(err => setError(err.message))}
            initialPanel={adminPanel}
            onPanelChange={setAdminPanel}
          />
        )}
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={handleCloseCommandPalette}
        onExecuteCommand={handleExecuteCommand}
      />

      <SettingsManager
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        connectors={connectors}
        modules={modules}
        selectedConnectorIds={sessions.find(session => session.id === activeSessionId)?.selectedConnectorIds || []}
        selectedModuleIds={sessions.find(session => session.id === activeSessionId)?.selectedModuleIds || []}
        latestReportPlan={latestReportPlan}
        onToggleConnector={toggleConnector}
        onToggleModule={toggleModule}
        onPublishModule={(id) => publishModule(id).catch(err => setError(err.message))}
        onCreateConnector={(input) => createConnector(input).catch(err => setError(err.message))}
        onCreateModule={(input) => createModule(input).catch(err => setError(err.message))}
        onRefreshModule={(id) => refreshModule(id).catch(err => setError(err.message))}
        hasAdminAccount={hasAdminAccount}
        isAdminAuthenticated={Boolean(adminToken)}
        adminUsername={adminUsername}
        onSetupAdmin={(credentials) => setupAdmin(credentials).catch(err => setError(err.message))}
        onLoginAdmin={(credentials) => loginAdmin(credentials).catch(err => setError(err.message))}
        onLogoutAdmin={() => logoutAdmin().catch(err => setError(err.message))}
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
        latestReportPlan={latestReportPlan}
      />
    </div>
  )
}
