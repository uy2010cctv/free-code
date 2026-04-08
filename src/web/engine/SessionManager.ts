import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Session, Message } from './types'
import { WebQueryEngine } from './WebQueryEngine'
import { WebBashTool } from './tools/WebBashTool'
import { WebReadFileTool } from './tools/WebReadFileTool'
import { WebWriteFileTool } from './tools/WebWriteFileTool'
import { WebGlobTool } from './tools/WebGlobTool'
import { WebGrepTool } from './tools/WebGrepTool'
import { WebFetchTool } from './tools/WebFetchTool'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface SessionData {
  id: string
  title: string
  createdAt: number
  lastActivityAt: number
  messages: Message[]
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map()
  private engines: Map<string, WebQueryEngine> = new Map()
  private sessionsPath: string
  private cwd: string

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
    this.sessionsPath = resolve(cwd, '.free-code-sessions')
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.sessionsPath, { recursive: true })
      await this.loadSessions()
    } catch (error) {
      console.error('Failed to initialize session manager:', error)
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      const indexPath = resolve(this.sessionsPath, 'index.json')
      const data = await readFile(indexPath, 'utf-8')
      const sessions: SessionData[] = JSON.parse(data)

      for (const session of sessions) {
        this.sessions.set(session.id, session)
      }
    } catch (error) {
      // No sessions file yet, that's ok
    }
  }

  private async saveSessions(): Promise<void> {
    try {
      const sessions = Array.from(this.sessions.values())
      const indexPath = resolve(this.sessionsPath, 'index.json')
      await writeFile(indexPath, JSON.stringify(sessions, null, 2))
    } catch (error) {
      console.error('Failed to save sessions:', error)
    }
  }

  private async saveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      const sessionPath = resolve(this.sessionsPath, `${sessionId}.json`)
      await writeFile(sessionPath, JSON.stringify(session, null, 2))
      await this.saveSessions()
    }
  }

  createSession(): Session {
    const id = crypto.randomUUID()
    const session: SessionData = {
      id,
      title: 'New Session',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      messages: [],
    }
    this.sessions.set(id, session)

    // Create engine for this session
    const engine = this.createEngine()
    this.engines.set(id, engine)

    // Save to disk
    this.saveSession(id).catch(console.error)

    return this.toSession(session)
  }

  private createEngine(): WebQueryEngine {
    // Get API key from settings or environment
    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    const baseURL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic'

    const engine = new WebQueryEngine({
      apiKey,
      baseURL,
      systemPrompt: `You are a helpful AI coding assistant.
You have access to tools for file operations, running shell commands, and web requests.
When using tools, describe what you're doing in your response.
Always be concise and helpful.`,
    })

    // Register tools
    engine.registerTools([
      new WebBashTool(),
      new WebReadFileTool(),
      new WebWriteFileTool(),
      new WebGlobTool(),
      new WebGrepTool(),
      new WebFetchTool(),
    ])

    return engine
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId)
    return session ? this.toSession(session) : undefined
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map(s => this.toSession(s))
  }

  getEngine(sessionId: string): WebQueryEngine | undefined {
    return this.engines.get(sessionId)
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId)
    this.engines.delete(sessionId)

    if (deleted) {
      // Remove from disk
      const sessionPath = resolve(this.sessionsPath, `${sessionId}.json`)
      import('fs').then(fs => fs.promises.unlink(sessionPath).catch(() => {}))
      this.saveSessions().catch(console.error)
    }

    return deleted
  }

  updateSessionTitle(sessionId: string, title: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.title = title
      session.lastActivityAt = Date.now()
      this.saveSession(sessionId).catch(console.error)
    }
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.messages.push(message)
      session.lastActivityAt = Date.now()
      this.saveSession(sessionId).catch(console.error)
    }
  }

  private toSession(data: SessionData): Session {
    return {
      id: data.id,
      title: data.title,
      createdAt: data.createdAt,
      lastActivityAt: data.lastActivityAt,
      messages: data.messages,
    }
  }
}
