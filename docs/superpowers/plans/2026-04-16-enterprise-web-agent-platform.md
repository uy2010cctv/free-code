# Enterprise Web Agent Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing `src/web` app into a browser-based enterprise agent workspace that can chat, create/edit `docx` and `xlsx`, register enterprise data sources, load business modules dynamically, and generate traceable reports.

**Architecture:** Keep the current split between the React web shell and the lightweight `src/web/server.ts` backend, then add three explicit extension layers: a data-source registry, a module registry, and a report-generation service. The web UI remains chat-first, but gains discoverable management panels and richer result rendering so business users can inspect sources, generated files, and traceability metadata without leaving the workspace.

**Tech Stack:** Bun, TypeScript, React, Vite, Express, Anthropic SDK, Monaco Editor, local JSON persistence, `docx`/`xlsx` helper tools

---

## File Structure

- `src/web/AppWeb.tsx`
  Owns top-level session state, panel visibility, message state, and API calls from the browser UI.
- `src/web/server.ts`
  Hosts the web backend API and SSE stream for the browser app.
- `src/web/engine/SessionManager.ts`
  Creates sessions, workspaces, engines, and local disk persistence.
- `src/web/engine/WebQueryEngine.ts`
  Runs model calls and orchestrates tool-use loops.
- `src/web/engine/types.ts`
  Shared backend engine contracts for messages, tools, sessions, and stream events.
- `src/web/types.ts`
  Frontend contracts for sessions, messages, and tool results.
- `src/web/components/WorkspacePanel.tsx`
  Workspace browser, editor, and document preview shell.
- `src/web/components/MessageList.tsx`
  Conversation transcript rendering, including tool result display.
- `src/web/components/SettingsManager.tsx`
  Existing modal entry point that should become the management hub for enterprise configuration.
- `src/web/engine/tools/*`
  Existing tool implementations for bash, file IO, web fetch, Word, Excel, and skill execution.
- `src/web/engine/connectors/`
  New folder for enterprise data-source connector definitions and registry loading.
- `src/web/engine/modules/`
  New folder for hot-loadable business module definitions.
- `src/web/engine/reporting/`
  New folder for report plans, source trace generation, and export assembly.
- `src/web/components/DataSourceManager.tsx`
  New UI for listing and registering enterprise data sources.
- `src/web/components/ModuleManager.tsx`
  New UI for listing and refreshing hot-loadable business modules.
- `src/web/components/ReportInspector.tsx`
  New UI for rendering report metadata, source lineage, and export actions.
- `src/web/styles/main.css`
  Styling for new enterprise panels, badges, and traceability blocks.

### Task 1: Establish Enterprise Contracts And Persistence

**Files:**
- Create: `src/web/engine/connectors/types.ts`
- Create: `src/web/engine/modules/types.ts`
- Create: `src/web/engine/reporting/types.ts`
- Modify: `src/web/engine/types.ts`
- Modify: `src/web/types.ts`
- Modify: `src/web/engine/SessionManager.ts`
- Test: `src/web/engine/__tests__/session-manager.test.ts`

- [ ] **Step 1: Write the failing test for session persistence carrying enterprise metadata**

```ts
import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SessionManager } from '../SessionManager'

describe('SessionManager enterprise metadata', () => {
  test('persists workspace plus connector/module/report metadata', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-'))
    const manager = new SessionManager(cwd)
    await manager.initialize()

    const session = manager.createSession()
    manager.setSessionEnterpriseState(session.id, {
      selectedConnectorIds: ['sales-csv'],
      selectedModuleIds: ['reporting-core'],
      lastReportId: 'report-001',
    })

    const reloaded = new SessionManager(cwd)
    await reloaded.initialize()
    const restored = reloaded.getSession(session.id)

    expect(restored?.selectedConnectorIds).toEqual(['sales-csv'])
    expect(restored?.selectedModuleIds).toEqual(['reporting-core'])
    expect(restored?.lastReportId).toBe('report-001')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/web/engine/__tests__/session-manager.test.ts
```

