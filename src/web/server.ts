import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createServer as createViteServer } from 'vite'
import { SessionManager, type StreamEvent } from './engine/index.js'

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

  // Query (SSE streaming)
  app.post('/api/sessions/:id/query', async (req: Request, res: Response) => {
    const { id } = req.params
    const { message } = req.body

    if (!message) {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    const engine = sessionManager.getEngine(id)
    if (!engine) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    activeQueryController = new AbortController()

    const context = {
      cwd: process.cwd(),
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
