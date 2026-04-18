import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'
import type { Command } from '../../../types/command'

export class WebSkillTool extends BaseTool {
  name = 'skill'
  description = 'Invoke a skill (slash command) by name. Skills are specialized commands that provide domain-specific functionality.'
  inputSchema = {
    type: 'object',
    properties: {
      skillName: {
        type: 'string',
        description: 'Name of the skill to invoke (without the / prefix)',
      },
      args: {
        type: 'string',
        description: 'Arguments to pass to the skill',
        default: '',
      },
    },
    required: ['skillName'],
  }

  constructor(
    private skills: Map<string, Command>,
    private cwd: string,
  ) {
    super()
  }

  async execute(args: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const { skillName, args: skillArgs = '' } = args

    const command = this.skills.get(skillName)
    if (!command || command.type !== 'prompt') {
      // Try to find by alias
      for (const [name, cmd] of this.skills) {
        if (cmd.aliases?.includes(skillName) && cmd.type === 'prompt') {
          return this.executeSkill(cmd, skillArgs)
        }
      }
      return { success: false, error: `Skill '${skillName}' not found` }
    }

    return this.executeSkill(command, skillArgs)
  }

  private async executeSkill(command: Command, skillArgs: string): Promise<ToolResult> {
    if (command.type !== 'prompt') {
      return { success: false, error: 'Not a prompt command' }
    }

    try {
      // Build minimal toolUseContext
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

      const result = await command.getPromptForCommand(skillArgs, toolUseContext)
      const text = result
        .filter((r): r is { type: 'text'; text: string } => r.type === 'text')
        .map(r => r.text)
        .join('\n')

      return { success: true, output: text }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  }
}
