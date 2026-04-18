import { describe, expect, test } from 'bun:test'
import { ReportService } from '../reporting/ReportService'

describe('ReportService', () => {
  test('builds traceable report metadata from sources and modules', async () => {
    const service = new ReportService()
    const result = await service.buildPlan({
      reportType: 'monthly-sales',
      connectors: [
        {
          id: 'sales-csv',
          name: 'Sales CSV',
          kind: 'file',
          description: 'Sales data',
          capabilities: ['read'],
          status: 'connected',
          config: {},
          authType: 'none',
          schemaHints: ['monthly sales'],
          compatibilityStatus: 'ready',
        },
      ],
      modules: [
        {
          id: 'reporting-core',
          name: 'Reporting Core',
          description: 'Base reports',
          version: '1.0.0',
          prompts: ['report'],
          requiredConnectorKinds: ['file'],
          reportTemplates: ['monthly-sales'],
          outputFormats: ['docx', 'xlsx', 'report'],
          lifecycleState: 'published',
          publishedAt: 1,
          refreshedAt: 1,
        },
      ],
      prompt: 'Generate monthly sales summary',
    })

    expect(result.reportType).toBe('monthly-sales')
    expect(result.trace[0]?.sourceId).toBe('sales-csv')
    expect(result.trace[1]?.sourceId).toBe('reporting-core')
    expect(result.exports).toContain('xlsx')
    expect(result.summary).toContain('Monthly Sales Report')
  })
})
