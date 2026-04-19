import { execFile, spawn, type ChildProcess } from 'child_process'
import { createServer } from 'http'
import { once } from 'events'
import { mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { chromium } from 'playwright'
import { promisify } from 'util'

type VisibilityCheckInput = {
  cwd: string
  username: string
  password: string
  bootstrapSecret?: string
  moduleId: string
  moduleName: string
  panel?: 'overview' | 'sources' | 'modules' | 'reports'
  screenshotPath?: string
}

export type VisibilityCheckResult = {
  visible: boolean
  baseUrl: string
  details: string
  screenshotPath?: string
}

export async function runAdminStudioVisibilityCheck(input: VisibilityCheckInput): Promise<VisibilityCheckResult> {
  const port = await reservePort()
  const serverProcess = startWebServer(input.cwd, port)
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    await waitForHealthy(baseUrl, 30_000)
    try {
      return await withTimeout(runPlaywrightVisibilityCheck(baseUrl, input), 120_000, 'Playwright visibility check timed out')
    } catch (playwrightError) {
      const message = playwrightError instanceof Error ? playwrightError.message : String(playwrightError)
      if (!/Executable doesn't exist|browserType\.launch/i.test(message)) {
        throw playwrightError
      }
      return await withTimeout(runSafariVisibilityCheck(
        baseUrl,
        input,
        message,
      ), 30_000, 'Safari visibility check timed out')
    }
  } finally {
    await stopWebServer(serverProcess)
  }
}

async function runPlaywrightVisibilityCheck(baseUrl: string, input: VisibilityCheckInput): Promise<VisibilityCheckResult> {
  let stage = 'launch'
  console.error(`[visibility] playwright stage=${stage}`)
  const browser = await chromium.launch({ headless: true })

  try {
    const adminToken = await fetchAdminToken(baseUrl, input)
    stage = 'new-page'
    console.error(`[visibility] playwright stage=${stage}`)
    const context = await browser.newContext()
    const page = await context.newPage()
    if (adminToken) {
      // Set localStorage after page load to avoid SecurityError in null-origin init script
      await page.addInitScript((token: string) => {
        window.localStorage.setItem('free-code-admin-token', token)
      }, adminToken)
    }
    stage = 'goto'
    console.error(`[visibility] playwright stage=${stage}`)
    await page.goto(`${baseUrl}/?surface=admin&adminPanel=${input.panel || 'modules'}`, {
      waitUntil: 'domcontentloaded',
    })
    stage = 'root-selector'
    console.error(`[visibility] playwright stage=${stage}`)
    await page.waitForSelector('[data-testid="admin-studio"]', { timeout: 60_000 })
    stage = 'auth-state'
    console.error(`[visibility] playwright stage=${stage}`)
    if (adminToken) {
      await page.waitForSelector('[data-testid="admin-studio-authenticated"]', { timeout: 15_000 })
    } else {
      await page.waitForFunction(
        () => Boolean(
          document.querySelector('[data-testid="admin-studio-setup"]') ||
          document.querySelector('[data-testid="admin-studio-login"]'),
        ),
        { timeout: 15_000 },
      )
    }

    stage = 'open-admin-surface'
    console.error(`[visibility] playwright stage=${stage}`)
    await page.getByTestId('surface-admin').click()
    stage = 'open-modules-tab'
    console.error(`[visibility] playwright stage=${stage}`)
    await page.getByTestId('admin-studio-tab-modules').click()
    stage = 'wait-modules-panel'
    console.error(`[visibility] playwright stage=${stage}`)
    await page.waitForSelector('[data-testid="admin-studio-panel-modules"]', { timeout: 60_000 })
    stage = 'wait-module-row'
    console.error(`[visibility] playwright stage=${stage}`)
    await page.waitForSelector(`[data-testid="admin-module-row-${input.moduleId}"]`, { timeout: 60_000 })

    if (input.screenshotPath) {
      await mkdir(dirname(input.screenshotPath), { recursive: true })
      await page.screenshot({ path: input.screenshotPath, fullPage: true })
    }

    const rowText = await page.getByTestId(`admin-module-row-${input.moduleId}`).textContent()
    const visible = Boolean(rowText?.includes(input.moduleName))

    return {
      visible,
      baseUrl,
      details: visible
        ? `Module ${input.moduleId} is visible in Admin Studio modules panel.`
        : `Module ${input.moduleId} row rendered without expected module name.`,
      screenshotPath: input.screenshotPath,
    }
  } finally {
    await browser.close()
  }
}

