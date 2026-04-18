import Anthropic from '@anthropic-ai/sdk'
import type { Message, StreamEvent, ToolContext } from './types'
import type { Tool } from './types'

type AnthropicClient = {
  messages: {
    create(params: Record<string, any>): Promise<{
      content: Array<Record<string, any>>
    }>
  }
}

type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string | Array<Record<string, any>>
}

export class WebQueryEngine {
  private anthropic: AnthropicClient
  private messages: Message[] = []
  private history: HistoryMessage[] = []
  private tools: Map<string, Tool> = new Map()
  private systemPrompt: string
  private baseSystemPrompt: string
  private model: string
  private maxTokens: number
  private sessionId: string
  private runtimeSource = 'runtime-v2'

  constructor(config: {
    apiKey: string
    baseURL: string
    model?: string
    systemPrompt?: string
    maxTokens?: number
    sessionId?: string
    workspacePath?: string
    anthropicClient?: AnthropicClient
  }) {
    this.anthropic = config.anthropicClient || new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
    this.sessionId = config.sessionId || crypto.randomUUID()
    this.model = config.model || 'claude-sonnet-4-6-20250514'
    this.maxTokens = config.maxTokens || 4096

    const workspacePath = config.workspacePath || ''
    const workspaceRestriction = workspacePath
      ? `\n\nCRITICAL SECURITY RESTRICTION: You can ONLY read, write, edit, and access files within your dedicated session workspace folder: "${workspacePath}"
All file operations (bash, read_file, write_file, glob, grep) MUST target files inside this folder. Never attempt to access files outside this folder. This is enforced for security.`
      : ''

    this.baseSystemPrompt = config.systemPrompt || `You are a helpful AI coding assistant with access to tools.
You have access to the following tools:
- bash: Run shell commands (always use for listing files, running scripts, etc.)
- read_file: Read file contents
- write_file: Write content to files
- glob: Find files matching a pattern
- grep: Search for text in files
- web_fetch: Fetch content from URLs
- word: Create and edit Microsoft Word documents (.docx)

IMPORTANT: When the user asks you to perform tasks that require tools (like listing files, running commands, reading/writing files), you MUST use the appropriate tool. Do not just describe what you would do - actually use the tool.${workspaceRestriction}
Always be concise and helpful.`
    this.systemPrompt = this.baseSystemPrompt
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool)
    }
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  clearHistory(): void {
    this.messages = []
    this.history = []
  }

  getSessionId(): string {
    return this.sessionId
  }

  setRuntimeContext(input: {
    connectorSummaries: string[]
    moduleSummaries: string[]
  }): void {
    const connectors = input.connectorSummaries.length > 0
      ? `Active enterprise connectors:\n- ${input.connectorSummaries.join('\n- ')}`
      : 'Active enterprise connectors: none.'
    const modules = input.moduleSummaries.length > 0
      ? `Active enterprise modules:\n- ${input.moduleSummaries.join('\n- ')}`
      : 'Active enterprise modules: none.'

    this.systemPrompt = `${this.baseSystemPrompt}\n\n${connectors}\n${modules}\nWhen planning reports or calculations, cite the relevant connector or module for important outputs, align to published module templates, and avoid inventing unsupported enterprise capabilities.`
  }

  async *submitMessage(
    userMessage: string,
    context: ToolContext
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }
    this.messages.push(userMsg)
    this.history.push({
      role: 'user',
      content: userMessage,
    })

    yield {
      type: 'user',
      id: userMsg.id,
      content: userMessage,
      timestamp: userMsg.timestamp,
      source: this.runtimeSource,
    }

    try {
      const MAX_TOOL_CALLS = 5

      for (let toolCallCount = 0; toolCallCount < MAX_TOOL_CALLS; toolCallCount++) {
        const toolDefinitions = this.getToolDefinitions()
        const params: Record<string, any> = {
          model: this.model,
          max_tokens: this.maxTokens,
          system: this.systemPrompt,
          messages: this.history,
        }

        if (toolDefinitions.length > 0) {
          params.tools = toolDefinitions
          const forcedToolName = this.inferForcedToolName(userMessage)
          if (forcedToolName) {
            params.tool_choice = { type: 'tool', name: forcedToolName }
          }
        }

        yield {
          type: 'state_update',
          phase: 'model_request',
          detail: `Requesting model response (cycle ${toolCallCount + 1})`,
          timestamp: Date.now(),
          source: this.runtimeSource,
        }

        const response = await this.anthropic.messages.create(params)

        let hasToolUse = false
        let textResponse = ''
        const assistantBlocks: Array<Record<string, any>> = []
        const toolResults: Array<Record<string, any>> = []

        for (const content of response.content) {
          if (content.type === 'text') {
            textResponse += content.text || ''
            assistantBlocks.push({
              type: 'text',
              text: content.text || '',
            })
            continue
          }

          if (content.type !== 'tool_use') {
            continue
          }

          hasToolUse = true
          const toolId = content.id || crypto.randomUUID()
          const toolName = content.name
          const toolInput = content.input || {}

          assistantBlocks.push({
            type: 'tool_use',
            id: toolId,
            name: toolName,
            input: toolInput,
          })

          yield {
            type: 'tool_start',
            id: toolId,
            toolName,
            input: toolInput,
            timestamp: Date.now(),
            source: this.runtimeSource,
          }

          const tool = this.tools.get(toolName)
          if (!tool) {
            const error = `Tool '${toolName}' not found`
            toolResults.push(this.createToolResultBlock(toolId, error, true))
            yield {
              type: 'tool_error',
              id: toolId,
              toolName,
              error,
              timestamp: Date.now(),
              source: this.runtimeSource,
            }
            yield {
              type: 'tool_result',
              id: toolId,
              toolName,
              result: { success: false, error },
              timestamp: Date.now(),
              source: this.runtimeSource,
            }
            continue
          }

          try {
            const result = await tool.execute(toolInput, context)
            toolResults.push(this.createToolResultBlock(
              toolId,
              typeof result.output === 'string' ? result.output : JSON.stringify(result.output ?? ''),
              !result.success,
            ))
            yield {
              type: 'tool_result',
              id: toolId,
              toolName,
              result,
              timestamp: Date.now(),
              source: this.runtimeSource,
            }
          } catch (toolError: any) {
            const error = toolError?.message || 'Tool execution failed'
            toolResults.push(this.createToolResultBlock(toolId, error, true))
            yield {
              type: 'tool_error',
              id: toolId,
              toolName,
              error,
              timestamp: Date.now(),
              source: this.runtimeSource,
            }
            yield {
              type: 'tool_result',
              id: toolId,
              toolName,
              result: { success: false, error },
              timestamp: Date.now(),
              source: this.runtimeSource,
            }
          }
        }

        if (assistantBlocks.length > 0) {
          this.history.push({
            role: 'assistant',
            content: assistantBlocks,
          })
        }

        if (hasToolUse) {
          this.history.push({
            role: 'user',
            content: toolResults,
          })
          yield {
            type: 'state_update',
            phase: 'tool_cycle_complete',
            detail: `Completed ${toolResults.length} tool result(s)`,
            timestamp: Date.now(),
            source: this.runtimeSource,
          }
          continue
        }

        if (textResponse) {
          const assistantId = crypto.randomUUID()
          const assistantMessage: Message = {
            id: assistantId,
            role: 'assistant',
            content: textResponse,
            timestamp: Date.now(),
          }
          this.messages.push(assistantMessage)
          yield {
            type: 'assistant',
            id: assistantId,
            content: textResponse,
            timestamp: assistantMessage.timestamp,
            source: this.runtimeSource,
          }
        }

        yield {
          type: 'state_update',
          phase: 'response_complete',
          detail: 'Completed assistant response without further tool calls',
          timestamp: Date.now(),
          source: this.runtimeSource,
        }
        yield { type: 'done', source: this.runtimeSource }
        return
      }

      yield {
        type: 'error',
        error: 'Max tool call iterations reached',
        source: this.runtimeSource,
      }
      yield { type: 'done', source: this.runtimeSource }
    } catch (error: any) {
      yield { type: 'error', error: error.message, source: this.runtimeSource }
    }
  }

  private getToolDefinitions() {
    const tools: any[] = []
    for (const [, tool] of this.tools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })
    }
    return tools
  }

  private inferForcedToolName(userMessage: string): string | null {
    const match = /\buse the ([a-zA-Z0-9_]+) tool\b/i.exec(userMessage)
    if (!match) return null
    const toolName = match[1]
    return this.tools.has(toolName) ? toolName : null
  }

  private createToolResultBlock(toolUseId: string, content: string, isError = false) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content,
      is_error: isError,
    }
  }
}
