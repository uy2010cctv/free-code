import type { BusinessModule } from './types'

export const DEFAULT_MODULES: BusinessModule[] = [
  {
    id: 'reporting-core',
    name: 'Reporting Core',
    description: 'Base report planning module for business summaries and structured exports.',
    version: '1.0.0',
    prompts: ['monthly report', 'sales summary', 'operations dashboard'],
    requiredConnectorKinds: ['file'],
    reportTemplates: ['monthly-sales', 'ops-summary'],
    outputFormats: ['docx', 'xlsx', 'report'],
    lifecycleState: 'published',
    publishedAt: Date.UTC(2026, 3, 16, 0, 0, 0),
    refreshedAt: Date.UTC(2026, 3, 16, 0, 0, 0),
  },
  {
    id: 'finance-pack',
    name: 'Finance Pack',
    description: 'Finance-oriented module for reconciliation, ledger exports, and budget reports.',
    version: '1.0.0',
    prompts: ['budget report', 'profit and loss', 'expense summary'],
    requiredConnectorKinds: ['database'],
    reportTemplates: ['finance-summary'],
    outputFormats: ['xlsx', 'report'],
    lifecycleState: 'published',
    publishedAt: Date.UTC(2026, 3, 16, 0, 0, 0),
    refreshedAt: Date.UTC(2026, 3, 16, 0, 0, 0),
  },
]
