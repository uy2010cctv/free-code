import { describe, expect, test } from 'bun:test'
import { ConnectorRegistry } from '../connectors/ConnectorRegistry'
import type { DataSourceConnector } from '../connectors/types'

describe('ConnectorRegistry', () => {
  test('registers connectors and filters by kind', async () => {
    const registry = new ConnectorRegistry()
    const connector: DataSourceConnector = {
      id: 'sales-csv',
      name: 'Sales CSV',
      kind: 'file',
      description: 'Imported sales worksheet',
      capabilities: ['read'],
      status: 'connected',
      config: { path: './fixtures/sales.csv' },
      authType: 'none',
      schemaHints: ['monthly sales'],
      compatibilityStatus: 'ready',
    }

    await registry.load([connector])

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getByKind('file')[0]?.id).toBe('sales-csv')
    expect(registry.getByIds(['sales-csv'])[0]?.name).toBe('Sales CSV')
  })

  test('updates connector metadata in place', async () => {
    const registry = new ConnectorRegistry()
    await registry.load([
      {
        id: 'sales-csv',
        name: 'Sales CSV',
        kind: 'file',
        description: 'Imported sales worksheet',
        capabilities: ['read'],
        status: 'connected',
        config: { path: './fixtures/sales.csv' },
        authType: 'none',
        schemaHints: ['monthly sales'],
        compatibilityStatus: 'ready',
      },
    ])

    const updated = registry.update('sales-csv', {
      status: 'error',
      compatibilityStatus: 'legacy',
    })

    expect(updated?.status).toBe('error')
    expect(updated?.compatibilityStatus).toBe('legacy')
  })
})
