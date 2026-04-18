import { readFile, writeFile, mkdir, rename } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
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
import { ConnectorRegistry } from './connectors/ConnectorRegistry'
import { DEFAULT_CONNECTORS } from './connectors/defaultConnectors'
import { ModuleRegistry } from './modules/ModuleRegistry'
import { DEFAULT_MODULES } from './modules/defaultModules'
import { ReportService } from './reporting/ReportService'
import type { Command } from '../../types/command'
import { getSkillDirCommands } from '../../skills/loadSkillsDir.ts'
import { getBundledSkills } from '../../skills/bundledSkills.ts'
import type {
  BusinessModule,
  DataSourceConnector,
  EnterpriseRuntimeContext,
  EnterpriseRuntimeSnapshot,
  ReportPlan,
  Session,
  Message,
} from './types'

const __filename = fileURLToPath(import.meta.url)
void __filename
void dirname

interface SessionData {
  id: Session['id']
  title: Session['title']
  createdAt: Session['createdAt']
  lastActivityAt: Session['lastActivityAt']
  messages: Session['messages']
  workspacePath: Session['workspacePath']
  selectedConnectorIds: Session['selectedConnectorIds']
  selectedModuleIds: Session['selectedModuleIds']
  lastReportId?: Session['lastReportId']
  lastGeneratedOutputs: Session['lastGeneratedOutputs']
}

