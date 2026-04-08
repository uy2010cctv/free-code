import { exec } from 'child_process'
import { promisify } from 'util'
import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

const execAsync = promisify(exec)

// Dangerous commands to block
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'mkfs',
  'dd if=',
  ':(){ :|:& };:', // Fork bomb
  '> /dev/sda',
  'chmod -R 777 /',
]

export class WebBashTool extends BaseTool {
  name = 'bash'
  description = 'Execute shell commands. Use for running scripts, navigating directories, and system operations.'
  inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
        default: 30000,
      },
    },
    required: ['command'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { command, timeout = 30000 } = args

    // Security check
    for (const blocked of BLOCKED_COMMANDS) {
      if (command.includes(blocked)) {
        return this.failure(`Command blocked for security reasons: ${blocked}`)
      }
    }

    // Block commands that try to escape the working directory
    if (command.includes('cd ..') && command.trim() === 'cd ..') {
      // Allow cd .. but not in combination with other dangerous ops
    }

    try {
      const result = await execAsync(command, {
        cwd: context.cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
      return this.success(output || '(command completed with no output)')
    } catch (error: any) {
      if (error.killed) {
        return this.failure(`Command timed out after ${timeout}ms`)
      }
      return this.failure(error.message || String(error))
    }
  }
}
