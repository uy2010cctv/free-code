import Anthropic from '@anthropic-ai/sdk'
import type { Message, StreamEvent, ToolContext } from './types'
import type { Tool } from './Tool'

export class WebQueryEngine {
  private anthropic: Anthropic
  private messages: Message[] = []
  private tools: Map<string, Tool> = new Map()
  private systemPrompt: string
  private model: string
  private maxTokens: number
  private sessionId: string

  constructor(config: {
    apiKey: string
    baseURL: string
    model?: string
    systemPrompt?: string
    maxTokens?: number
    sessionId?: string
    workspacePath?: string
  }) {
    this.anthropic = new Anthropic({
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

    this.systemPrompt = config.systemPrompt || `You are a helpful AI coding assistant with access to tools.
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
  }

  getSessionId(): string {
    return this.sessionId
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

    yield {
      type: 'user',
      id: userMsg.id,
      content: userMessage,
      timestamp: userMsg.timestamp,
    }

    try {
      // Maximum tool use cycles to prevent infinite loops
      const MAX_TOOL_CALLS = 5

      for (let toolCallCount = 0; toolCallCount < MAX_TOOL_CALLS; toolCallCount++) {
        const toolDefinitions = this.getToolDefinitions()

        const params: any = {
          model: this.model,
          max_tokens: this.maxTokens,
          system: this.systemPrompt,
          messages: this.formatMessages(),
        }

        if (toolDefinitions.length > 0) {
          params.tools = toolDefinitions
        }

        const response = await this.anthropic.messages.create(params)

        // Process all content blocks
        let hasToolUse = false
        let textResponse = ''

        for (const content of response.content) {
          if (content.type === 'text') {
            textResponse += content.text
          } else if (content.type === 'thinking') {
            // Skip thinking, but can include in response if no text
          } else if (content.type === 'tool_use') {
            hasToolUse = true
            const toolName = content.name
            const toolInput = content.input

            yield {
              type: 'tool_use',
              id: content.id || crypto.randomUUID(),
              toolName,
              input: toolInput,
              timestamp: Date.now(),
            }

            // Execute the tool
            const tool = this.tools.get(toolName)
            if (tool) {
              try {
                const result = await tool.execute(toolInput, context)
                yield {
                  type: 'tool_result',
                  id: content.id || crypto.randomUUID(),
                  toolName,
                  result,
                  timestamp: Date.now(),
                }

                // Add tool result to messages for next iteration
                this.messages.push({
                  id: content.id || crypto.randomUUID(),
                  role: 'tool',
                  content: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
                  toolName,
                  timestamp: Date.now(),
                })
              } catch (toolError: any) {
                yield {
                  type: 'tool_result',
                  id: content.id || crypto.randomUUID(),
                  toolName,
                  result: { error: toolError.message || 'Tool execution failed' },
                  timestamp: Date.now(),
                }
                yield { type: 'done' }
                return
              }
            } else {
              yield {
                type: 'tool_result',
                id: content.id || crypto.randomUUID(),
                toolName,
                result: { error: `Tool '${toolName}' not found` },
                timestamp: Date.now(),
              }
              yield { type: 'done' }
              return
            }
          }
        }

        // If no tool use, this is the final response
        if (!hasToolUse) {
          if (textResponse) {
            yield {
              type: 'assistant',
              id: crypto.randomUUID(),
              content: textResponse,
              timestamp: Date.now(),
            }
          }
          yield { type: 'done' }
          return
        }
        // If tool use happened, continue loop to get final response
      }

      // Max tool calls reached
      yield {
        type: 'error',
        error: 'Max tool call iterations reached',
      }
      yield { type: 'done' }

    } catch (error: any) {
      yield { type: 'error', error: error.message }
    }
  }

  private getToolDefinitions() {
    const tools: any[] = []
    for (const [name, tool] of this.tools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })
    }
    return tools
  }

  private formatMessages() {
    return this.messages.map(msg => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      content: msg.content,
    }))
  }
}
