import type { DataSourceConnector } from './connectors/types'
import type { BusinessModule, ModuleLifecycleState } from './modules/types'
import type { ReportPlan, ReportTraceItem } from './reporting/types'

// Stream event types for SSE
export type StreamEvent =
  | { type: 'report_plan'; reportType: string; summary: string; trace: ReportTraceItem[]; exports: ReportPlan['exports']; timestamp: number; source?: string }
  | { type: 'user'; id: string; content: string; timestamp: number; source?: string }
  | { type: 'assistant'; id: string; content: string; timestamp: number; source?: string }
  | { type: 'tool_start'; id: string; toolName: string; input: Record<string, any>; timestamp: number; source?: string }
  | { type: 'tool_result'; id: string; toolName: string; result: ToolResult; timestamp: number; source?: string }
  | { type: 'tool_error'; id: string; toolName: string; error: string; timestamp: number; source?: string }
  | { type: 'state_update'; phase: 'model_request' | 'tool_cycle_complete' | 'response_complete'; detail: string; timestamp: number; source?: string }
  | { type: 'system'; content: string; timestamp: number; source?: string }
  | { type: 'done'; source?: string }
  | { type: 'error'; error: string; source?: string }

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
  signal?: AbortSignal
}

// Message format
export interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool_start' | 'tool_result' | 'tool_error' | 'report_plan' | 'state_update'
  content: string
  timestamp: number
  role?: 'user' | 'assistant' | 'system' | 'tool'
  toolName?: string
  toolInput?: Record<string, any>
  toolResult?: ToolResult
  reportPlan?: ReportPlan
  isMeta?: boolean
  isSynthetic?: boolean
  isCompactSummary?: boolean
}

// Session data
export interface Session {
  id: string
  title: string
  createdAt: number
  lastActivityAt: number
  messages: Message[]
  workspacePath: string
  selectedConnectorIds: string[]
  selectedModuleIds: string[]
  lastReportId?: string
  lastGeneratedOutputs: string[]
}

export interface EnterpriseRuntimeContext {
  connectors: DataSourceConnector[]
  selectedModules: BusinessModule[]
  publishedModules: BusinessModule[]
}

export interface EnterpriseRuntimeSnapshot {
  selectedConnectorIds: string[]
  selectedModuleIds: string[]
  lastReportId?: string
  lastGeneratedOutputs: string[]
}

export type { DataSourceConnector, BusinessModule, ModuleLifecycleState, ReportPlan }

// WebQueryEngine config
export interface WebQueryEngineConfig {
  apiKey: string
  baseURL: string
  model: string
  systemPrompt: string
  maxTokens: number
}
