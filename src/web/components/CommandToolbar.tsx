import React from 'react'
import { useTranslation } from '../i18n'

interface CommandToolbarProps {
  onOpenSettings: () => void
  onOpenCommandPalette: () => void
  onExecuteCommand: (command: string) => void
  onToggleWorkspace: () => void
  onExportConversation?: () => void
  isWorkspaceOpen?: boolean
  isAdminMode?: boolean
  activeSurface: 'workspace' | 'admin'
  onSelectSurface: (surface: 'workspace' | 'admin') => void
}

const QUICK_COMMANDS = [
  { cmd: '/rewind', icon: '⏪' },
]

export function CommandToolbar({
  onOpenSettings,
  onOpenCommandPalette,
  onExecuteCommand,
  onToggleWorkspace,
  onExportConversation,
  isWorkspaceOpen,
  isAdminMode,
  activeSurface,
  onSelectSurface,
}: CommandToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="command-toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-brand-icon">◈</span>
        <span className="toolbar-brand-name">Enterprise Web Agent</span>
        {isAdminMode && <span className="toolbar-admin-badge">Admin</span>}
      </div>

      <div className="toolbar-divider" />
      <div className="surface-switcher" data-testid="surface-switcher">
        <button
          className={`toolbar-btn ${activeSurface === 'workspace' ? 'active' : ''}`}
          data-testid="surface-workspace"
          onClick={() => onSelectSurface('workspace')}
        >
          <span className="toolbar-icon">◧</span>
          <span className="toolbar-label">Agent Workspace</span>
        </button>
        <button
          className={`toolbar-btn ${activeSurface === 'admin' ? 'active' : ''}`}
          data-testid="surface-admin"
          onClick={() => onSelectSurface('admin')}
        >
          <span className="toolbar-icon">▦</span>
          <span className="toolbar-label">Admin Studio</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <button className="toolbar-btn" onClick={onOpenCommandPalette} title="Command Palette (Ctrl+K)">
        <span className="toolbar-icon">⌘</span>
        <span className="toolbar-label">{t('commands')}</span>
      </button>

      <div className="quick-commands">
        {QUICK_COMMANDS.map(({ cmd, icon }) => (
          <button
            key={cmd}
            className="quick-cmd-btn"
            onClick={() => onExecuteCommand(cmd)}
            title={t('rewind')}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="toolbar-spacer" />

      <button
        className={`toolbar-btn ${isWorkspaceOpen ? 'active' : ''}`}
        onClick={onToggleWorkspace}
        title={t('workspace')}
      >
        <span className="toolbar-icon">📁</span>
        <span className="toolbar-label">{t('workspace')}</span>
      </button>

      {onExportConversation && (
        <button className="toolbar-btn" onClick={onExportConversation} title="Export conversation">
          <span className="toolbar-icon">↓</span>
          <span className="toolbar-label">Export</span>
        </button>
      )}

      <button className="toolbar-btn" onClick={onOpenSettings} title={t('settings')}>
        <span className="toolbar-icon">⚙️</span>
        <span className="toolbar-label">{t('settings')}</span>
      </button>
    </div>
  )
}
