import { readFile, stat } from 'fs/promises'
import { resolve } from 'path'
import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

export class WebReadFileTool extends BaseTool {
  name = 'read_file'
  description = 'Read the contents of a file from the filesystem.'
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to read',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read (for large files)',
      },
      offset: {
        type: 'number',
        description: 'Line offset to start reading from',
      },
    },
    required: ['path'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { path, limit, offset = 0 } = args

    try {
      const fullPath = resolve(context.cwd, path)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
        return this.failure(`Path is a directory, not a file: ${path}`)
      }

      let content = await readFile(fullPath, 'utf-8')

      // Handle offset and limit
      const lines = content.split('\n')
      if (offset > 0 || limit) {
        const end = limit ? offset + limit : lines.length
        content = lines.slice(offset, end).join('\n')
        if (offset > 0) {
          content = `[Lines ${offset + 1} to ${Math.min(end, lines.length)} of ${lines.length}]\n\n${content}`
        }
        if (limit && end < lines.length) {
          content += `\n\n[... ${lines.length - end} more lines]`
        }
      }

      if (content.length > 100000) {
        content = content.slice(0, 100000) + '\n\n[... file truncated]'
      }

      return this.success(content)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.failure(`File not found: ${path}`)
      }
      if (error.code === 'EACCES') {
        return this.failure(`Permission denied: ${path}`)
      }
      return this.failure(error.message || String(error))
    }
  }
}
