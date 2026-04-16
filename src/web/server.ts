import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createServer as createViteServer } from 'vite'
import { SessionManager, type StreamEvent } from './engine/index.js'
import { readFile, writeFile, stat, readdir } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function startServer() {
  const app = express()
  const PORT = 8080

  app.use(cors())
  app.use(express.json())

  // Initialize SessionManager
  const sessionManager = new SessionManager(process.cwd())
  await sessionManager.initialize()

  let activeQueryController: AbortController | null = null

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
    const fullPath = join(session.workspacePath, String(filePath))
    if (!fullPath.startsWith(session.workspacePath)) {
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
    const fullPath = join(session.workspacePath, String(filePath))
    if (!fullPath.startsWith(session.workspacePath)) {
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

    try {
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

  // File operations for workspace
  app.get('/api/files/read', async (req: Request, res: Response) => {
    const { path: filePath } = req.query
    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'path is required' })
      return
    }
    try {
      const ext = filePath.toLowerCase().split('.').pop()
      const isBinary = ['docx', 'xlsx', 'doc', 'xls', 'pdf', 'png', 'jpg', 'jpeg', 'gif'].includes(ext || '')

      if (isBinary) {
        // Read binary files as base64
        const buffer = await readFile(filePath)
        const base64 = buffer.toString('base64')
        res.json({ content: base64, encoding: 'base64', isBinary: true })
      } else {
        // Text files as utf-8
        const content = await readFile(filePath, 'utf-8')
        res.json({ content, encoding: 'utf-8', isBinary: false })
      }
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'File not found' })
    }
  })

  app.post('/api/files/write', async (req: Request, res: Response) => {
    const { path: filePath, content } = req.body
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'path and content are required' })
      return
    }
    try {
      await writeFile(filePath, content, 'utf-8')
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to write file' })
    }
  })

  app.get('/api/files/list', async (req: Request, res: Response) => {
    const { path: dirPath } = req.query
    const cwd = process.cwd()
    const targetPath = dirPath && typeof dirPath === 'string' ? dirPath : cwd
    try {
      const entries = await readdir(targetPath, { withFileTypes: true })
      const files = entries.map(entry => ({
        name: entry.name,
        path: join(targetPath, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      res.json(files)
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Directory not found' })
    }
  })

  app.get('/api/files/stat', async (req: Request, res: Response) => {
    const { path: filePath } = req.query
    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'path is required' })
      return
    }
    try {
      const stats = await stat(filePath)
      res.json({
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        mtime: stats.mtime,
      })
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'File not found' })
    }
  })

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      apiKeySet: !!process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic',
    })
  })

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    root: join(__dirname),
  })

  // Use Vite's middleware for all other requests (frontend)
  app.use(vite.middlewares)

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Web UI: http://localhost:${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
    console.log(`Health: http://localhost:${PORT}/api/health`)
  })
}

startServer().catch(console.error)
