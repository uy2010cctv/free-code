import { describe, expect, test } from 'bun:test'
import { ModuleRegistry } from '../modules/ModuleRegistry'

describe('ModuleRegistry', () => {
  test('replaces active module list on refresh', async () => {
    const registry = new ModuleRegistry()

    await registry.load([
      {
        id: 'reporting-core',
        name: 'Reporting Core',
        description: 'Base reports',
        version: '1.0.0',
        prompts: ['report'],
        requiredConnectorKinds: ['file'],
        reportTemplates: ['monthly-sales'],
        outputFormats: ['docx', 'report'],
        lifecycleState: 'published',
        publishedAt: 1,
        refreshedAt: 1,
      },
    ])

    await registry.refresh([
      {
        id: 'finance-pack',
        name: 'Finance Pack',
        description: 'Finance reports',
        version: '1.1.0',
        prompts: ['pnl'],
        requiredConnectorKinds: ['database'],
        reportTemplates: ['finance-summary'],
        outputFormats: ['xlsx', 'report'],
        lifecycleState: 'refreshed',
        refreshedAt: 2,
      },
    ])

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getAll()[0]?.id).toBe('finance-pack')
    expect(registry.getByIds(['finance-pack'])[0]?.name).toBe('Finance Pack')
    expect(registry.getPublishedByIds(['finance-pack'])).toHaveLength(0)
  })

  test('publishes a module only when explicitly requested', async () => {
    const registry = new ModuleRegistry()

    await registry.load([
      {
        id: 'finance-pack',
        name: 'Finance Pack',
        description: 'Finance reports',
        version: '1.1.0',
        prompts: ['pnl'],
        requiredConnectorKinds: ['database'],
        reportTemplates: ['finance-summary'],
        outputFormats: ['xlsx', 'report'],
        lifecycleState: 'refreshed',
        refreshedAt: 2,
      },
    ])

    expect(registry.getPublishedByIds(['finance-pack'])).toHaveLength(0)

    const published = registry.publish('finance-pack')

    expect(published?.lifecycleState).toBe('published')
    expect(typeof published?.publishedAt).toBe('number')
    expect(registry.getPublishedByIds(['finance-pack'])).toHaveLength(1)
  })
})
