import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createServer as createViteServer } from 'vite'
import Anthropic from '@anthropic-ai/sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function startServer() {
  const app = express()
  const PORT = 8080

  app.use(cors())
  app.use(express.json())

  // Initialize Anthropic client with MiniMax endpoint
  const anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  interface Message {
    id: string
    type: 'user' | 'assistant' | 'system' | 'tool_use'
    content: string
    timestamp: number
    toolName?: string
  }

  interface SessionData {
    id: string
    title: string
    createdAt: number
    lastActivityAt: number
    messages: Message[]
  }

  const sessions = new Map<string, SessionData>()
  let activeQueryController: AbortController | null = null

  function generateId(): string {
    return crypto.randomUUID()
  }

  // API Routes
  app.post('/api/sessions', (req: Request, res: Response) => {
    const id = generateId()
    const session: SessionData = {
      id,
      title: 'New Session',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      messages: [],
    }
    sessions.set(id, session)
    res.json({ id, title: session.title, createdAt: session.createdAt, lastActivityAt: session.lastActivityAt })
  })

  app.get('/api/sessions', (req: Request, res: Response) => {
    const sessionList = Array.from(sessions.values()).map(s => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }))
    res.json(sessionList)
  })

  app.delete('/api/sessions/:id', (req: Request, res: Response) => {
    const { id } = req.params
    if (sessions.delete(id)) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'Session not found' })
    }
  })

  app.get('/api/sessions/:id/messages', (req: Request, res: Response) => {
    const { id } = req.params
    const session = sessions.get(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    res.json(session.messages)
  })

  app.post('/api/sessions/:id/query', async (req: Request, res: Response) => {
    const { id } = req.params
    const { message } = req.body

    if (!message) {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    const session = sessions.get(id)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: message,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)
    res.write(`data: ${JSON.stringify(userMessage)}\n\n`)

    const assistantMessageId = generateId()

    try {
      activeQueryController = new AbortController()

      // Convert session messages to Anthropic format
      const historyMessages = session.messages.slice(0, -1).map(msg => ({
        role: msg.type as 'user' | 'assistant',
        content: msg.content,
      }))

      // Create streaming response
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 4096,
        system: 'You are a helpful AI coding assistant. You have access to tools for reading and writing files, running shell commands, and searching the web. When using tools, describe what you are doing in your response.',
        messages: [
          ...historyMessages,
          { role: 'user', content: message }
        ],
      }, {
        signal: activeQueryController.signal,
      })

      let assistantContent = ''

      for await (const event of stream) {
        if (activeQueryController?.signal.aborted) {
          break
        }

        if (event.type === 'message_start') {
          // Message started
        } else if (event.type === 'content_block_start') {
          // Content block started
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            assistantContent += event.delta.text
            res.write(`data: ${JSON.stringify({
              type: 'assistant',
              id: assistantMessageId,
              content: assistantContent,
            })}\n\n`)
          }
        } else if (event.type === 'message_delta') {
          // Message completed
        } else if (event.type === 'message_stop') {
          // Stream ended
        }
      }

      const finalAssistantMessage: Message = {
        id: assistantMessageId,
        type: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      }
      session.messages.push(finalAssistantMessage)

      if (assistantContent.length > 30) {
        session.title = assistantContent.slice(0, 30).replace(/\n/g, ' ') + '...'
      }
      session.lastActivityAt = Date.now()

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
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

  app.delete('/api/query/cancel', (req: Request, res: Response) => {
    if (activeQueryController) {
      activeQueryController.abort()
      res.json({ success: true })
    } else {
      res.json({ success: false, message: 'No active query' })
    }
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
  })
}

startServer().catch(console.error)
