import React from 'react'
import type { Session } from '../types'

interface SessionSidebarProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: SessionSidebarProps) {
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

  return (
    <aside className="session-sidebar">
      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-state" style={{ height: 'auto', padding: '32px 16px' }}>
            <div className="empty-state-icon">{ }</div>
            <div className="empty-state-title">No Sessions</div>
            <div className="empty-state-description">
              Create a new session to start chatting
            </div>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="session-item-title">
                  {session.title || 'New Session'}
                </div>
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
