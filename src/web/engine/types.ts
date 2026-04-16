// Stream event types for SSE
export type StreamEvent =
  | { type: 'user'; id: string; content: string; timestamp: number }
  | { type: 'assistant'; id: string; content: string; timestamp: number }
  | { type: 'tool_use'; id: string; toolName: string; input: Record<string, any>; timestamp: number }
  | { type: 'tool_result'; id: string; toolName: string; result: ToolResult; timestamp: number }
  | { type: 'system'; content: string; timestamp: number }
  | { type: 'done' }
  | { type: 'error'; error: string }

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
}

// Tool definition
export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, any>
  execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult>
}

export interface ToolContext {
  cwd: string
  sessionId: string
}

// Message format
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolName?: string
  toolInput?: Record<string, any>
  timestamp: number
}

// Session data
export interface Session {
  id: string
  title: string
  createdAt: number
  lastActivityAt: number
  messages: Message[]
  workspacePath?: string
  selectedConnectorIds?: string[]
  selectedModuleIds?: string[]
  lastReportId?: string
}

// WebQueryEngine config
export interface WebQueryEngineConfig {
  apiKey: string
  baseURL: string
  model: string
  systemPrompt: string
  maxTokens: number
}
