import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { createWebApp } from '../../server'

describe('enterprise admin API', () => {
  let baseUrl = ''
  let server: ReturnType<typeof createServer>
  let adminToken = ''
  const bootstrapSecret = 'bootstrap-secret'

  beforeAll(async () => {
    process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET = bootstrapSecret
    const cwd = mkdtempSync(join(tmpdir(), 'free-code-web-admin-'))
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
    expect(setupResponse.status).toBe(200)
    const setupJson = await setupResponse.json()
    adminToken = setupJson.token
  })

  afterAll(async () => {
    delete process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })

  test('reports auth status, supports login, and invalidates logout sessions', async () => {
    const anonymousStatus = await fetch(`${baseUrl}/api/admin/auth/status`)
    expect(anonymousStatus.status).toBe(200)
    expect(await anonymousStatus.json()).toMatchObject({
      hasAdminAccount: true,
      isAuthenticated: false,
      requiresBootstrapSecret: false,
    })

    const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret-pass' }),
    })
    expect(loginResponse.status).toBe(200)
    const loginJson = await loginResponse.json()
    expect(typeof loginJson.token).toBe('string')

    const authenticatedStatus = await fetch(`${baseUrl}/api/admin/auth/status`, {
      headers: { 'x-admin-session': loginJson.token },
    })
    expect(authenticatedStatus.status).toBe(200)
    expect(await authenticatedStatus.json()).toMatchObject({
      hasAdminAccount: true,
      isAuthenticated: true,
      username: 'admin',
      requiresBootstrapSecret: false,
    })

    const logoutResponse = await fetch(`${baseUrl}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { 'x-admin-session': loginJson.token },
    })
    expect(logoutResponse.status).toBe(200)

    const revokedStatus = await fetch(`${baseUrl}/api/admin/auth/status`, {
      headers: { 'x-admin-session': loginJson.token },
    })
    expect(revokedStatus.status).toBe(200)
    expect(await revokedStatus.json()).toMatchObject({
      hasAdminAccount: true,
      isAuthenticated: false,
      requiresBootstrapSecret: false,
    })
  })

  test('rejects legacy public module management routes', async () => {
    const response = await fetch(`${baseUrl}/api/modules`)
    expect(response.status).toBe(404)
  })

  test('creates connectors and module drafts via admin routes', async () => {
    const connectorResponse = await fetch(`${baseUrl}/api/admin/connectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-session': adminToken },
      body: JSON.stringify({
        id: 'erp-sync',
        name: 'ERP Sync',
        kind: 'external',
        description: 'ERP source',
        capabilities: ['read', 'aggregate'],
        status: 'connected',
        config: {},
        authType: 'oauth',
        schemaHints: ['orders', 'line items'],
        compatibilityStatus: 'ready',
      }),
    })
    expect(connectorResponse.status).toBe(200)

    const moduleResponse = await fetch(`${baseUrl}/api/admin/modules`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-session': adminToken },
      body: JSON.stringify({
        id: 'sales-weekly',
        name: 'Sales Weekly',
        description: 'Weekly sales reporting module',
        prompts: ['weekly sales'],
        requiredConnectorKinds: ['external'],
        reportTemplates: ['monthly-sales'],
        outputFormats: ['docx', 'report'],
      }),
    })
    expect(moduleResponse.status).toBe(200)

    const moduleJson = await moduleResponse.json()
    expect(moduleJson.module.lifecycleState).toBe('draft')
  })

  test('refreshes and publishes modules only through admin endpoints', async () => {
    const refreshResponse = await fetch(`${baseUrl}/api/admin/modules/sales-weekly/refresh`, {
      method: 'POST',
      headers: { 'x-admin-session': adminToken },
    })
    expect(refreshResponse.status).toBe(200)
    const refreshed = await refreshResponse.json()
    expect(refreshed.module.lifecycleState).toBe('refreshed')

    const rejectedPublish = await fetch(`${baseUrl}/api/admin/modules/sales-weekly/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-session': adminToken },
      body: JSON.stringify({}),
    })
    expect(rejectedPublish.status).toBe(400)

    const publishResponse = await fetch(`${baseUrl}/api/admin/modules/sales-weekly/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-session': adminToken },
      body: JSON.stringify({ confirm: true }),
    })
    expect(publishResponse.status).toBe(200)
    const published = await publishResponse.json()
    expect(published.module.lifecycleState).toBe('published')
  })

  test('blocks legacy global file endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/files/read?path=/tmp/anything`)
    expect(response.status).toBe(404)
  })

  test('rejects workspace path traversal attempts', async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' })
    const session = await sessionResponse.json()

    const readResponse = await fetch(`${baseUrl}/api/sessions/${session.id}/workspace/read?path=../secret.txt`)
    expect(readResponse.status).toBe(403)

    const writeResponse = await fetch(`${baseUrl}/api/sessions/${session.id}/workspace/write`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '../secret.txt', content: 'nope' }),
    })
    expect(writeResponse.status).toBe(403)
  })

  test('rejects admin routes without a valid auth session', async () => {
    const response = await fetch(`${baseUrl}/api/admin/modules`, {
      headers: { 'x-admin-session': 'invalid-token' },
    })
    expect(response.status).toBe(401)
  })
})
