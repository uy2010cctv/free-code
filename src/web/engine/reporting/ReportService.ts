import type { DataSourceConnector } from '../connectors/types'
import type { BusinessModule } from '../modules/types'
import type { ReportPlan, ReportTraceItem } from './types'
import { DEFAULT_REPORT_TEMPLATES } from './defaultTemplates'

export class ReportService {
  async buildPlan(input: {
    reportType: string
    connectors: DataSourceConnector[]
    modules: BusinessModule[]
    prompt: string
  }): Promise<ReportPlan> {
    const trace: ReportTraceItem[] = [
      ...input.connectors.map(connector => ({
        label: connector.name,
        sourceType: 'connector' as const,
        sourceId: connector.id,
        detail: `Read from ${connector.kind} connector with capabilities: ${connector.capabilities.join(', ') || 'none'}; auth=${connector.authType}; schema=${connector.schemaHints.join(', ') || 'none'}; compatibility=${connector.compatibilityStatus}`,
      })),
      ...input.modules.map(module => ({
        label: module.name,
        sourceType: 'module' as const,
        sourceId: module.id,
        detail: `Applied business module v${module.version}; templates=${module.reportTemplates.join(', ') || 'none'}; outputs=${module.outputFormats.join(', ') || 'none'}`,
      })),
    ]

    const matchedTemplate = DEFAULT_REPORT_TEMPLATES.find(template => template.id === input.reportType)
    const exports = Array.from(new Set(
      input.modules.flatMap(module => module.outputFormats)
    ))

    return {
      reportType: input.reportType,
      summary: `Generate ${matchedTemplate?.label || input.reportType} from ${input.connectors.length} connector(s) and ${input.modules.length} published module(s) for: ${input.prompt}`,
      trace,
      exports: exports.length > 0 ? exports : ['docx', 'xlsx', 'report'],
    }
  }
}
