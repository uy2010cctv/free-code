export interface Session {
  id: string
  title: string
  createdAt: number
  lastActivityAt: number
}

export interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result'
  content: string
  timestamp: number
  toolName?: string
  toolInput?: Record<string, any>
  toolResult?: ToolResult
}

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
}

export type StreamEvent =
  | { type: 'user'; id: string; content: string; timestamp: number }
  | { type: 'assistant'; id: string; content: string; timestamp: number }
  | { type: 'tool_use'; id: string; toolName: string; input: Record<string, any>; timestamp: number }
  | { type: 'tool_result'; id: string; toolName: string; result: ToolResult; timestamp: number }
  | { type: 'system'; content: string; timestamp: number }
  | { type: 'done' }
  | { type: 'error'; error: string }
