import type { ModuleOutputFormat } from '../modules/types'

export interface ReportTraceItem {
  label: string
  sourceType: 'connector' | 'file' | 'formula' | 'module'
  sourceId: string
  detail: string
}

export interface ReportPlan {
  reportType: string
  summary: string
  trace: ReportTraceItem[]
  exports: ModuleOutputFormat[]
}
