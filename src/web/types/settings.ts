// Settings types for Web UI

export interface ApiSettings {
  apiKey: string
  baseURL: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface PermissionSettings {
  defaultMode: 'accept' | 'reject' | 'ask'
  allowBash: boolean
  allowFileRead: boolean
  allowFileWrite: boolean
  allowNetwork: boolean
  allowedCommands: string[]
  blockedCommands: string[]
}

export interface UISettings {
  theme: 'dark' | 'light'
  fontSize: number
  streamResponses: boolean
  showTokenCount: boolean
}

export interface SessionSettings {
  autoSave: boolean
  autoSaveInterval: number // seconds
  maxSessions: number
}

export interface CommandSetting {
  enabled: boolean
  aliases: string[]
}

export interface CommandsSettings {
  enabledCommands: string[]
  commandSettings: Record<string, CommandSetting>
}

export interface SystemSettings {
  // Behavior
  autoCompactEnabled: boolean
  thinkingEnabled: boolean
  fastModeEnabled: boolean
  promptSuggestionEnabled: boolean
  speculationEnabled: boolean
  fileCheckpointingEnabled: boolean
  verbose: boolean

  // Terminal UI
  terminalProgressBarEnabled: boolean
  showStatusInTerminalTab: boolean
  showTurnDuration: boolean
  showTips: boolean
  reduceMotion: boolean
  copyFullResponse: boolean
  copyOnSelect: boolean
  prStatusFooterEnabled: boolean

  // Permissions
  defaultPermissionMode: 'default' | 'plan' | 'auto' | 'bypassPermissions' | 'ask' | 'accept' | 'reject'
  respectGitignore: boolean
  useAutoModeDuringPlan: boolean

  // Notifications
  notificationsChannel: 'auto' | 'iterm2' | 'terminal_bell' | 'iterm2_with_bell' | 'kitty' | 'ghostty' | 'notifications_disabled'
  taskCompleteNotifEnabled: boolean
  inputNeededNotifEnabled: boolean
  agentPushNotifEnabled: boolean

  // Updates
  autoUpdatesChannel: 'stable' | 'latest'

  // Editor
  editorMode: 'normal' | 'vim'
  outputStyle: string
  language: string
  defaultView: 'transcript' | 'chat' | 'default'
}

export interface WebSettings {
  api: ApiSettings
  permissions: PermissionSettings
  ui: UISettings
  sessions: SessionSettings
  commands: CommandsSettings
  system: SystemSettings
}

// Command types
export interface Command {
  name: string
  description: string
  category: 'session' | 'config' | 'tools' | 'agent' | 'other'
  aliases?: string[]
  args?: {
    name: string
    description: string
    required?: boolean
  }[]
}

export interface McpServer {
  id: string
  name: string
  type: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
}
