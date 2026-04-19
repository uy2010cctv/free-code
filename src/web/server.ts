import 'dotenv/config'
import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import { createServer as createViteServer } from 'vite'
import { SessionManager, type StreamEvent } from './engine/index.js'
import { AdminAuthService } from './engine/auth/AdminAuthService.js'
import { readFile, writeFile, readdir } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function createWebApp(cwd: string = process.cwd()) {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // Initialize SessionManager
  const sessionManager = new SessionManager(cwd)
  await sessionManager.initialize()
  const adminAuth = new AdminAuthService(resolve(cwd, '.free-code-enterprise', 'admin-auth.json'))
  await adminAuth.initialize()

  let activeQueryController: AbortController | null = null

  function requireAdmin(req: Request, res: Response): boolean {
    const token = req.header('x-admin-session') || undefined
    if (!adminAuth.isAuthorized(token)) {
      res.status(401).json({ error: 'Admin authentication required' })
      return false
    }
    return true
  }

  function resolveWorkspacePath(workspacePath: string, requestedPath: string): string | null {
    const fullPath = resolve(workspacePath, requestedPath)
    const relPath = relative(workspacePath, fullPath)

    if (relPath.startsWith('..') || isAbsolute(relPath)) {
      return null
    }

    return fullPath
  }

  // API Routes

  // Create new session
  app.post('/api/sessions', (req: Request, res: Response) => {
    const session = sessionManager.createSession()
    res.json(session)
  })

  // Get all sessions
  app.get('/api/sessions', (req: Request, res: Response) => {
    const sessions = sessionManager.getAllSessions()
    res.json(sessions)
  })

  // Delete session
  app.delete('/api/sessions/:id', (req: Request, res: Response) => {
    const { id } = req.params
    const deleted = sessionManager.deleteSession(id)
    if (deleted) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'Session not found' })
    }
  })

  // Get session messages
  app.get('/api/sessions/:id/messages', (req: Request, res: Response) => {
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    res.json(session.messages)
  })

  // Rewind session
  app.post('/api/sessions/:id/rewind', (req: Request, res: Response) => {
    const { id } = req.params
    const { messageId } = req.body
    if (!messageId) {
      res.status(400).json({ error: 'messageId is required' })
      return
    }
    const success = sessionManager.rewindConversationTo(id, messageId)
    if (success) {
      const session = sessionManager.getSession(id)
      res.json({ success: true, messages: session?.messages || [] })
    } else {
      res.status(404).json({ error: 'Message not found' })
    }
  })

  // Get selectable messages for rewind
  app.get('/api/sessions/:id/rewind/messages', (req: Request, res: Response) => {
    const { id } = req.params
    const messages = sessionManager.getSelectableMessagesForRewind(id)
    res.json(messages)
  })

  // Execute a skill directly
  app.post('/api/sessions/:id/skill', async (req: Request, res: Response) => {
    const { id } = req.params
    const { skillName, args } = req.body

    if (!skillName) {
      res.status(400).json({ error: 'skillName is required' })
      return
    }

    const engine = sessionManager.getEngine(id)
    if (!engine) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    // Get the skill from session manager
    const skill = sessionManager.findSkill(skillName)
    if (!skill) {
      res.status(404).json({ error: `Skill '${skillName}' not found` })
      return
    }

    try {
      // Execute the skill and return its prompt content
      const result = await sessionManager.executeSkill(skillName, args || '')
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to execute skill' })
    }
  })

  // Get all available skills
  app.get('/api/sessions/:id/skills', (req: Request, res: Response) => {
    const { id } = req.params
    const skills = sessionManager.getSkills()
    res.json(skills.map(s => ({ name: s.name, description: s.description })))
  })

  app.get('/api/admin/auth/status', (req: Request, res: Response) => {
    const token = req.header('x-admin-session') || undefined
    res.json(adminAuth.getStatus(token))
  })

  app.post('/api/admin/auth/setup', async (req: Request, res: Response) => {
    const { username, password, bootstrapSecret } = req.body || {}
    if (!username || !password || !bootstrapSecret) {
      res.status(400).json({ error: 'username, password, and bootstrapSecret are required' })
      return
    }

    try {
      const token = await adminAuth.setupAdmin(String(username), String(password), String(bootstrapSecret))
      res.json({ success: true, token, username: String(username) })
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to setup admin account' })
    }
  })

  app.post('/api/admin/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body || {}
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' })
      return
    }

    try {
      const token = adminAuth.login(String(username), String(password))
      res.json({ success: true, token, username: String(username) })
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Login failed' })
    }
  })

  app.post('/api/admin/auth/logout', (req: Request, res: Response) => {
    adminAuth.logout(req.header('x-admin-session') || undefined)
    res.json({ success: true })
  })

  app.get('/api/admin/connectors', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    res.json(sessionManager.getConnectors())
  })

  app.post('/api/admin/connectors', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    await sessionManager.registerConnector(req.body)
    res.json({ success: true, connector: req.body })
  })

  app.put('/api/admin/connectors/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    const connector = await sessionManager.updateConnector(req.params.id, req.body)
    if (!connector) {
      res.status(404).json({ error: 'Connector not found' })
      return
    }
    res.json({ success: true, connector })
  })

  app.post('/api/admin/sessions/:id/connectors', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    sessionManager.setEnterpriseSessionState(id, {
      selectedConnectorIds: Array.isArray(req.body.connectorIds) ? req.body.connectorIds : [],
    })
    res.json({ success: true })
  })

  app.get('/api/admin/modules', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    res.json(sessionManager.getModules())
  })

  app.post('/api/admin/modules', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    const body = req.body || {}
    const module = await sessionManager.saveModule({
      id: String(body.id || ''),
      name: String(body.name || ''),
      description: String(body.description || ''),
      version: String(body.version || '1.0.0'),
      prompts: Array.isArray(body.prompts) ? body.prompts : [],
      requiredConnectorKinds: Array.isArray(body.requiredConnectorKinds) ? body.requiredConnectorKinds : [],
      reportTemplates: Array.isArray(body.reportTemplates) ? body.reportTemplates : [],
      outputFormats: Array.isArray(body.outputFormats) ? body.outputFormats : ['docx', 'xlsx', 'report'],
      lifecycleState: 'draft',
      refreshedAt: undefined,
      publishedAt: undefined,
    })
    res.json({ success: true, module })
  })

  app.post('/api/admin/modules/refresh', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    const modules = Array.isArray(req.body.modules) ? req.body.modules : []
    await sessionManager.refreshModules(modules)
    res.json({ success: true })
  })

  app.post('/api/admin/modules/:id/refresh', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    const module = await sessionManager.refreshModule(req.params.id)
    if (!module) {
      res.status(404).json({ error: 'Module not found' })
      return
    }
    res.json({ success: true, module })
  })

  app.post('/api/admin/modules/:id/publish', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    if (req.body?.confirm !== true) {
      res.status(400).json({ error: 'Module publish requires explicit confirmation' })
      return
    }

    const published = await sessionManager.publishModule(req.params.id)
    if (!published) {
      res.status(404).json({ error: 'Module not found' })
      return
    }

    res.json({ success: true, module: published })
  })

  app.post('/api/admin/sessions/:id/modules', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    sessionManager.setEnterpriseSessionState(id, {
      selectedModuleIds: Array.isArray(req.body.moduleIds) ? req.body.moduleIds : [],
    })
    res.json({ success: true })
  })

  app.post('/api/sessions/:id/reports/plan', async (req: Request, res: Response) => {
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const plan = await sessionManager.buildReportPlan(
      id,
      String(req.body.prompt || ''),
      String(req.body.reportType || 'business-report'),
    )
    res.json(plan)
  })

  app.post('/api/sessions/:id/connectors', (req: Request, res: Response) => {
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    sessionManager.setEnterpriseSessionState(id, {
      selectedConnectorIds: Array.isArray(req.body.connectorIds) ? req.body.connectorIds : [],
    })
    res.json({ success: true })
  })

  app.all([
    '/api/connectors',
    '/api/modules',
    '/api/modules/refresh',
    '/api/modules/:id/publish',
    '/api/sessions/:id/modules',
  ], (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Enterprise management endpoints moved to /api/admin/*' })
  })

  // Session workspace file operations
  app.get('/api/sessions/:id/workspace/files', async (req: Request, res: Response) => {
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session || !session.workspacePath) {
      res.status(404).json({ error: 'Session workspace not found' })
      return
    }
    try {
      const entries = await readdir(session.workspacePath, { withFileTypes: true })
      const files = entries.map(entry => ({
        name: entry.name,
        path: join(session.workspacePath!, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      res.json(files)
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to list files' })
    }
  })

  app.get('/api/sessions/:id/workspace/read', async (req: Request, res: Response) => {
    const { id } = req.params
    const { path: filePath } = req.query
    const session = sessionManager.getSession(id)
    if (!session || !session.workspacePath) {
      res.status(404).json({ error: 'Session workspace not found' })
      return
    }
    // Ensure the file is within workspace
    const fullPath = resolveWorkspacePath(session.workspacePath, String(filePath))
    if (!fullPath) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    try {
      const ext = String(filePath).toLowerCase().split('.').pop()
      const isBinary = ['docx', 'xlsx', 'doc', 'xls', 'pdf', 'png', 'jpg', 'jpeg', 'gif'].includes(ext || '')

      if (isBinary) {
        const buffer = await readFile(fullPath)
        const base64 = buffer.toString('base64')
        res.json({ content: base64, encoding: 'base64', isBinary: true })
      } else {
        const content = await readFile(fullPath, 'utf-8')
        res.json({ content, encoding: 'utf-8', isBinary: false })
      }
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'File not found' })
    }
  })

  app.post('/api/sessions/:id/workspace/write', async (req: Request, res: Response) => {
    const { id } = req.params
    const { path: filePath, content } = req.body
    const session = sessionManager.getSession(id)
    if (!session || !session.workspacePath) {
      res.status(404).json({ error: 'Session workspace not found' })
      return
    }
    // Ensure the file is within workspace
    const fullPath = resolveWorkspacePath(session.workspacePath, String(filePath))
    if (!fullPath) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    try {
      await writeFile(fullPath, content, 'utf-8')
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to write file' })
    }
  })

  app.get('/api/sessions/:id/workspace', (req: Request, res: Response) => {
    const { id } = req.params
    const session = sessionManager.getSession(id)
    if (!session || !session.workspacePath) {
      res.status(404).json({ error: 'Session workspace not found' })
      return
    }
    res.json({ workspacePath: session.workspacePath })
  })

  // Query (SSE streaming)
  app.post('/api/sessions/:id/query', async (req: Request, res: Response) => {
    const { id } = req.params
    const { message } = req.body

    if (!message) {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    const engine = sessionManager.getEngine(id)
    const session = sessionManager.getSession(id)
    if (!engine || !session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    activeQueryController = new AbortController()

    const context = {
      cwd: session.workspacePath || process.cwd(),
      sessionId: id,
      signal: activeQueryController.signal,
    }

    const runtime = sessionManager.getEnterpriseRuntimeContext(id)
    engine.setRuntimeContext({
      connectorSummaries: runtime.connectors.map(item => `${item.name} (${item.kind}, ${item.compatibilityStatus}, schema: ${item.schemaHints.join('/') || 'none'})`),
      moduleSummaries: runtime.publishedModules.map(item => `${item.name} (${item.lifecycleState}, templates: ${item.reportTemplates.join('/') || 'none'}, outputs: ${item.outputFormats.join('/') || 'none'})`),
    })

    try {
      if (/report|summary|dashboard|analysis/i.test(message)) {
        const reportPlan = await sessionManager.buildReportPlan(id, message)
        const planEvent: StreamEvent = {
          type: 'report_plan',
          reportType: reportPlan.reportType,
          summary: reportPlan.summary,
          trace: reportPlan.trace,
          exports: reportPlan.exports,
          timestamp: Date.now(),
          source: 'runtime-v2',
        }
        res.write(`data: ${JSON.stringify(planEvent)}\n\n`)
      }

      for await (const event of engine.submitMessage(message, context)) {
        if (activeQueryController?.signal.aborted) {
          break
        }

        // Send event to client
        res.write(`data: ${JSON.stringify(event)}\n\n`)

        // Update session title if we have assistant content
        if (event.type === 'assistant' && event.content.length > 30) {
          const title = event.content.slice(0, 30).replace(/\n/g, ' ') + '...'
          sessionManager.updateSessionTitle(id, title)
        }

        // Store message in session
        if (event.type === 'user' || event.type === 'assistant') {
          sessionManager.addMessage(id, {
            id: event.id,
            type: event.type,
            role: event.type,
            content: event.content,
            timestamp: event.timestamp,
          })
        }
      }

      // Engine already sends 'done' event, no need to send again
    } catch (error: any) {
      console.error('Query error:', error)
      if (!res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
      }
    } finally {
      activeQueryController = null
      res.end()
    }
  })

  // Cancel query
  app.delete('/api/sessions/:id/query', (req: Request, res: Response) => {
    if (activeQueryController) {
      activeQueryController.abort()
      res.json({ success: true })
    } else {
      res.json({ success: false, message: 'No active query' })
    }
  })

  // Legacy cancel endpoint
  app.delete('/api/query/cancel', (req: Request, res: Response) => {
    if (activeQueryController) {
      activeQueryController.abort()
      res.json({ success: true })
    } else {
      res.json({ success: false, message: 'No active query' })
    }
  })

  // Tool execution endpoint
  app.post('/api/tools/:name', async (req: Request, res: Response) => {
    const { name } = req.params
    const { args, sessionId } = req.body

    const engine = sessionManager.getEngine(sessionId)
    if (!engine) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    // Get tool from engine
    // Note: Tool execution is handled within submitMessage for now
    res.status(400).json({ error: 'Use /query endpoint for tool execution' })
  })

  app.all(['/api/files/read', '/api/files/write', '/api/files/list', '/api/files/stat'], (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Global file endpoints are disabled; use session workspace routes instead' })
  })

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      apiKeySet: !!process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic',
    })
  })

  // Create Vite server in middleware mode and attach to app
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    root: join(__dirname),
  })
  app.use(vite.middlewares)

  return { app, sessionManager }
}

async function startServer() {
  const PORT = Number(process.env.PORT || 8080)
  const { app } = await createWebApp(process.cwd())

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Web UI: http://localhost:${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
    console.log(`Health: http://localhost:${PORT}/api/health`)
  })
}

if (import.meta.main) {
  startServer().catch(console.error)
}
