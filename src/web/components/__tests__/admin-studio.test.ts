import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { createWebApp } from '../../server'
import { chromium, type Browser, type Page } from 'playwright'

describe('Admin Studio UI components', () => {
  let baseUrl = ''
  let server: ReturnType<typeof createServer>
  let adminToken = ''
  let browser: Browser
  let page: Page
  const bootstrapSecret = 'test-bootstrap-secret'

  beforeAll(async () => {
    process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET = bootstrapSecret
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-ui-test-'))
    const { app } = await createWebApp(cwd)
    server = createServer(app)
    await new Promise<void>(resolve => server.listen(0, resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`

    const setupResponse = await fetch(`${baseUrl}/api/admin/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret-pass', bootstrapSecret }),
    })
    if (setupResponse.ok) {
      const setupJson = await setupResponse.json()
      adminToken = setupJson.token
    }

    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
    await page.goto(`${baseUrl}/?surface=admin&adminPanel=modules`)
    await page.waitForLoadState('networkidle')

    // Ensure we're on admin surface
    const adminBtn = await page.$('[data-testid="surface-admin"]')
    if (adminBtn) {
      const isActive = await adminBtn.evaluate(el => el.classList.contains('active'))
      if (!isActive) {
        await adminBtn.click()
        await page.waitForTimeout(1000)
      }
    }

    await page.waitForSelector('[data-testid="admin-studio"]', { timeout: 30000 })
  }, 60000)

  afterAll(async () => {
    delete process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET
    await browser?.close()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })

  test('DataSourceManager renders in Admin Studio', async () => {
    await page.goto(`${baseUrl}/?surface=admin&adminPanel=sources`)
    await page.waitForSelector('[data-testid="admin-data-sources"]', { timeout: 15000 })
    const element = await page.$('[data-testid="admin-data-sources"]')
    expect(element).not.toBeNull()
  })

  test('ModuleManager renders in Admin Studio', async () => {
    await page.goto(`${baseUrl}/?surface=admin&adminPanel=modules`)
    await page.waitForSelector('[data-testid="admin-modules"]', { timeout: 15000 })
    const element = await page.$('[data-testid="admin-modules"]')
    expect(element).not.toBeNull()
  })

  test('Admin Studio surface switching works', async () => {
    await page.goto(`${baseUrl}/?surface=admin&adminPanel=overview`)
    await page.waitForSelector('[data-testid="admin-studio"]', { timeout: 15000 })

    const workspaceBtn = await page.$('[data-testid="surface-workspace"]')
    const adminBtn = await page.$('[data-testid="surface-admin"]')
    expect(workspaceBtn).not.toBeNull()
    expect(adminBtn).not.toBeNull()

    await workspaceBtn!.click()
    await page.waitForTimeout(500)

    await adminBtn!.click()
    await page.waitForSelector('[data-testid="admin-studio"]', { timeout: 10000 })
  })

  test('ModuleManager shows module rows', async () => {
    await page.goto(`${baseUrl}/?surface=admin&adminPanel=modules`)
    await page.waitForSelector('[data-testid="admin-modules"]', { timeout: 15000 })

    const sessionResponse = await fetch(`${baseUrl}/api/sessions`, {
      headers: { 'x-admin-session': adminToken },
    })
    expect(sessionResponse.ok).toBe(true)
  })
})