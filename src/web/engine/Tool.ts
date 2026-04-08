import type { Tool, ToolContext, ToolResult } from './types'

export abstract class BaseTool implements Tool {
  abstract name: string
  abstract description: string
  abstract inputSchema: Record<string, any>

  abstract execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult>

  protected success(output: string): ToolResult {
    return { success: true, output }
  }

  protected failure(error: string): ToolResult {
    return { success: false, error }
  }
}