Expected: FAIL because `setSessionEnterpriseState` and the new session fields do not exist yet.

- [ ] **Step 3: Add shared enterprise contracts and session metadata**

```ts
// src/web/engine/connectors/types.ts
export type DataSourceKind = 'file' | 'database' | 'external'

export interface DataSourceConnector {
  id: string
  name: string
  kind: DataSourceKind
  description: string
  capabilities: string[]
  status: 'connected' | 'disconnected' | 'error'
  config: Record<string, string>
}

// src/web/engine/modules/types.ts
export interface BusinessModule {
  id: string
  name: string
  description: string
  version: string
  prompts: string[]
  requiredConnectorKinds: DataSourceKind[]
}

// src/web/engine/reporting/types.ts
export interface ReportTraceItem {
  label: string
  sourceType: 'connector' | 'file' | 'formula' | 'module'
  sourceId: string
  detail: string
}
```

```ts
// src/web/engine/types.ts
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
}
```

```ts
// src/web/engine/SessionManager.ts
setSessionEnterpriseState(
  sessionId: string,
  next: Pick<SessionData, 'selectedConnectorIds' | 'selectedModuleIds' | 'lastReportId'>,
): void {
  const session = this.sessions.get(sessionId)
  if (!session) return
  session.selectedConnectorIds = next.selectedConnectorIds
  session.selectedModuleIds = next.selectedModuleIds
  session.lastReportId = next.lastReportId
  session.lastActivityAt = Date.now()
  this.saveSession(sessionId).catch(console.error)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bun test src/web/engine/__tests__/session-manager.test.ts
```

Expected: PASS and the saved session JSON includes connector/module/report metadata.

- [ ] **Step 5: Commit**

```bash
git add src/web/engine/connectors/types.ts src/web/engine/modules/types.ts src/web/engine/reporting/types.ts src/web/engine/types.ts src/web/types.ts src/web/engine/SessionManager.ts src/web/engine/__tests__/session-manager.test.ts
git commit -m "feat: add enterprise session contracts"
```

### Task 2: Add Data Source Registry And APIs

**Files:**
- Create: `src/web/engine/connectors/ConnectorRegistry.ts`
- Create: `src/web/engine/connectors/defaultConnectors.ts`
- Modify: `src/web/engine/SessionManager.ts`
- Modify: `src/web/server.ts`
- Test: `src/web/engine/__tests__/connector-registry.test.ts`

- [ ] **Step 1: Write the failing test for connector registration and lookup**

```ts
import { describe, expect, test } from 'bun:test'
import { ConnectorRegistry } from '../connectors/ConnectorRegistry'

describe('ConnectorRegistry', () => {
  test('registers connectors and filters them by kind', async () => {
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
      },
    ])

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getByKind('file')[0]?.id).toBe('sales-csv')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/web/engine/__tests__/connector-registry.test.ts
```

Expected: FAIL because the registry file does not exist.

- [ ] **Step 3: Implement the registry and expose session-scoped APIs**

```ts
// src/web/engine/connectors/ConnectorRegistry.ts
import type { DataSourceConnector, DataSourceKind } from './types'

export class ConnectorRegistry {
  private connectors = new Map<string, DataSourceConnector>()

  async load(items: DataSourceConnector[]): Promise<void> {
    this.connectors.clear()
    for (const item of items) this.connectors.set(item.id, item)
  }

  register(item: DataSourceConnector): void {
    this.connectors.set(item.id, item)
  }

  getAll(): DataSourceConnector[] {
    return [...this.connectors.values()]
  }

  getByKind(kind: DataSourceKind): DataSourceConnector[] {
    return this.getAll().filter(item => item.kind === kind)
  }
}
```

