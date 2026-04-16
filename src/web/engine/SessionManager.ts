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
import { WebSkillTool } from './tools/WebSkillTool'
import { WebWordTool } from './tools/WebWordTool'
import { WebExcelTool } from './tools/WebExcelTool'
import type { Command } from '../../../types/command'
import { getSkillDirCommands } from '../../skills/loadSkillsDir.ts'
import { getBundledSkills } from '../../skills/bundledSkills.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface SessionData {
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

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map()
  private engines: Map<string, WebQueryEngine> = new Map()
  private sessionsPath: string
  private cwd: string
  private skills: Map<string, Command> = new Map()

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
    this.sessionsPath = resolve(cwd, '.free-code-sessions')
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.sessionsPath, { recursive: true })
      await this.loadSessions()
      await this.loadSkills()
    } catch (error) {
      console.error('Failed to initialize session manager:', error)
    }
  }

  private async loadSkills(): Promise<void> {
    try {
      // Load bundled skills
      const bundled = await getBundledSkills()
      for (const cmd of bundled) {
        if (cmd.type === 'prompt' && cmd.name) {
          this.skills.set(cmd.name, cmd)
        }
      }

      // Load skills from disk
      const skillDirCmds = await getSkillDirCommands(this.cwd)
      for (const cmd of skillDirCmds) {
        if (cmd.type === 'prompt' && cmd.name) {
          this.skills.set(cmd.name, cmd)
        }
      }

      console.log(`Loaded ${this.skills.size} skills`)
    } catch (error) {
      console.error('Failed to load skills:', error)
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
      workspacePath: resolve(this.cwd, 'workspace', id),
      selectedConnectorIds: [],
      selectedModuleIds: [],
      lastReportId: undefined,
    }
    this.sessions.set(id, session)

    // Create workspace folder for this session
    mkdir(resolve(this.cwd, 'workspace', id), { recursive: true }).catch(console.error)

    // Create engine for this session
    const engine = this.createEngine(id)
    this.engines.set(id, engine)

    // Save to disk
    this.saveSession(id).catch(console.error)

    return this.toSession(session)
  }

  private createEngine(sessionId: string): WebQueryEngine {
    // Get API key from settings or environment
    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    const baseURL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic'

    // Get workspace path for this session
    const session = this.sessions.get(sessionId)
    const workspacePath = session?.workspacePath || ''

    const engine = new WebQueryEngine({
      apiKey,
      baseURL,
      sessionId,
      workspacePath,
      systemPrompt: `You are a helpful AI coding assistant.
You have access to tools for file operations, running shell commands, and web requests.
You can also create and edit Word (.docx) and Excel (.xlsx) documents.
For Word documents, use the 'word' tool with actions: create, append, replace, read, table.
For Excel documents, use the 'excel' tool with actions: create, read, write, addSheet, formula, style, resize, merge.
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
      new WebSkillTool(this.skills, this.cwd),
      new WebWordTool(),
      new WebExcelTool(),
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

  setEnterpriseSessionState(
    sessionId: string,
    state: {
      selectedConnectorIds?: string[]
      selectedModuleIds?: string[]
      lastReportId?: string
    }
  ): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      if (state.selectedConnectorIds !== undefined) {
        session.selectedConnectorIds = state.selectedConnectorIds
      }
      if (state.selectedModuleIds !== undefined) {
        session.selectedModuleIds = state.selectedModuleIds
      }
      if (state.lastReportId !== undefined) {
        session.lastReportId = state.lastReportId
      }
      session.lastActivityAt = Date.now()
      this.saveSession(sessionId).catch(console.error)
    }
  }

  getEnterpriseSessionState(sessionId: string): {
    selectedConnectorIds: string[]
    selectedModuleIds: string[]
    lastReportId?: string
  } | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    return {
      selectedConnectorIds: session.selectedConnectorIds,
      selectedModuleIds: session.selectedModuleIds,
      lastReportId: session.lastReportId,
    }
  }

  rewindConversationTo(sessionId: string, messageId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    const index = session.messages.findIndex(m => m.id === messageId)
    if (index === -1) return false
    session.messages = session.messages.slice(0, index)
    session.lastActivityAt = Date.now()
    this.saveSession(sessionId).catch(console.error)
    return true
  }

  getSelectableMessagesForRewind(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId)
    if (!session) return []
    return session.messages.filter(msg => {
      if (msg.type !== 'user' && msg.role !== 'user') return false
      const content = typeof msg.content === 'string' ? msg.content : ''
      if (content.includes('<tool_result>')) return false
      if (msg.isMeta || msg.isSynthetic || msg.isCompactSummary) return false
      if (content.includes('<local_command_stdout>') || content.includes('<local_command_stderr>') ||
          content.includes('<bash_stdout>') || content.includes('<bash_stderr>') ||
          content.includes('<task_notification>') || content.includes('<tick>')) return false
      return true
    })
  }

  getSkills(): Command[] {
    return Array.from(this.skills.values())
  }

  findSkill(skillName: string): Command | undefined {
    return this.skills.get(skillName)
  }

  async executeSkill(skillName: string, args: string = ''): Promise<{ success: boolean; output?: string; error?: string }> {
    const command = this.skills.get(skillName)
    if (!command || command.type !== 'prompt') {
      return { success: false, error: `Skill '${skillName}' not found` }
    }

    try {
      const toolUseContext = {
        abortController: new AbortController(),
        messages: [],
        options: {
          commands: [],
          debug: false,
          mainLoopModel: '',
          tools: {},
          verbose: false,
          thinkingConfig: { type: 'off' },
          mcpClients: [],
          mcpResources: {},
          isNonInteractiveSession: false,
          agentDefinitions: { agents: [] },
        },
        readFileState: {
          has: () => false,
          get: () => undefined,
          set: () => {},
        },
        getAppState: () => ({
          toolPermissionContext: {
            mode: 'acceptEdits' as const,
            alwaysAllowRules: { command: [] },
          },
          fileHistory: { canRestore: false },
        }),
        setAppState: () => {},
        setInProgressToolUseIDs: () => {},
        setResponseLength: () => {},
        updateFileHistoryState: () => {},
        updateAttributionState: () => {},
        nestedMemoryAttachmentTriggers: new Set(),
        loadedNestedMemoryPaths: new Set(),
        dynamicSkillDirTriggers: new Set(),
        discoveredSkillNames: new Set(),
        userModified: false,
      }

      const result = await command.getPromptForCommand(args, toolUseContext as any)
      const text = result
        .filter((r): r is { type: 'text'; text: string } => r.type === 'text')
        .map(r => r.text)
        .join('\n')

      return { success: true, output: text }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  }

  private toSession(data: SessionData): Session {
    return {
      id: data.id,
      title: data.title,
      createdAt: data.createdAt,
      lastActivityAt: data.lastActivityAt,
      messages: data.messages,
      workspacePath: data.workspacePath,
      selectedConnectorIds: data.selectedConnectorIds,
      selectedModuleIds: data.selectedModuleIds,
      lastReportId: data.lastReportId,
    }
  }
}
