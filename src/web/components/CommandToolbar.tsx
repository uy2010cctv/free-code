import React from 'react'

interface CommandToolbarProps {
  onOpenSettings: () => void
  onOpenCommandPalette: () => void
  onExecuteCommand: (command: string) => void
}

const QUICK_COMMANDS = [
  { cmd: '/plan', icon: '📋', title: 'Plan' },
  { cmd: '/compact', icon: '📦', title: 'Compact' },
  { cmd: '/undo', icon: '↩️', title: 'Undo' },
  { cmd: '/diff', icon: '📄', title: 'Diff' },
  { cmd: '/status', icon: '📊', title: 'Status' },
]

export function CommandToolbar({ onOpenSettings, onOpenCommandPalette, onExecuteCommand }: CommandToolbarProps) {
  return (
    <div className="command-toolbar">
      <button className="toolbar-btn" onClick={onOpenCommandPalette} title="Command Palette (Ctrl+K)">
        <span className="toolbar-icon">⌘</span>
        <span className="toolbar-label">Commands</span>
      </button>

      <div className="toolbar-divider" />

      <div className="quick-commands">
        {QUICK_COMMANDS.map(({ cmd, icon, title }) => (
          <button
            key={cmd}
            className="quick-cmd-btn"
            onClick={() => onExecuteCommand(cmd)}
            title={title}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="toolbar-spacer" />

      <button className="toolbar-btn" onClick={onOpenSettings} title="Settings">
        <span className="toolbar-icon">⚙️</span>
        <span className="toolbar-label">Settings</span>
      </button>
    </div>
  )
}