interface EnterpriseData {
  connectors: DataSourceConnector[]
  modules: BusinessModule[]
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map()
  private engines: Map<string, WebQueryEngine> = new Map()
  private sessionsPath: string
  private enterprisePath: string
  private enterpriseDataPath: string
  private cwd: string
  private skills: Map<string, Command> = new Map()
  private connectorRegistry = new ConnectorRegistry()
  private moduleRegistry = new ModuleRegistry()
  private reportService = new ReportService()

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
    this.sessionsPath = resolve(cwd, '.free-code-sessions')
    this.enterprisePath = resolve(cwd, '.free-code-enterprise')
    this.enterpriseDataPath = resolve(this.enterprisePath, 'enterprise-data.json')
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.sessionsPath, { recursive: true })
      await mkdir(this.enterprisePath, { recursive: true })
      await this.loadSessions()
      await this.loadSkills()
      await this.loadEnterpriseData()
      this.ensureSessionEngines()
    } catch (error) {
      console.error('Failed to initialize session manager:', error)
    }
  }

  private ensureSessionEngines(): void {
    for (const session of this.sessions.values()) {
      if (!this.engines.has(session.id)) {
        this.engines.set(session.id, this.createEngine(session.id))
      }
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
        this.sessions.set(session.id, this.normalizeSessionData(session))
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

  private async loadEnterpriseData(): Promise<void> {
    try {
      const raw = await readFile(this.enterpriseDataPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<EnterpriseData>
      await this.connectorRegistry.load(Array.isArray(parsed.connectors) ? parsed.connectors : DEFAULT_CONNECTORS)
      await this.moduleRegistry.load(Array.isArray(parsed.modules) ? parsed.modules : DEFAULT_MODULES)
    } catch (error: any) {
      if (error?.code && error.code !== 'ENOENT') {
        console.error('Failed to read persisted enterprise data, preserving on-disk file:', error)
        await this.connectorRegistry.load(DEFAULT_CONNECTORS)
        await this.moduleRegistry.load(DEFAULT_MODULES)
        return
      }
      await this.connectorRegistry.load(DEFAULT_CONNECTORS)
      await this.moduleRegistry.load(DEFAULT_MODULES)
      await this.saveEnterpriseData()
    }
  }

  private async saveEnterpriseData(): Promise<void> {
    const data: EnterpriseData = {
      connectors: this.connectorRegistry.getAll(),
      modules: this.moduleRegistry.getAll(),
    }
    const tempPath = `${this.enterpriseDataPath}.tmp`
    await writeFile(tempPath, JSON.stringify(data, null, 2))
    await rename(tempPath, this.enterpriseDataPath)
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
      lastGeneratedOutputs: [],
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

  setEnterpriseSessionState(sessionId: string, state: Partial<EnterpriseRuntimeSnapshot>): void {
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
      if (state.lastGeneratedOutputs !== undefined) {
        session.lastGeneratedOutputs = state.lastGeneratedOutputs
      }
      session.lastActivityAt = Date.now()
      this.saveSession(sessionId).catch(console.error)
    }
  }

  getEnterpriseSessionState(sessionId: string): EnterpriseRuntimeSnapshot | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    return {
      selectedConnectorIds: session.selectedConnectorIds,
      selectedModuleIds: session.selectedModuleIds,
      lastReportId: session.lastReportId,
      lastGeneratedOutputs: session.lastGeneratedOutputs ?? [],
    }
  }

  getConnectors(): DataSourceConnector[] {
    return this.connectorRegistry.getAll()
  }

  async registerConnector(connector: DataSourceConnector): Promise<void> {
    this.connectorRegistry.register(connector)
    await this.saveEnterpriseData()
  }

  async updateConnector(id: string, updates: Partial<DataSourceConnector>): Promise<DataSourceConnector | undefined> {
    const connector = this.connectorRegistry.update(id, updates)
    if (connector) {
      await this.saveEnterpriseData()
    }
    return connector
  }

  getModules(): BusinessModule[] {
    return this.moduleRegistry.getAll()
  }

  async refreshModules(modules: BusinessModule[]): Promise<void> {
    await this.moduleRegistry.refresh(modules)
    await this.saveEnterpriseData()
  }

  async saveModule(module: BusinessModule): Promise<BusinessModule> {
    const saved = this.moduleRegistry.upsert(module)
    await this.saveEnterpriseData()
    return saved
  }

  async refreshModule(moduleId: string): Promise<BusinessModule | undefined> {
    const refreshed = this.moduleRegistry.refreshById(moduleId)
    if (refreshed) {
      await this.saveEnterpriseData()
    }
    return refreshed
  }

  async publishModule(moduleId: string): Promise<BusinessModule | undefined> {
    const published = this.moduleRegistry.publish(moduleId)
    if (published) {
      await this.saveEnterpriseData()
    }
    return published
  }

  getEnterpriseRuntimeContext(sessionId: string): EnterpriseRuntimeContext {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { connectors: [], selectedModules: [], publishedModules: [] }
    }

    const selectedConnectorIds = Array.isArray(session.selectedConnectorIds) ? session.selectedConnectorIds : []
    const selectedModuleIds = Array.isArray(session.selectedModuleIds) ? session.selectedModuleIds : []

    return {
      connectors: this.connectorRegistry.getByIds(selectedConnectorIds),
      selectedModules: this.moduleRegistry.getByIds(selectedModuleIds),
      publishedModules: this.moduleRegistry.getPublishedByIds(selectedModuleIds),
    }
  }

  async buildReportPlan(
    sessionId: string,
    prompt: string,
    reportType = 'business-report',
  ): Promise<ReportPlan> {
    const runtime = this.getEnterpriseRuntimeContext(sessionId)
    const plan = await this.reportService.buildPlan({
      reportType,
      connectors: runtime.connectors,
      modules: runtime.publishedModules,
      prompt,
    })

    this.setEnterpriseSessionState(sessionId, {
      lastReportId: `${reportType}-${Date.now()}`,
      lastGeneratedOutputs: plan.exports,
    })

    return plan
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
    const normalized = this.normalizeSessionData(data)

    return {
      id: normalized.id,
      title: normalized.title,
      createdAt: normalized.createdAt,
      lastActivityAt: normalized.lastActivityAt,
      messages: normalized.messages,
      workspacePath: normalized.workspacePath,
      selectedConnectorIds: normalized.selectedConnectorIds,
      selectedModuleIds: normalized.selectedModuleIds,
      lastReportId: normalized.lastReportId,
      lastGeneratedOutputs: normalized.lastGeneratedOutputs,
    }
  }

  private normalizeSessionData(data: Partial<SessionData> & Pick<SessionData, 'id' | 'title' | 'createdAt' | 'lastActivityAt' | 'messages' | 'workspacePath'>): SessionData {
    return {
      id: data.id,
      title: data.title,
      createdAt: data.createdAt,
      lastActivityAt: data.lastActivityAt,
      messages: data.messages,
      workspacePath: data.workspacePath,
      selectedConnectorIds: Array.isArray(data.selectedConnectorIds) ? data.selectedConnectorIds : [],
      selectedModuleIds: Array.isArray(data.selectedModuleIds) ? data.selectedModuleIds : [],
      lastReportId: data.lastReportId,
      lastGeneratedOutputs: Array.isArray(data.lastGeneratedOutputs) ? data.lastGeneratedOutputs : [],
    }
  }
}