async function fetchAdminToken(baseUrl: string, input: VisibilityCheckInput): Promise<string | null> {
  const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: input.username, password: input.password }),
  })

  if (loginResponse.ok) {
    const data = await loginResponse.json()
    return typeof data.token === 'string' ? data.token : null
  }

  if (!input.bootstrapSecret) {
    return null
  }

  const setupResponse = await fetch(`${baseUrl}/api/admin/auth/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: input.username,
      password: input.password,
      bootstrapSecret: input.bootstrapSecret,
    }),
  })

  if (!setupResponse.ok) {
    return null
  }

  const data = await setupResponse.json()
  return typeof data.token === 'string' ? data.token : null
}

const execFileAsync = promisify(execFile)

async function runSafariVisibilityCheck(
  baseUrl: string,
  input: VisibilityCheckInput,
  fallbackReason: string,
): Promise<VisibilityCheckResult> {
  const pageUrl = `${baseUrl}/?surface=admin&adminPanel=${input.panel || 'modules'}`
  await runAppleScript(`
    tell application "Safari"
      activate
      if (count of documents) = 0 then
        make new document
      end if
      set URL of front document to "${escapeAppleScript(pageUrl)}"
    end tell
  `)

  await waitForBrowserCondition(() => evaluateSafari(`
    (() => {
      return document.readyState === 'complete' &&
        !!document.querySelector('[data-testid="admin-studio"]')
    })()
  `), 20_000, 'Admin Studio did not render in Safari')

  const authMode = (await evaluateSafari(`
    (() => {
      if (document.querySelector('[data-testid="admin-studio-setup"]')) return 'setup'
      if (document.querySelector('[data-testid="admin-studio-login"]')) return 'login'
      return 'authenticated'
    })()
  `)).trim()

  if (authMode === 'setup' || authMode === 'login') {
    await evaluateSafari(buildSafariFormScript(input, authMode === 'setup'))
    await waitForBrowserCondition(() => evaluateSafari(`
      (() => !!document.querySelector('[data-testid="admin-studio-authenticated"]'))()
    `), 20_000, 'Admin Studio authentication did not complete in Safari')
  }

  await evaluateSafari(`
    (() => {
      document.querySelector('[data-testid="surface-admin"]')?.click()
      document.querySelector('[data-testid="admin-studio-tab-modules"]')?.click()
      return 'ok'
    })()
  `)

  const rowText = await waitForBrowserCondition(() => evaluateSafari(`
    (() => {
      const row = document.querySelector('[data-testid="admin-module-row-${escapeJsString(input.moduleId)}"]')
      return row ? row.textContent || '' : ''
    })()
  `), 20_000, `Module ${input.moduleId} did not appear in Safari`)

  if (input.screenshotPath) {
    await mkdir(dirname(input.screenshotPath), { recursive: true })
    try {
      await execFileAsync('screencapture', ['-x', input.screenshotPath])
    } catch {
      // Ignore screenshot failures; DOM visibility is the gate.
    }
  }

  const visible = rowText.includes(input.moduleName)
  return {
    visible,
    baseUrl,
    details: visible
      ? `Module ${input.moduleId} is visible in Admin Studio modules panel via Safari fallback.`
      : `Safari opened Admin Studio, but the rendered module row did not include ${input.moduleName}. Playwright fallback reason: ${fallbackReason}`,
    screenshotPath: input.screenshotPath,
  }
}

function startWebServer(cwd: string, port: number): ChildProcess {
  const serverEntry = fileURLToPath(new URL('../src/web/server.ts', import.meta.url))
  return spawn('bun', ['run', serverEntry], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: 'ignore',
  })
}

async function stopWebServer(serverProcess: ChildProcess): Promise<void> {
  if (serverProcess.exitCode !== null) {
    return
  }

  serverProcess.kill('SIGTERM')
  try {
    await once(serverProcess, 'exit')
  } catch {
    // Ignore child process shutdown errors.
  }
}

async function waitForHealthy(baseUrl: string, timeoutMs: number): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Retry until the dev server is accepting connections.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for ${baseUrl} to become healthy`)
}

async function reservePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 8080
  server.close()
  await once(server, 'close')
  return port
}

async function evaluateSafari(script: string): Promise<string> {
  const wrapped = `
    tell application "Safari"
      do JavaScript "${escapeAppleScript(script)}" in front document
    end tell
  `
  const { stdout } = await execFileAsync('osascript', ['-e', wrapped])
  return stdout.trim()
}

async function runAppleScript(script: string): Promise<void> {
  await execFileAsync('osascript', ['-e', script])
}

async function waitForBrowserCondition(
  evaluator: () => Promise<string>,
  timeoutMs: number,
  errorMessage: string,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const result = await evaluator()
    if (result && result !== 'false' && result !== 'undefined' && result !== 'null') {
      return result
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(errorMessage)
}

function buildSafariFormScript(input: VisibilityCheckInput, includeBootstrap: boolean): string {
  const bootstrapLine = includeBootstrap && input.bootstrapSecret
    ? `
      setField('[data-testid="admin-studio-bootstrap-secret"]', '${escapeJsString(input.bootstrapSecret)}')
    `
    : ''

  return `
    (() => {
      const setField = (selector, value) => {
        const input = document.querySelector(selector)
        if (!input) return
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        descriptor?.set?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      setField('[data-testid="admin-studio-username"]', '${escapeJsString(input.username)}')
      setField('[data-testid="admin-studio-password"]', '${escapeJsString(input.password)}')
      ${bootstrapLine}
      document.querySelector('[data-testid="${includeBootstrap ? 'admin-studio-setup' : 'admin-studio-login'}"]')?.click()
      return 'submitted'
    })()
  `
}

function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

if (import.meta.main) {
  const args = new Map<string, string>()
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1] || '')
  }

  const result = await runAdminStudioVisibilityCheck({
    cwd: args.get('--cwd') || process.cwd(),
    username: args.get('--username') || 'admin',
    password: args.get('--password') || 'secret-pass',
    bootstrapSecret: args.get('--bootstrap-secret') || undefined,
    moduleId: args.get('--module-id') || '',
    moduleName: args.get('--module-name') || '',
    panel: (args.get('--panel') as VisibilityCheckInput['panel']) || 'modules',
    screenshotPath: args.get('--screenshot') || undefined,
  })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.visible ? 0 : 1
}
