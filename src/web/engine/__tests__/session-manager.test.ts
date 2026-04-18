import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SessionManager } from '../SessionManager'

describe('SessionManager enterprise metadata', () => {
  test('persists connector, module, and report metadata across reload', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-'))
    const manager = new SessionManager(cwd)
    await manager.initialize()

    const session = manager.createSession()
    manager.setEnterpriseSessionState(session.id, {
      selectedConnectorIds: ['workspace-files'],
      selectedModuleIds: ['reporting-core'],
      lastReportId: 'report-001',
      lastGeneratedOutputs: ['reports/report-001.docx', 'reports/report-001.xlsx'],
    })

    await new Promise(resolve => setTimeout(resolve, 25))

    const reloaded = new SessionManager(cwd)
    await reloaded.initialize()
    const restored = reloaded.getSession(session.id)

    expect(restored?.selectedConnectorIds).toEqual(['workspace-files'])
    expect(restored?.selectedModuleIds).toEqual(['reporting-core'])
    expect(restored?.lastReportId).toBe('report-001')
    expect(restored?.lastGeneratedOutputs).toEqual([
      'reports/report-001.docx',
      'reports/report-001.xlsx',
    ])
  })

  test('separates selected modules from published runtime modules', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-'))
    const manager = new SessionManager(cwd)
    await manager.initialize()

    const session = manager.createSession()
    manager.setEnterpriseSessionState(session.id, {
      selectedModuleIds: ['reporting-core', 'finance-pack'],
    })

    await manager.refreshModules([
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

    const runtime = manager.getEnterpriseRuntimeContext(session.id)

    expect(runtime.selectedModules.map(item => item.id)).toEqual(['reporting-core', 'finance-pack'])
    expect(runtime.publishedModules.map(item => item.id)).toEqual(['reporting-core'])
  })

  test('normalizes legacy sessions missing enterprise arrays', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-'))
    const sessionsDir = join(cwd, '.free-code-sessions')
    mkdirSync(sessionsDir, { recursive: true })

    writeFileSync(join(sessionsDir, 'index.json'), JSON.stringify([
      {
        id: 'legacy-session',
        title: 'Legacy Session',
        createdAt: 1,
        lastActivityAt: 1,
        messages: [],
        workspacePath: join(cwd, 'workspace', 'legacy-session'),
      },
    ]))

    const manager = new SessionManager(cwd)
    await manager.initialize()

    const restored = manager.getSession('legacy-session')
    const runtime = manager.getEnterpriseRuntimeContext('legacy-session')

    expect(restored?.selectedConnectorIds).toEqual([])
    expect(restored?.selectedModuleIds).toEqual([])
    expect(restored?.lastGeneratedOutputs).toEqual([])
    expect(runtime.connectors).toEqual([])
    expect(runtime.publishedModules).toEqual([])
  })

  test('builds report plans from published modules only', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-'))
    const manager = new SessionManager(cwd)
    await manager.initialize()

    const session = manager.createSession()
    manager.setEnterpriseSessionState(session.id, {
      selectedModuleIds: ['reporting-core', 'finance-pack'],
    })

    await manager.refreshModules([
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

    const plan = await manager.buildReportPlan(session.id, 'Generate a finance summary', 'finance-summary')

    expect(plan.trace.some(item => item.sourceId === 'reporting-core')).toBe(true)
    expect(plan.trace.some(item => item.sourceId === 'finance-pack')).toBe(false)
  })

  test('persists connectors and modules across manager reload', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-'))
    const manager = new SessionManager(cwd)
    await manager.initialize()

    await manager.registerConnector({
      id: 'erp-sync',
      name: 'ERP Sync',
      kind: 'external',
      description: 'ERP source',
      capabilities: ['read'],
      status: 'connected',
      config: {},
      authType: 'oauth',
      schemaHints: ['orders'],
      compatibilityStatus: 'ready',
    })

    await manager.saveModule({
      id: 'sales-weekly',
      name: 'Sales Weekly',
      description: 'Weekly sales reporting module',
      version: '1.0.0',
      prompts: ['weekly sales'],
      requiredConnectorKinds: ['external'],
      reportTemplates: ['monthly-sales'],
      outputFormats: ['docx', 'report'],
      lifecycleState: 'draft',
    })

    const reloaded = new SessionManager(cwd)
    await reloaded.initialize()

    expect(reloaded.getConnectors().some(item => item.id === 'erp-sync')).toBe(true)
    expect(reloaded.getModules().some(item => item.id === 'sales-weekly')).toBe(true)
  })
})
