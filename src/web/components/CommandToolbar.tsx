import React from 'react'
import { useTranslation } from '../i18n'

interface CommandToolbarProps {
  onOpenSettings: () => void
  onOpenCommandPalette: () => void
  onExecuteCommand: (command: string) => void
  onToggleWorkspace: () => void
  isWorkspaceOpen?: boolean
}

const QUICK_COMMANDS = [
  { cmd: '/rewind', icon: '⏪' },
]

export function CommandToolbar({ onOpenSettings, onOpenCommandPalette, onExecuteCommand, onToggleWorkspace, isWorkspaceOpen }: CommandToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="command-toolbar">
      <button className="toolbar-btn" onClick={onOpenCommandPalette} title="Command Palette (Ctrl+K)">
        <span className="toolbar-icon">⌘</span>
        <span className="toolbar-label">{t('commands')}</span>
      </button>

      <div className="toolbar-divider" />

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

      <button className="toolbar-btn" onClick={onOpenSettings} title={t('settings')}>
        <span className="toolbar-icon">⚙️</span>
        <span className="toolbar-label">{t('settings')}</span>
      </button>
    </div>
  )
}
