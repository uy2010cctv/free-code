import { writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'
import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

export class WebWriteFileTool extends BaseTool {
  name = 'write_file'
  description = 'Write content to a file. Creates the file if it does not exist.'
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to write',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['path', 'content'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { path, content } = args

    try {
      const fullPath = resolve(context.cwd, path)

      // Ensure directory exists
      const dir = dirname(fullPath)
      await mkdir(dir, { recursive: true })

      await writeFile(fullPath, content, 'utf-8')

      return this.success(`File written successfully: ${path}`)
    } catch (error: any) {
      if (error.code === 'EACCES') {
        return this.failure(`Permission denied: ${path}`)
      }
      return this.failure(error.message || String(error))
    }
  }
}
