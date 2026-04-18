import type { DataSourceConnector } from './types'

export const DEFAULT_CONNECTORS: DataSourceConnector[] = [
  {
    id: 'workspace-files',
    name: 'Workspace Files',
    kind: 'file',
    description: 'Files generated or uploaded inside the current session workspace.',
    capabilities: ['read', 'list'],
    status: 'connected',
    config: {
      scope: 'session-workspace',
    },
    authType: 'none',
    schemaHints: ['workspace files', 'generated documents', 'uploaded spreadsheets'],
    compatibilityStatus: 'ready',
  },
  {
    id: 'sales-db-demo',
    name: 'Sales Database (Demo)',
    kind: 'database',
    description: 'Placeholder relational sales source for enterprise report prototyping.',
    capabilities: ['read', 'aggregate'],
    status: 'disconnected',
    config: {
      driver: 'postgres',
    },
    authType: 'serviceAccount',
    schemaHints: ['sales pipeline', 'regional performance', 'account revenue'],
    compatibilityStatus: 'beta',
  },
  {
    id: 'crm-api-demo',
    name: 'CRM API (Demo)',
    kind: 'external',
    description: 'Placeholder external CRM connector for customer and pipeline sync.',
    capabilities: ['read'],
    status: 'disconnected',
    config: {
      provider: 'crm-demo',
    },
    authType: 'apiKey',
    schemaHints: ['customer profile', 'deal stage', 'follow-up activity'],
    compatibilityStatus: 'beta',
  },
]