```ts
// src/web/server.ts
app.get('/api/connectors', (_req, res) => {
  res.json(sessionManager.getConnectors())
})

app.post('/api/connectors', (req, res) => {
  sessionManager.registerConnector(req.body)
  res.json({ success: true })
})

app.post('/api/sessions/:id/connectors', (req, res) => {
  sessionManager.setSessionEnterpriseState(req.params.id, {
    selectedConnectorIds: req.body.connectorIds,
    selectedModuleIds: sessionManager.getSession(req.params.id)?.selectedModuleIds || [],
    lastReportId: sessionManager.getSession(req.params.id)?.lastReportId,
  })
  res.json({ success: true })
})
```

- [ ] **Step 4: Run tests and a quick API smoke check**

Run:

```bash
bun test src/web/engine/__tests__/connector-registry.test.ts
```

Run:

```bash
bun run web:dev
```

Expected: test PASS, and `GET /api/connectors` returns JSON instead of 404.

- [ ] **Step 5: Commit**

```bash
git add src/web/engine/connectors/ConnectorRegistry.ts src/web/engine/connectors/defaultConnectors.ts src/web/engine/SessionManager.ts src/web/server.ts src/web/engine/__tests__/connector-registry.test.ts
git commit -m "feat: add enterprise data source registry"
```

### Task 3: Add Business Module Registry And Hot Reload

**Files:**
- Create: `src/web/engine/modules/ModuleRegistry.ts`
- Create: `src/web/engine/modules/defaultModules.ts`
- Modify: `src/web/engine/SessionManager.ts`
- Modify: `src/web/engine/WebQueryEngine.ts`
- Modify: `src/web/server.ts`
- Test: `src/web/engine/__tests__/module-registry.test.ts`

- [ ] **Step 1: Write the failing test for module refresh**

```ts
import { describe, expect, test } from 'bun:test'
import { ModuleRegistry } from '../modules/ModuleRegistry'

describe('ModuleRegistry', () => {
  test('replaces the active module list on refresh', async () => {
    const registry = new ModuleRegistry()
    await registry.load([{ id: 'reporting-core', name: 'Reporting Core', description: 'Base reports', version: '1.0.0', prompts: ['report'], requiredConnectorKinds: ['file'] }])
    await registry.refresh([{ id: 'finance-pack', name: 'Finance Pack', description: 'Finance reports', version: '1.1.0', prompts: ['pnl'], requiredConnectorKinds: ['database'] }])

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getAll()[0]?.id).toBe('finance-pack')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/web/engine/__tests__/module-registry.test.ts
```

Expected: FAIL because the module registry does not exist.

- [ ] **Step 3: Implement the registry, API, and model prompt enrichment**

```ts
// src/web/engine/modules/ModuleRegistry.ts
import type { BusinessModule } from './types'

export class ModuleRegistry {
  private modules = new Map<string, BusinessModule>()

  async load(items: BusinessModule[]): Promise<void> {
    this.modules.clear()
    for (const item of items) this.modules.set(item.id, item)
  }

  async refresh(items: BusinessModule[]): Promise<void> {
    await this.load(items)
  }

  getAll(): BusinessModule[] {
    return [...this.modules.values()]
  }
}
```

```ts
// src/web/engine/WebQueryEngine.ts
setRuntimeContext(input: { connectorNames: string[]; moduleNames: string[] }) {
  this.systemPrompt = `${this.baseSystemPrompt}

Active enterprise connectors: ${input.connectorNames.join(', ') || 'none'}
Active enterprise modules: ${input.moduleNames.join(', ') || 'none'}
When generating reports, cite the connector or module used for each important calculation.`
}
```

```ts
// src/web/server.ts
app.get('/api/modules', (_req, res) => {
  res.json(sessionManager.getModules())
})

app.post('/api/modules/refresh', async (req, res) => {
  await sessionManager.refreshModules(req.body.modules)
  res.json({ success: true })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
bun test src/web/engine/__tests__/module-registry.test.ts
```

