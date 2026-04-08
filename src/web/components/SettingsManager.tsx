import React, { useState } from 'react'
import type { WebSettings, McpServer } from '../types/settings'
import { COMMANDS, getCommandsByCategory } from '../data/commands'
import type { Command } from '../types/settings'

interface SettingsManagerProps {
  isOpen: boolean
  onClose: () => void
}

const DEFAULT_SETTINGS: WebSettings = {
  api: {
    apiKey: '',
    baseURL: 'https://api.minimaxi.com/anthropic',
    model: 'claude-sonnet-4-6-20250514',
    temperature: 0.7,
    maxTokens: 4096,
  },
  permissions: {
    defaultMode: 'ask',
    allowBash: true,
    allowFileRead: true,
    allowFileWrite: true,
    allowNetwork: true,
    allowedCommands: [],
    blockedCommands: ['rm -rf /', 'dd if=', 'mkfs'],
  },
  ui: {
    theme: 'dark',
    fontSize: 14,
    streamResponses: true,
    showTokenCount: false,
  },
  sessions: {
    autoSave: true,
    autoSaveInterval: 30,
    maxSessions: 10,
  },
  commands: {
    enabledCommands: COMMANDS.map(c => c.name),
    commandSettings: Object.fromEntries(
      COMMANDS.map(c => [c.name, { enabled: true, aliases: c.aliases || [] }])
    ),
  },
  system: {
    autoCompactEnabled: true,
    thinkingEnabled: true,
    fastModeEnabled: false,
    promptSuggestionEnabled: true,
    speculationEnabled: true,
    fileCheckpointingEnabled: true,
    verbose: false,
    terminalProgressBarEnabled: true,
    showStatusInTerminalTab: false,
    showTurnDuration: true,
    showTips: true,
    reduceMotion: false,
    copyFullResponse: false,
    copyOnSelect: false,
    prStatusFooterEnabled: true,
    defaultPermissionMode: 'ask',
    respectGitignore: true,
    useAutoModeDuringPlan: true,
    notificationsChannel: 'auto',
    taskCompleteNotifEnabled: false,
    inputNeededNotifEnabled: false,
    agentPushNotifEnabled: false,
    autoUpdatesChannel: 'latest',
    editorMode: 'normal',
    outputStyle: 'default',
    language: 'Default',
    defaultView: 'transcript',
  },
}

