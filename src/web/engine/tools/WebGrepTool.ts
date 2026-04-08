import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

export class WebGrepTool extends BaseTool {
  name = 'grep'
  description = 'Search for text patterns in files.'
  inputSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The text pattern to search for',
      },
      path: {
        type: 'string',
        description: 'The file or directory path to search in',
      },
      recursive: {
        type: 'boolean',
        description: 'Search recursively in directories',
        default: true,
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case sensitive search',
        default: false,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results',
        default: 100,
      },
    },
    required: ['pattern', 'path'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { pattern, path, recursive = true, caseSensitive = false, maxResults = 100 } = args

    try {
      const fullPath = resolve(context.cwd, path)
      const results = await this.search(fullPath, pattern, recursive, caseSensitive, maxResults)

      if (results.length === 0) {
        return this.success('(no matches found)')
      }

      return this.success(results.join('\n'))
    } catch (error: any) {
      return this.failure(error.message || String(error))
    }
  }

  private async search(
    path: string,
    pattern: string,
    recursive: boolean,
    caseSensitive: boolean,
    maxResults: number
  ): Promise<string[]> {
    const results: string[] = []
    const { readdir, stat } = await import('fs/promises')
    const { resolve } = await import('path')

    try {
      const stats = await stat(path)

      if (stats.isFile()) {
        return await this.searchFile(path, pattern, caseSensitive, maxResults)
      }

      if (stats.isDirectory() && recursive) {
        const entries = await readdir(path, { withFileTypes: true })

        for (const entry of entries) {
          if (results.length >= maxResults) break

          const fullPath = resolve(path, entry.name)

          if (entry.isDirectory()) {
            const dirResults = await this.search(fullPath, pattern, recursive, caseSensitive, maxResults - results.length)
            results.push(...dirResults)
          } else if (entry.isFile()) {
            const fileResults = await this.searchFile(fullPath, pattern, caseSensitive, maxResults - results.length)
            results.push(...fileResults)
          }
        }
      }
    } catch (error: any) {
      // Ignore permission errors
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        throw error
      }
    }

    return results
  }

  private async searchFile(
    filePath: string,
    pattern: string,
    caseSensitive: boolean,
    maxResults: number
  ): Promise<string[]> {
    const results: string[] = []

    try {
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')

      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        if (regex.test(lines[i])) {
          results.push(`${filePath}:${i + 1}:${lines[i]}`)
        }
        regex.lastIndex = 0 // Reset regex state
      }
    } catch (error: any) {
      // Ignore read errors
    }

    return results
  }
}