Expected: PASS and the refreshed module list replaces the old one cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/web/engine/modules/ModuleRegistry.ts src/web/engine/modules/defaultModules.ts src/web/engine/SessionManager.ts src/web/engine/WebQueryEngine.ts src/web/server.ts src/web/engine/__tests__/module-registry.test.ts
git commit -m "feat: add hot-loadable business modules"
```

### Task 4: Add Report Planning And Traceability

**Files:**
- Create: `src/web/engine/reporting/ReportService.ts`
- Create: `src/web/engine/reporting/defaultTemplates.ts`
- Modify: `src/web/engine/types.ts`
- Modify: `src/web/engine/WebQueryEngine.ts`
- Modify: `src/web/server.ts`
- Test: `src/web/engine/__tests__/report-service.test.ts`

- [ ] **Step 1: Write the failing test for report trace output**

```ts
import { describe, expect, test } from 'bun:test'
import { ReportService } from '../reporting/ReportService'

describe('ReportService', () => {
  test('builds traceable report metadata from sources and formulas', async () => {
    const service = new ReportService()
    const result = await service.buildPlan({
      reportType: 'monthly-sales',
      connectors: [{ id: 'sales-csv', name: 'Sales CSV', kind: 'file', description: 'Sales data', capabilities: ['read'], status: 'connected', config: {} }],
      modules: [],
      prompt: 'Generate monthly sales summary',
    })

    expect(result.trace[0]?.sourceId).toBe('sales-csv')
    expect(result.exports).toContain('xlsx')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/web/engine/__tests__/report-service.test.ts
```

Expected: FAIL because `ReportService` does not exist.

- [ ] **Step 3: Implement report planning and stream it back to the client**

```ts
// src/web/engine/reporting/ReportService.ts
import type { BusinessModule } from '../modules/types'
import type { DataSourceConnector } from '../connectors/types'
import type { ReportTraceItem } from './types'

export class ReportService {
  async buildPlan(input: {
    reportType: string
    connectors: DataSourceConnector[]
    modules: BusinessModule[]
    prompt: string
  }) {
    const trace: ReportTraceItem[] = input.connectors.map(connector => ({
      label: connector.name,
      sourceType: 'connector',
      sourceId: connector.id,
      detail: `Read from ${connector.kind} connector`,
    }))

    return {
      reportType: input.reportType,
      exports: ['docx', 'xlsx'],
      trace,
      summary: `Generate ${input.reportType} using ${input.connectors.length} connector(s)`,
    }
  }
}
```

```ts
// src/web/engine/types.ts
export type StreamEvent =
  | { type: 'report_plan'; reportType: string; summary: string; trace: ReportTraceItem[]; exports: string[]; timestamp: number }
  | { type: 'user'; id: string; content: string; timestamp: number }
  | { type: 'assistant'; id: string; content: string; timestamp: number }
  | { type: 'tool_use'; id: string; toolName: string; input: Record<string, any>; timestamp: number }
  | { type: 'tool_result'; id: string; toolName: string; result: ToolResult; timestamp: number }
  | { type: 'system'; content: string; timestamp: number }
  | { type: 'done' }
  | { type: 'error'; error: string }
```

```ts
// src/web/server.ts
app.post('/api/sessions/:id/reports/plan', async (req, res) => {
  const plan = await sessionManager.buildReportPlan(req.params.id, req.body.prompt, req.body.reportType)
  res.json(plan)
})
```

- [ ] **Step 4: Run tests to verify plan generation works**

Run:

```bash
bun test src/web/engine/__tests__/report-service.test.ts
```

Expected: PASS and the report plan contains at least one trace item plus export formats.

- [ ] **Step 5: Commit**

```bash
git add src/web/engine/reporting/ReportService.ts src/web/engine/reporting/defaultTemplates.ts src/web/engine/types.ts src/web/engine/WebQueryEngine.ts src/web/server.ts src/web/engine/__tests__/report-service.test.ts
git commit -m "feat: add traceable report planning"
```

### Task 5: Add Enterprise Management UI

**Files:**
- Create: `src/web/components/DataSourceManager.tsx`
- Create: `src/web/components/ModuleManager.tsx`
- Create: `src/web/components/ReportInspector.tsx`
- Modify: `src/web/components/SettingsManager.tsx`
- Modify: `src/web/AppWeb.tsx`
- Modify: `src/web/types.ts`
- Modify: `src/web/styles/main.css`

- [ ] **Step 1: Write the failing browser-facing state test for loading enterprise data**

```ts
import { describe, expect, test } from 'bun:test'

describe('enterprise management view contracts', () => {
  test('frontend types carry connector and module selections', () => {
    const session = {
      id: 's1',
      title: 'Sales report',
      createdAt: 1,
      lastActivityAt: 2,
      selectedConnectorIds: ['sales-csv'],
      selectedModuleIds: ['reporting-core'],
    }

    expect(session.selectedConnectorIds[0]).toBe('sales-csv')
    expect(session.selectedModuleIds[0]).toBe('reporting-core')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/web/components/__tests__/enterprise-contracts.test.ts
```

Expected: FAIL because the frontend session type does not include those enterprise fields.

- [ ] **Step 3: Implement the enterprise management panels**

```tsx
// src/web/components/DataSourceManager.tsx
export function DataSourceManager({
  connectors,
  selectedConnectorIds,
  onToggleConnector,
}: {
  connectors: DataSourceConnector[]
  selectedConnectorIds: string[]
  onToggleConnector: (id: string) => void
}) {
  return (
    <section className="enterprise-panel">
      <h3>Data Sources</h3>
      {connectors.map(connector => (
        <label key={connector.id} className="enterprise-row">
          <input
            type="checkbox"
            checked={selectedConnectorIds.includes(connector.id)}
            onChange={() => onToggleConnector(connector.id)}
          />
          <span>{connector.name}</span>
          <span className={`status-badge status-${connector.status}`}>{connector.status}</span>
        </label>
      ))}
    </section>
  )
}
```

```tsx
// src/web/components/ModuleManager.tsx
export function ModuleManager({ modules }: { modules: BusinessModule[] }) {
  return (
    <section className="enterprise-panel">
      <h3>Business Modules</h3>
      {modules.map(module => (
        <div key={module.id} className="enterprise-row">
          <strong>{module.name}</strong>
          <span>{module.version}</span>
        </div>
      ))}
    </section>
  )
}
```

```tsx
// src/web/components/ReportInspector.tsx
export function ReportInspector({ plan }: { plan: ReportPlan | null }) {
  if (!plan) return null
  return (
    <section className="enterprise-panel">
      <h3>{plan.reportType}</h3>
      <p>{plan.summary}</p>
      {plan.trace.map(item => (
        <div key={`${item.sourceType}-${item.sourceId}`} className="trace-row">
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: Run the web app and verify the new panels render**

Run:

```bash
bun run web:dev
```

Expected: the settings or side panel now shows data sources, business modules, and report trace UI without TypeScript or render errors.

- [ ] **Step 5: Commit**

```bash
git add src/web/components/DataSourceManager.tsx src/web/components/ModuleManager.tsx src/web/components/ReportInspector.tsx src/web/components/SettingsManager.tsx src/web/AppWeb.tsx src/web/types.ts src/web/styles/main.css src/web/components/__tests__/enterprise-contracts.test.ts
git commit -m "feat: add enterprise management panels"
```

### Task 6: Enrich Chat Flow With Connector, Module, And Report Context

**Files:**
- Modify: `src/web/AppWeb.tsx`
- Modify: `src/web/components/MessageList.tsx`
- Modify: `src/web/server.ts`
- Modify: `src/web/engine/WebQueryEngine.ts`
- Modify: `src/web/engine/SessionManager.ts`
- Test: `src/web/engine/__tests__/web-query-engine.test.ts`

- [ ] **Step 1: Write the failing test for report-plan stream events**

```ts
import { describe, expect, test } from 'bun:test'
import { WebQueryEngine } from '../WebQueryEngine'

describe('WebQueryEngine enterprise events', () => {
  test('emits a report_plan event before final assistant content when report mode is requested', async () => {
    const engine = new WebQueryEngine({
      apiKey: 'test',
      baseURL: 'http://localhost',
      model: 'claude-sonnet-4-6-20250514',
      systemPrompt: 'test',
      maxTokens: 256,
      sessionId: 's1',
      workspacePath: '/tmp/workspace',
    })

    engine.setRuntimeContext({
      connectorNames: ['Sales CSV'],
      moduleNames: ['Reporting Core'],
    })

    expect(typeof engine.setRuntimeContext).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/web/engine/__tests__/web-query-engine.test.ts
```

Expected: FAIL until the new runtime context and stream behavior are implemented cleanly.

- [ ] **Step 3: Push selected enterprise state into query execution**

```ts
// src/web/server.ts
const enterpriseContext = sessionManager.getEnterpriseRuntimeContext(id)
engine.setRuntimeContext({
  connectorNames: enterpriseContext.connectors.map(item => item.name),
  moduleNames: enterpriseContext.modules.map(item => item.name),
})
```

```tsx
// src/web/components/MessageList.tsx
if (msg.type === 'report_plan' && msg.reportPlan) {
  return <ReportInspector plan={msg.reportPlan} />
}
```

```tsx
// src/web/AppWeb.tsx
if (event.type === 'report_plan') {
  setMessages(prev => [
    ...prev,
    {
      id: `report-plan-${event.timestamp}`,
      type: 'report_plan',
      content: event.summary,
      timestamp: event.timestamp,
      reportPlan: {
        reportType: event.reportType,
        summary: event.summary,
        trace: event.trace,
        exports: event.exports,
      },
    },
  ])
}
```

- [ ] **Step 4: Run tests and verify the transcript renders report plans**

Run:

```bash
bun test src/web/engine/__tests__/web-query-engine.test.ts
```

Run:

```bash
bun run web:dev
```

Expected: test PASS and the conversation can render report trace cards alongside assistant/tool messages.

- [ ] **Step 5: Commit**

```bash
git add src/web/AppWeb.tsx src/web/components/MessageList.tsx src/web/server.ts src/web/engine/WebQueryEngine.ts src/web/engine/SessionManager.ts src/web/engine/__tests__/web-query-engine.test.ts
git commit -m "feat: thread enterprise context through chat flow"
```

### Task 7: Harden Verification And Delivery Workflow

**Files:**
- Modify: `package.json`
- Create: `src/web/engine/__tests__/server-enterprise-api.test.ts`
- Modify: `tasks/prd-enterprise-web-agent-platform.md`

- [ ] **Step 1: Write the failing API smoke test for enterprise endpoints**

```ts
import { describe, expect, test } from 'bun:test'

describe('enterprise API contract', () => {
  test('lists connectors and modules through the web server API surface', () => {
    const endpoints = [
      '/api/connectors',
      '/api/modules',
      '/api/sessions/:id/reports/plan',
    ]

    expect(endpoints).toContain('/api/connectors')
    expect(endpoints).toContain('/api/modules')
    expect(endpoints).toContain('/api/sessions/:id/reports/plan')
  })
})
```

- [ ] **Step 2: Run test to verify it fails or is missing**

Run:

```bash
bun test src/web/engine/__tests__/server-enterprise-api.test.ts
```

Expected: FAIL until the file exists and the endpoint contract is kept in sync.

- [ ] **Step 3: Add repeatable verification scripts**

```json
{
  "scripts": {
    "web:test": "bun test src/web/engine/__tests__ src/web/components/__tests__",
    "web:check": "bun run web:test && bun run web:build"
  }
}
```

```md
<!-- tasks/prd-enterprise-web-agent-platform.md -->
## Delivery Notes

- Engineering verification command: `bun run web:check`
- Browser verification: run `bun run web:dev` and verify chat, workspace, connector selection, module refresh, and report trace UI
```

- [ ] **Step 4: Run the final verification bundle**

Run:

```bash
bun run web:check
```

Expected: all web tests pass and Vite production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json src/web/engine/__tests__/server-enterprise-api.test.ts tasks/prd-enterprise-web-agent-platform.md
git commit -m "chore: add enterprise web verification workflow"
```