export function SettingsManager({ isOpen, onClose }: SettingsManagerProps) {
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState<'api' | 'permissions' | 'ui' | 'sessions' | 'commands' | 'system'>('api')
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [commandSearch, setCommandSearch] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>('session')

  if (!isOpen) return null

  function updateSetting<K extends keyof WebSettings>(
    category: K,
    updates: Partial<WebSettings[K]>
  ) {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], ...updates },
    }))
  }

  function addMcpServer() {
    const newServer: McpServer = {
      id: crypto.randomUUID(),
      name: 'New Server',
      type: 'stdio',
      command: '',
      enabled: true,
    }
    setMcpServers(prev => [...prev, newServer])
  }

  function removeMcpServer(id: string) {
    setMcpServers(prev => prev.filter(s => s.id !== id))
  }

  function updateMcpServer(id: string, updates: Partial<McpServer>) {
    setMcpServers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            API
          </button>
          <button
            className={`settings-tab ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            Permissions
          </button>
          <button
            className={`settings-tab ${activeTab === 'ui' ? 'active' : ''}`}
            onClick={() => setActiveTab('ui')}
          >
            UI
          </button>
          <button
            className={`settings-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
          <button
            className={`settings-tab ${activeTab === 'commands' ? 'active' : ''}`}
            onClick={() => setActiveTab('commands')}
          >
            Commands
          </button>
          <button
            className={`settings-tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'api' && (
            <div className="settings-section">
              <div className="settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={settings.api.apiKey}
                  onChange={e => updateSetting('api', { apiKey: e.target.value })}
                  placeholder="sk-ant-..."
                />
              </div>

              <div className="settings-field">
                <label>Base URL</label>
                <input
                  type="text"
                  value={settings.api.baseURL}
                  onChange={e => updateSetting('api', { baseURL: e.target.value })}
                  placeholder="https://api.minimaxi.com/anthropic"
                />
              </div>

              <div className="settings-field">
                <label>Model</label>
                <select
                  value={settings.api.model}
                  onChange={e => updateSetting('api', { model: e.target.value })}
                >
                  <option value="claude-sonnet-4-6-20250514">Claude Sonnet 4.6</option>
                  <option value="claude-opus-4-6-20250514">Claude Opus 4.6</option>
                  <option value="claude-haiku-4-6-20250514">Claude Haiku 4.6</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Temperature ({settings.api.temperature})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.api.temperature}
                  onChange={e => updateSetting('api', { temperature: parseFloat(e.target.value) })}
                />
              </div>

              <div className="settings-field">
                <label>Max Tokens</label>
                <input
                  type="number"
                  value={settings.api.maxTokens}
                  onChange={e => updateSetting('api', { maxTokens: parseInt(e.target.value) })}
                  min="256"
                  max="32000"
                />
              </div>

              <div className="settings-field">
                <label>MCP Servers</label>
                <div className="mcp-server-list">
                  {mcpServers.map(server => (
                    <div key={server.id} className="mcp-server-item">
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={e => updateMcpServer(server.id, { enabled: e.target.checked })}
                      />
                      <input
                        type="text"
                        value={server.name}
                        onChange={e => updateMcpServer(server.id, { name: e.target.value })}
                        placeholder="Server name"
                      />
                      <select
                        value={server.type}
                        onChange={e => updateMcpServer(server.id, { type: e.target.value as 'stdio' | 'http' })}
                      >
                        <option value="stdio">STDIO</option>
                        <option value="http">HTTP</option>
                      </select>
                      <button onClick={() => removeMcpServer(server.id)} className="btn-danger">×</button>
                    </div>
                  ))}
                  <button onClick={addMcpServer} className="btn-secondary">+ Add MCP Server</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="settings-section">
              <div className="settings-field">
                <label>Default Permission Mode</label>
                <select
                  value={settings.permissions.defaultMode}
                  onChange={e => updateSetting('permissions', { defaultMode: e.target.value as any })}
                >
                  <option value="ask">Ask (prompt for each)</option>
                  <option value="accept">Accept (allow by default)</option>
                  <option value="reject">Reject (deny by default)</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Allowed Operations</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.permissions.allowBash}
                      onChange={e => updateSetting('permissions', { allowBash: e.target.checked })}
                    />
                    Allow Bash Commands
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.permissions.allowFileRead}
                      onChange={e => updateSetting('permissions', { allowFileRead: e.target.checked })}
                    />
                    Allow File Read
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.permissions.allowFileWrite}
                      onChange={e => updateSetting('permissions', { allowFileWrite: e.target.checked })}
                    />
                    Allow File Write
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.permissions.allowNetwork}
                      onChange={e => updateSetting('permissions', { allowNetwork: e.target.checked })}
                    />
                    Allow Network Requests
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Blocked Commands (one per line)</label>
                <textarea
                  value={settings.permissions.blockedCommands.join('\n')}
                  onChange={e => updateSetting('permissions', {
                    blockedCommands: e.target.value.split('\n').filter(Boolean)
                  })}
                  placeholder="rm -rf /&#10;dd if=&#10;mkfs"
                  rows={4}
                />
              </div>
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="settings-section">
              <div className="settings-field">
                <label>Theme</label>
                <select
                  value={settings.ui.theme}
                  onChange={e => updateSetting('ui', { theme: e.target.value as 'dark' | 'light' })}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Font Size ({settings.ui.fontSize}px)</label>
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={settings.ui.fontSize}
                  onChange={e => updateSetting('ui', { fontSize: parseInt(e.target.value) })}
                />
              </div>

              <div className="settings-field">
                <label>Display Options</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.ui.streamResponses}
                      onChange={e => updateSetting('ui', { streamResponses: e.target.checked })}
                    />
                    Stream Responses
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.ui.showTokenCount}
                      onChange={e => updateSetting('ui', { showTokenCount: e.target.checked })}
                    />
                    Show Token Count
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="settings-section">
              <div className="settings-field">
                <label>Auto-save Sessions</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.sessions.autoSave}
                      onChange={e => updateSetting('sessions', { autoSave: e.target.checked })}
                    />
                    Enable auto-save
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Auto-save Interval ({settings.sessions.autoSaveInterval}s)</label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="10"
                  value={settings.sessions.autoSaveInterval}
                  onChange={e => updateSetting('sessions', { autoSaveInterval: parseInt(e.target.value) })}
                />
              </div>

              <div className="settings-field">
                <label>Max Sessions to Keep</label>
                <input
                  type="number"
                  value={settings.sessions.maxSessions}
                  onChange={e => updateSetting('sessions', { maxSessions: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                />
              </div>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="settings-section commands-section">
              <div className="settings-field">
                <label>Search Commands</label>
                <input
                  type="text"
                  value={commandSearch}
                  onChange={e => setCommandSearch(e.target.value)}
                  placeholder="Type to filter commands..."
                  className="command-search-input"
                />
              </div>

              <div className="command-category-list">
                {Object.entries(getCommandsByCategory()).map(([category, commands]) => {
                  const filteredCommands = commands.filter(cmd =>
                    cmd.name.toLowerCase().includes(commandSearch.toLowerCase()) ||
                    cmd.description.toLowerCase().includes(commandSearch.toLowerCase())
                  )
                  if (filteredCommands.length === 0) return null

                  return (
                    <div key={category} className="command-category-item">
                      <div
                        className="command-category-header"
                        onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                      >
                        <span className="command-category-icon">
                          {expandedCategory === category ? '▼' : '▶'}
                        </span>
                        <span className="command-category-name">
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </span>
                        <span className="command-category-count">
                          {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {expandedCategory === category && (
                        <div className="command-list-config">
                          {filteredCommands.map(cmd => {
                            const cmdSetting = settings.commands.commandSettings[cmd.name]
                            return (
                              <div key={cmd.name} className="command-config-item">
                                <div className="command-config-header">
                                  <label className="checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={settings.commands.enabledCommands.includes(cmd.name)}
                                      onChange={e => {
                                        const enabled = e.target.checked
                                        updateSetting('commands', {
                                          enabledCommands: enabled
                                            ? [...settings.commands.enabledCommands, cmd.name]
                                            : settings.commands.enabledCommands.filter(n => n !== cmd.name)
                                        })
                                      }}
                                    />
                                  </label>
                                  <span className="command-name">/{cmd.name}</span>
                                  <span className="command-description">{cmd.description}</span>
                                </div>

                                {cmd.args && cmd.args.length > 0 && (
                                  <div className="command-args-config">
                                    <span className="command-args-label">Args:</span>
                                    {cmd.args.map(arg => (
                                      <span key={arg.name} className="command-arg-tag">
                                        {arg.name}
                                        {arg.required && <span className="arg-required">*</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="command-aliases-config">
                                  <span className="command-aliases-label">Aliases:</span>
                                  <input
                                    type="text"
                                    value={cmdSetting?.aliases?.join(', ') || ''}
                                    onChange={e => {
                                      const aliases = e.target.value.split(',').map(a => a.trim()).filter(Boolean)
                                      updateSetting('commands', {
                                        commandSettings: {
                                          ...settings.commands.commandSettings,
                                          [cmd.name]: { ...cmdSetting, aliases }
                                        }
                                      })
                                    }}
                                    placeholder="alias1, alias2"
                                    className="command-aliases-input"
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="settings-section">
              <div className="settings-field">
                <label>Behavior</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.autoCompactEnabled}
                      onChange={e => updateSetting('system', { autoCompactEnabled: e.target.checked })}
                    />
                    Auto-compact (compact context automatically)
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.thinkingEnabled}
                      onChange={e => updateSetting('system', { thinkingEnabled: e.target.checked })}
                    />
                    Thinking mode
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.verbose}
                      onChange={e => updateSetting('system', { verbose: e.target.checked })}
                    />
                    Verbose output
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.fileCheckpointingEnabled}
                      onChange={e => updateSetting('system', { fileCheckpointingEnabled: e.target.checked })}
                    />
                    Rewind code (checkpoints)
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.promptSuggestionEnabled}
                      onChange={e => updateSetting('system', { promptSuggestionEnabled: e.target.checked })}
                    />
                    Prompt suggestions
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.speculationEnabled}
                      onChange={e => updateSetting('system', { speculationEnabled: e.target.checked })}
                    />
                    Speculative execution
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Terminal UI</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.terminalProgressBarEnabled}
                      onChange={e => updateSetting('system', { terminalProgressBarEnabled: e.target.checked })}
                    />
                    Terminal progress bar
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.showTurnDuration}
                      onChange={e => updateSetting('system', { showTurnDuration: e.target.checked })}
                    />
                    Show turn duration
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.showTips}
                      onChange={e => updateSetting('system', { showTips: e.target.checked })}
                    />
                    Show tips
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.reduceMotion}
                      onChange={e => updateSetting('system', { reduceMotion: e.target.checked })}
                    />
                    Reduce motion
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.copyFullResponse}
                      onChange={e => updateSetting('system', { copyFullResponse: e.target.checked })}
                    />
                    Always copy full response
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.copyOnSelect}
                      onChange={e => updateSetting('system', { copyOnSelect: e.target.checked })}
                    />
                    Copy on select
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.prStatusFooterEnabled}
                      onChange={e => updateSetting('system', { prStatusFooterEnabled: e.target.checked })}
                    />
                    Show PR status footer
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Permissions</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.respectGitignore}
                      onChange={e => updateSetting('system', { respectGitignore: e.target.checked })}
                    />
                    Respect .gitignore in file picker
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.useAutoModeDuringPlan}
                      onChange={e => updateSetting('system', { useAutoModeDuringPlan: e.target.checked })}
                    />
                    Use auto mode during plan
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Default Permission Mode</label>
                <select
                  value={settings.system.defaultPermissionMode}
                  onChange={e => updateSetting('system', { defaultPermissionMode: e.target.value as any })}
                >
                  <option value="default">Default</option>
                  <option value="ask">Ask (prompt for each)</option>
                  <option value="accept">Accept (allow by default)</option>
                  <option value="reject">Reject (deny by default)</option>
                  <option value="plan">Plan mode</option>
                  <option value="auto">Auto mode</option>
                  <option value="bypassPermissions">Bypass permissions</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Notifications</label>
                <select
                  value={settings.system.notificationsChannel}
                  onChange={e => updateSetting('system', { notificationsChannel: e.target.value as any })}
                >
                  <option value="auto">Auto</option>
                  <option value="iterm2">iTerm2</option>
                  <option value="terminal_bell">Terminal Bell</option>
                  <option value="iterm2_with_bell">iTerm2 with Bell</option>
                  <option value="kitty">Kitty</option>
                  <option value="ghostty">Ghostty</option>
                  <option value="notifications_disabled">Disabled</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Push Notifications</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.taskCompleteNotifEnabled}
                      onChange={e => updateSetting('system', { taskCompleteNotifEnabled: e.target.checked })}
                    />
                    Push when idle
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.inputNeededNotifEnabled}
                      onChange={e => updateSetting('system', { inputNeededNotifEnabled: e.target.checked })}
                    />
                    Push when input needed
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.agentPushNotifEnabled}
                      onChange={e => updateSetting('system', { agentPushNotifEnabled: e.target.checked })}
                    />
                    Push when Claude decides
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Editor</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.system.fastModeEnabled}
                      onChange={e => updateSetting('system', { fastModeEnabled: e.target.checked })}
                    />
                    Fast mode (uses Sonnet-4 model)
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label>Editor Mode</label>
                <select
                  value={settings.system.editorMode}
                  onChange={e => updateSetting('system', { editorMode: e.target.value as any })}
                >
                  <option value="normal">Normal</option>
                  <option value="vim">Vim</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Updates</label>
                <select
                  value={settings.system.autoUpdatesChannel}
                  onChange={e => updateSetting('system', { autoUpdatesChannel: e.target.value as any })}
                >
                  <option value="latest">Latest</option>
                  <option value="stable">Stable</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Output Style</label>
                <select
                  value={settings.system.outputStyle}
                  onChange={e => updateSetting('system', { outputStyle: e.target.value })}
                >
                  <option value="default">Default</option>
                  <option value="compact">Compact</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Language</label>
                <select
                  value={settings.system.language}
                  onChange={e => updateSetting('system', { language: e.target.value })}
                >
                  <option value="Default">Default (English)</option>
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁體中文</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Default View</label>
                <select
                  value={settings.system.defaultView}
                  onChange={e => updateSetting('system', { defaultView: e.target.value as any })}
                >
                  <option value="transcript">Transcript</option>
                  <option value="chat">Chat</option>
                  <option value="default">Default</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button onClick={onClose} className="btn-primary">Save & Close</button>
        </div>
      </div>
    </div>
  )
}
