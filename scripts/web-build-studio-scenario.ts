import { createServer, type Server } from 'http'
import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { AddressInfo } from 'net'
import {
  BUILD_STUDIO_20_STEPS,
  BUILD_STUDIO_20_SUITE,
  createScenarioResult,
  finalizeScenarioResult,
  type FailureCode,
  type ScenarioMode,
  type ScenarioRunResult,
  type ScenarioStepDefinition,
  type ScenarioStepResult,
} from '../src/web/scenario/buildStudio20'
import { createWebApp } from '../src/web/server'
import { runAdminStudioVisibilityCheck } from './web-admin-visibility'

type MutableContext = {
  baseUrl: string
  cwd: string
  logDir: string
  bootstrapSecret: string
  adminToken: string | null
  sessionId: string | null
  connectorId: string
  moduleId: string
  knownSkill: string | null
  server: Server | null
  restartCount: number
}

function parseArgValue(name: string): string | undefined {
  // Handle --key=value format (single argv element with =)
  const kvIndex = process.argv.findIndex(arg => arg.startsWith(`${name}=`))
  if (kvIndex !== -1) {
    return process.argv[kvIndex].split('=')[1]
  }
  // Handle --key value format (separate argv elements)
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 15_000) {
  const response = await fetchWithTimeout(url, timeoutMs, init)
  const text = await response.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  return { response, json }
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(`Timed out after ${timeoutMs}ms`), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function waitFor<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function startLocalServer(cwd: string): Promise<{ server: Server; baseUrl: string }> {
  const previousBootstrapSecret = process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET
  if (!process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET) {
    process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET = 'build-studio-scenario-bootstrap'
  }

  const { app } = await createWebApp(cwd)
  const server = createServer(app)
  await new Promise<void>((resolveListen) => server.listen(0, resolveListen))
  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  if (previousBootstrapSecret === undefined) {
    delete process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET
  } else {
    process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET = previousBootstrapSecret
  }

  return { server, baseUrl }
}

async function restartLocalServer(context: MutableContext): Promise<void> {
  if (!context.server) {
    throw new Error('Restart requested without a local server')
  }

  await new Promise<void>((resolveClose, reject) => {
    context.server?.close((error) => (error ? reject(error) : resolveClose()))
  })

  const { server, baseUrl } = await startLocalServer(context.cwd)
  context.server = server
  context.baseUrl = baseUrl
  context.restartCount += 1
}

async function readSseEvents(
  response: Response,
  timeoutMs: number,
): Promise<Array<Record<string, any>>> {
  if (!response.body) {
    throw new Error('Response body is not readable')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events: Array<Record<string, any>> = []

  while (true) {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(async () => {
          try {
            await reader.cancel('Timed out waiting for SSE chunk')
          } catch {
            // Ignore cancellation errors during timeout cleanup.
          }
          reject(new Error(`Timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout)
    })
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      try {
        events.push(JSON.parse(payload))
      } catch {
        // Ignore partial or malformed chunks and keep reading.
      }
    }
  }

  return events
}

function determineFailureCode(
  error: unknown,
  step: ScenarioStepDefinition,
  events: Array<Record<string, any>>,
): FailureCode {
  if (error instanceof Error && error.message.includes('Timed out')) {
    return 'HANG_TIMEOUT'
  }
  const normalizedEventTypes = events.map((event) => normalizeEventType(String(event.type || 'unknown')))
  if (events.length > 0 && step.requiredEventTypes.some((type) => !normalizedEventTypes.includes(type))) {
    return 'MISSING_REQUIRED_EVENT'
  }
  return 'STATE_CORRUPTION'
}

async function runQueryStep(
  context: MutableContext,
  sessionId: string,
  prompt: string,
  step: ScenarioStepDefinition,
): Promise<ScenarioStepResult> {
  const response = await fetchWithTimeout(`${context.baseUrl}/api/sessions/${sessionId}/query`, step.timeoutMs, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: prompt }),
  })

  if (!response.ok) {
    return {
      step_id: step.id,
      name: step.name,
      status: 'fail',
      expected_event_count: step.requiredEventTypes.length,
      actual_event_count: 0,
      timeout_ms: step.timeoutMs,
      source_path: [],
      state_assertions: [...step.stateAssertions, `HTTP ${response.status}`],
      visible_assertions: step.visibleAssertions,
      details: 'query request failed',
    }
  }

  const events = await readSseEvents(response, step.timeoutMs)
  const normalizedEventTypes = events.map((event) => normalizeEventType(String(event.type || 'unknown')))
  const missing = step.requiredEventTypes.filter((type) => !normalizedEventTypes.includes(type))
  const eventSources = Array.from(new Set(events.map((event) => String(event.source || 'unknown'))))
  const nonEmptyEvent = events.some((event) => {
    const content = typeof event.content === 'string' ? event.content.trim() : ''
    const output = typeof event.result?.output === 'string' ? event.result.output.trim() : ''
    return content.length > 0 || output.length > 0
  })

  let status: ScenarioStepResult['status'] = 'pass'
  let details = ''
  if (missing.length > 0) {
    status = 'fail'
    details = `Missing events: ${missing.join(', ')}`
  } else if (!nonEmptyEvent) {
    status = 'fail'
    details = 'Expected a non-empty event payload'
  }

  return {
    step_id: step.id,
    name: step.name,
    status,
    expected_event_count: step.requiredEventTypes.length,
    actual_event_count: events.length,
    timeout_ms: step.timeoutMs,
    source_path: eventSources,
    state_assertions: step.stateAssertions,
    visible_assertions: step.visibleAssertions,
    details,
  }
}

function normalizeEventType(type: string): string {
  if (type === 'tool_use') return 'tool_start'
  return type
}

async function runStep(
  step: ScenarioStepDefinition,
  context: MutableContext,
): Promise<ScenarioStepResult> {
  try {
    switch (step.id) {
      case 1: {
        const { response, json } = await waitFor(fetchJson(`${context.baseUrl}/api/admin/auth/status`), step.timeoutMs)
        return {
          step_id: step.id,
          name: step.name,
          status: response.ok && typeof json?.hasAdminAccount === 'boolean' ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: response.ok ? '' : `HTTP ${response.status}`,
        }
      }
      case 2: {
        const anonymous = await fetchJson(`${context.baseUrl}/api/admin/auth/status`)
        let authPayload
        if (anonymous.json?.hasAdminAccount) {
          authPayload = await fetchJson(`${context.baseUrl}/api/admin/auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'secret-pass' }),
          })
        } else {
          authPayload = await fetchJson(`${context.baseUrl}/api/admin/auth/setup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              username: 'admin',
              password: 'secret-pass',
              bootstrapSecret: context.bootstrapSecret,
            }),
          })
        }
        context.adminToken = authPayload.json?.token || null
        return {
          step_id: step.id,
          name: step.name,
          status: authPayload.response.ok && Boolean(context.adminToken) ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: authPayload.response.ok ? '' : String(authPayload.json?.error || authPayload.response.status),
        }
      }
      case 3: {
        const sessionPayload = await fetchJson(`${context.baseUrl}/api/sessions`, { method: 'POST' })
        context.sessionId = sessionPayload.json?.id || null
        return {
          step_id: step.id,
          name: step.name,
          status: sessionPayload.response.ok && Boolean(context.sessionId) ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: sessionPayload.response.ok ? '' : `HTTP ${sessionPayload.response.status}`,
        }
      }
      case 4:
        return runQueryStep(context, context.sessionId!, 'Use the bash tool to run `pwd` and return the result.', step)
      case 5:
        return runQueryStep(context, context.sessionId!, 'Use the read_file tool to read README.md and return a short excerpt.', step)
      case 6:
        return runQueryStep(context, context.sessionId!, 'Use the write_file tool to write `hello build studio` into scratch/scenario.txt.', step)
      case 7:
        return runQueryStep(context, context.sessionId!, 'Use the bash tool to run `cat scratch/scenario.txt` and return the output.', step)
      case 8: {
        const skillList = await fetchJson(`${context.baseUrl}/api/sessions/${context.sessionId}/skills`)
        context.knownSkill = skillList.json?.[0]?.name || null
        if (!context.knownSkill) {
          return {
            step_id: step.id,
            name: step.name,
            status: 'fail',
            expected_event_count: step.requiredEventTypes.length,
            actual_event_count: 0,
            timeout_ms: step.timeoutMs,
            source_path: [],
            state_assertions: [...step.stateAssertions, 'No skill available'],
            visible_assertions: step.visibleAssertions,
            details: 'No skill returned from /skills',
          }
        }
        return runQueryStep(context, context.sessionId!, `Use the skill tool to invoke the local skill named ${context.knownSkill}.`, step)
      }
      case 9:
        return runQueryStep(context, context.sessionId!, `Use the skill tool to invoke the local skill named ${context.knownSkill}.`, step)
      case 10: {
        const connectorPayload = await fetchJson(`${context.baseUrl}/api/admin/connectors`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-admin-session': context.adminToken || '',
          },
          body: JSON.stringify({
            id: context.connectorId,
            name: 'Scenario Connector',
            kind: 'database',
            description: 'Scenario connector',
            capabilities: ['read'],
            status: 'connected',
            config: {},
            authType: 'apiKey',
            schemaHints: ['sales'],
            compatibilityStatus: 'ready',
          }),
        })
        return {
          step_id: step.id,
          name: step.name,
          status: connectorPayload.response.ok ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: connectorPayload.response.ok ? '' : String(connectorPayload.json?.error || connectorPayload.response.status),
        }
      }
      case 11: {
        const connectorsPayload = await fetchJson(`${context.baseUrl}/api/admin/connectors`, {
          headers: { 'x-admin-session': context.adminToken || '' },
        })
        const found = Array.isArray(connectorsPayload.json) && connectorsPayload.json.some((item: { id: string }) => item.id === context.connectorId)
        return {
          step_id: step.id,
          name: step.name,
          status: connectorsPayload.response.ok && found ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: found ? '' : 'Connector missing from list',
        }
      }
      case 12: {
        const modulePayload = await fetchJson(`${context.baseUrl}/api/admin/modules`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-admin-session': context.adminToken || '',
          },
          body: JSON.stringify({
            id: context.moduleId,
            name: 'Scenario Module',
            description: 'Scenario module',
            prompts: ['weekly sales'],
            requiredConnectorKinds: ['database'],
            reportTemplates: ['monthly-sales'],
            outputFormats: ['docx', 'report'],
          }),
        })
        return {
          step_id: step.id,
          name: step.name,
          status: modulePayload.response.ok ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: modulePayload.response.ok ? '' : String(modulePayload.json?.error || modulePayload.response.status),
        }
      }
      case 13: {
        const refreshPayload = await fetchJson(`${context.baseUrl}/api/admin/modules/${context.moduleId}/refresh`, {
          method: 'POST',
          headers: { 'x-admin-session': context.adminToken || '' },
        })
        const refreshed = refreshPayload.json?.module?.lifecycleState === 'refreshed'
        return {
          step_id: step.id,
          name: step.name,
          status: refreshPayload.response.ok && refreshed ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: refreshed ? '' : 'Module did not become refreshed',
        }
      }
      case 14: {
        const publishPayload = await fetchJson(`${context.baseUrl}/api/admin/modules/${context.moduleId}/publish`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-admin-session': context.adminToken || '',
          },
          body: JSON.stringify({ confirm: true }),
        })
        const published = publishPayload.json?.module?.lifecycleState === 'published'
        return {
          step_id: step.id,
          name: step.name,
          status: publishPayload.response.ok && published ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: published ? '' : 'Module did not become published',
        }
      }
      case 15: {
        const modulesPayload = await fetchJson(`${context.baseUrl}/api/admin/modules`, {
          headers: { 'x-admin-session': context.adminToken || '' },
        })
        const published = Array.isArray(modulesPayload.json) && modulesPayload.json.some((item: { id: string; lifecycleState: string }) => item.id === context.moduleId && item.lifecycleState === 'published')
        return {
          step_id: step.id,
          name: step.name,
          status: modulesPayload.response.ok && published ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: published ? '' : 'Published module missing from list',
        }
      }
      case 16: {
        const visibilityResult = await runAdminStudioVisibilityCheck({
          cwd: context.cwd,
          username: 'admin',
          password: 'secret-pass',
          bootstrapSecret: context.bootstrapSecret,
          moduleId: context.moduleId,
          moduleName: 'Scenario Module',
          panel: 'modules',
          screenshotPath: join(context.logDir, 'admin-studio-modules.png'),
        })
        return {
          step_id: step.id,
          name: step.name,
          status: visibilityResult.visible ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: ['browser'],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: visibilityResult.details,
        }
      }
      case 17:
        return runQueryStep(context, context.sessionId!, 'Generate a short report using the published module and available enterprise context.', step)
      case 18:
        return runQueryStep(context, context.sessionId!, 'Summarize the visible published outcome and return a non-empty response.', step)
      case 19: {
        await restartLocalServer(context)
        const loginPayload = await fetchJson(`${context.baseUrl}/api/admin/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'secret-pass' }),
        })
        context.adminToken = loginPayload.json?.token || null
        return {
          step_id: step.id,
          name: step.name,
          status: loginPayload.response.ok && Boolean(context.adminToken) ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: [],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: loginPayload.response.ok ? '' : 'Login failed after restart',
        }
      }
      case 20: {
        const [connectorsPayload, modulesPayload] = await Promise.all([
          fetchJson(`${context.baseUrl}/api/admin/connectors`, {
            headers: { 'x-admin-session': context.adminToken || '' },
          }),
          fetchJson(`${context.baseUrl}/api/admin/modules`, {
            headers: { 'x-admin-session': context.adminToken || '' },
          }),
        ])
        const connectorExists = Array.isArray(connectorsPayload.json) && connectorsPayload.json.some((item: { id: string }) => item.id === context.connectorId)
        const moduleExists = Array.isArray(modulesPayload.json) && modulesPayload.json.some((item: { id: string; lifecycleState: string }) => item.id === context.moduleId && item.lifecycleState === 'published')
        if (!connectorExists || !moduleExists) {
          return {
            step_id: step.id,
            name: step.name,
            status: 'fail',
            expected_event_count: 0,
            actual_event_count: 0,
            timeout_ms: step.timeoutMs,
            source_path: [],
            state_assertions: step.stateAssertions,
            visible_assertions: step.visibleAssertions,
            details: 'Persistence assertion failed after restart',
          }
        }
        const visibilityResult = await runAdminStudioVisibilityCheck({
          cwd: context.cwd,
          username: 'admin',
          password: 'secret-pass',
          bootstrapSecret: context.bootstrapSecret,
          moduleId: context.moduleId,
          moduleName: 'Scenario Module',
          panel: 'modules',
          screenshotPath: join(context.logDir, 'admin-studio-after-restart.png'),
        })
        return {
          step_id: step.id,
          name: step.name,
          status: visibilityResult.visible ? 'pass' : 'fail',
          expected_event_count: 0,
          actual_event_count: 0,
          timeout_ms: step.timeoutMs,
          source_path: ['browser'],
          state_assertions: step.stateAssertions,
          visible_assertions: step.visibleAssertions,
          details: visibilityResult.details,
        }
      }
      default:
        throw new Error(`Unsupported step id ${step.id}`)
    }
  } catch (error) {
    return {
      step_id: step.id,
      name: step.name,
      status: 'fail',
      expected_event_count: step.requiredEventTypes.length,
      actual_event_count: 0,
      timeout_ms: step.timeoutMs,
      source_path: [],
      state_assertions: step.stateAssertions,
      visible_assertions: step.visibleAssertions,
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

function inferFailureCode(result: ScenarioRunResult): FailureCode | null {
  const failedStep = result.steps.find((step) => step.status === 'fail')
  if (!failedStep) return null

  const details = failedStep.details || ''
  if (details.includes('Timed out')) return 'HANG_TIMEOUT'
  if (details.includes('Missing events')) return 'MISSING_REQUIRED_EVENT'
  if (/visib/i.test(details)) return 'VISIBILITY_MISMATCH'
  if (failedStep.name.includes('restart') || failedStep.name.includes('persisted')) return 'STALE_STATE_AFTER_RESTART'
  if (failedStep.name.includes('skill') && details.includes('hidden')) return 'MIXED_PATH_LEAK'
  if (details.includes('non-empty')) return 'BLANK_RESULT'
  return 'STATE_CORRUPTION'
}

async function main() {
  const suite = parseArgValue('--suite') || BUILD_STUDIO_20_SUITE
  const mode = (parseArgValue('--mode') || 'shadow') as ScenarioMode
  const restartCount = Number(parseArgValue('--restarts') || '0')
  const externalBaseUrl = parseArgValue('--base-url')
  const keepServer = hasFlag('--keep-server')

  if (suite !== BUILD_STUDIO_20_SUITE) {
    throw new Error(`Unsupported suite: ${suite}`)
  }
  if (mode !== 'shadow' && mode !== 'primary') {
    throw new Error(`Unsupported mode: ${mode}`)
  }

  const scenarioRoot = await mkdtemp(join(tmpdir(), 'build-studio-scenario-'))
  const logDir = resolve(scenarioRoot, 'logs')
  await mkdir(logDir, { recursive: true })

  const context: MutableContext = {
    baseUrl: externalBaseUrl || '',
    cwd: scenarioRoot,
    logDir,
    bootstrapSecret: 'build-studio-scenario-bootstrap',
    adminToken: null,
    sessionId: null,
    connectorId: 'scenario-connector',
    moduleId: 'scenario-module',
    knownSkill: null,
    server: null,
    restartCount: 0,
  }

  if (!externalBaseUrl) {
    const local = await startLocalServer(scenarioRoot)
    context.baseUrl = local.baseUrl
    context.server = local.server
  }

  let result = createScenarioResult(mode, logDir, restartCount)

  try {
    for (const step of BUILD_STUDIO_20_STEPS) {
      process.stderr.write(`[scenario] step ${step.id}: ${step.name}\n`)
      const stepResult = await runStep(step, context)
      result.steps.push(stepResult)
      await writeFile(join(logDir, `step-${String(step.id).padStart(2, '0')}.json`), JSON.stringify(stepResult, null, 2))
      if (stepResult.status === 'fail') {
        break
      }
    }

    result.restart_count = context.restartCount
    result = finalizeScenarioResult(result)
    result.failure_code = inferFailureCode(result)
    await writeFile(join(logDir, 'scenario-result.json'), JSON.stringify(result, null, 2))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status === 'fail') {
      process.exitCode = 1
    }
  } finally {
    if (context.server && !keepServer) {
      await new Promise<void>((resolveClose) => context.server?.close(() => resolveClose()))
    }
    if (!keepServer) {
      // Preserve logs even on cleanup by leaving the temp directory in place.
    }
  }
}

main().catch(async (error) => {
  const failure = {
    suite: BUILD_STUDIO_20_SUITE,
    mode: (parseArgValue('--mode') || 'shadow') as ScenarioMode,
    status: 'fail',
    failure_code: 'CRASH_PROCESS_EXIT',
    steps: [],
    restart_count: Number(parseArgValue('--restarts') || '0'),
    log_dir: '',
    error: error instanceof Error ? error.message : String(error),
  }
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`)
  process.exitCode = 1
})
