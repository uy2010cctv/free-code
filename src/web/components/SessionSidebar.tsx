import React, { useState } from 'react'
import type { Session } from '../types'

interface SessionSidebarProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
  isLoading?: boolean
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  isLoading = false,
}: SessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent')

  function formatTimestamp(ts: number): string {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function filterSessions(sessions: Session[]): Session[] {
    let filtered = sessions

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s => s.title?.toLowerCase().includes(query))
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (dateFilter === 'today') {
      filtered = filtered.filter(s => s.lastActivityAt >= startOfToday.getTime())
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(startOfToday.getTime() - 7 * 86400000)
      filtered = filtered.filter(s => s.lastActivityAt >= weekAgo.getTime())
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(startOfToday.getTime() - 30 * 86400000)
      filtered = filtered.filter(s => s.lastActivityAt >= monthAgo.getTime())
    }

    if (sortBy === 'alpha') {
      filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else {
      filtered = [...filtered].sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    }

    return filtered
  }

  const filteredSessions = filterSessions(sessions)

  function formatTimestamp(ts: number): string {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation()
    if (confirm('Delete this session?')) {
      onDeleteSession(sessionId)
    }
  }

  function startEdit(e: React.MouseEvent, sessionId: string, currentTitle: string) {
    e.stopPropagation()
    setEditingId(sessionId)
    setEditValue(currentTitle || '')
  }

  function commitEdit(sessionId: string) {
    const trimmed = editValue.trim()
    if (trimmed) {
      onRenameSession(sessionId, trimmed)
    }
    setEditingId(null)
    setEditValue('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  function handleEditKeyDown(e: React.KeyboardEvent, sessionId: string) {
    if (e.key === 'Enter') {
      commitEdit(sessionId)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  return (
    <aside className="session-sidebar">
      <div className="session-search-bar">
        <input
          type="text"
          className="session-search-input"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="session-search-clear"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>
      <div className="session-filter-bar">
        <select
          className="session-filter-select"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <select
          className="session-filter-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="recent">Most recent</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>
      <div className="session-list">
        {isLoading ? (
          <div className="session-skeleton-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="session-skeleton-item">
                <div className="skeleton-title" />
                <div className="skeleton-time" />
              </div>
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="empty-state" style={{ height: 'auto', padding: '32px 16px' }}>
            <div className="empty-state-icon">{ }</div>
            <div className="empty-state-title">No Sessions Found</div>
            <div className="empty-state-description">
              {searchQuery ? 'Try a different search term' : 'Create a new session to start chatting'}
            </div>
          </div>
        ) : (
          filteredSessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex-1 min-w-0">
                {editingId === session.id ? (
                  <input
                    className="session-title-input"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => handleEditKeyDown(e, session.id)}
                    onBlur={() => commitEdit(session.id)}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <div
                    className="session-item-title"
                    onDoubleClick={e => startEdit(e, session.id, session.title || 'New Session')}
                    title="Double-click to rename"
                  >
                    {session.title || 'New Session'}
                  </div>
                )}
                <div className="text-xs text-term-muted mt-1">
                  {formatTimestamp(session.lastActivityAt)}
                </div>
              </div>
              <button
                className="session-item-delete"
                onClick={(e) => handleDelete(e, session.id)}
                title="Delete session"
              >
                x
              </button>
            </div>
          ))
        )}
      </div>
      <button className="session-new-btn" onClick={onCreateSession}>
        + New Session
      </button>
    </aside>
  )
}
