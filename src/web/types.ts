export type {
  BusinessModule,
  DataSourceConnector,
  ModuleLifecycleState,
  ReportPlan,
} from './engine/types'

import type { ReportPlan } from './engine/types'

export interface Session {
  id: string
  title: string
  createdAt: number
  lastActivityAt: number
  workspacePath?: string
  selectedConnectorIds: string[]
  selectedModuleIds: string[]
  lastReportId?: string
  lastGeneratedOutputs: string[]
}

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
  failed?: boolean
}

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
}

export type StreamEvent =
  | { type: 'report_plan'; reportType: string; summary: string; trace: Array<{ label: string; sourceType: 'connector' | 'file' | 'formula' | 'module'; sourceId: string; detail: string }>; exports: ReportPlan['exports']; timestamp: number; source?: string }
  | { type: 'user'; id: string; content: string; timestamp: number; source?: string }
  | { type: 'assistant'; id: string; content: string; timestamp: number; source?: string }
  | { type: 'tool_start'; id: string; toolName: string; input: Record<string, any>; timestamp: number; source?: string }
  | { type: 'tool_result'; id: string; toolName: string; result: ToolResult; timestamp: number; source?: string }
  | { type: 'tool_error'; id: string; toolName: string; error: string; timestamp: number; source?: string }
  | { type: 'state_update'; phase: 'model_request' | 'tool_cycle_complete' | 'response_complete'; detail: string; timestamp: number; source?: string }
  | { type: 'system'; content: string; timestamp: number; source?: string }
  | { type: 'done'; source?: string }
  | { type: 'error'; error: string; source?: string }
