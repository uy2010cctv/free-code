export interface Session {
  id: string
  title: string
  createdAt: number
  lastActivityAt: number
}

export interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool_use'
  content: string
  timestamp: number
  toolName?: string
}

export interface StreamEvent {
  type: 'user' | 'assistant' | 'tool_use' | 'system' | 'done' | 'error'
  id?: string
  content?: string
  toolName?: string
  error?: string
}
