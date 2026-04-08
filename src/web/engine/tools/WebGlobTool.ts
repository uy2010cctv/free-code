import { readdir } from 'fs/promises'
import { resolve, relative } from 'path'
import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

export class WebGlobTool extends BaseTool {
  name = 'glob'
  description = 'Find files matching a glob pattern. Use ** for recursive matching.'
  inputSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files (e.g., **/*.ts, src/**/*.js)',
      },
      cwd: {
        type: 'string',
        description: 'Working directory to search in',
      },
    },
    required: ['pattern'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { pattern, cwd } = args
    const searchCwd = cwd ? resolve(context.cwd, cwd) : context.cwd

    try {
      const results = await this.glob(searchCwd, pattern)
      if (results.length === 0) {
        return this.success('(no files matched)')
      }
      return this.success(results.join('\n'))
    } catch (error: any) {
      return this.failure(error.message || String(error))
    }
  }

  private async glob(cwd: string, pattern: string): Promise<string[]> {
    const results: string[] = []
    const parts = pattern.split('/')
    const firstPart = parts[0]

    if (parts.length === 1) {
      // Simple pattern like *.ts
      return this.matchSimple(cwd, firstPart)
    }

    if (firstPart === '**') {
      // Recursive pattern
      const rest = parts.slice(1).join('/')
      await this.globRecursive(cwd, rest, results)
    } else {
      // Directory pattern
      const matches = await this.matchSimple(cwd, firstPart)
      const subPattern = parts.slice(1).join('/')
      for (const match of matches) {
        const subResults = await this.glob(match, subPattern)
        results.push(...subResults)
      }
    }

    return results
  }

  private async matchSimple(cwd: string, pattern: string): Promise<string[]> {
    const results: string[] = []
    const entries = await readdir(cwd, { withFileTypes: true })

    const regex = this.patternToRegex(pattern)
    for (const entry of entries) {
      if (regex.test(entry.name)) {
        results.push(resolve(cwd, entry.name))
      }
    }

    return results
  }

  private async globRecursive(cwd: string, pattern: string, results: string[]): Promise<void> {
    const entries = await readdir(cwd, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = resolve(cwd, entry.name)

      if (entry.isDirectory()) {
        if (pattern === '**' || pattern.endsWith('/**')) {
          await this.globRecursive(fullPath, pattern, results)
        }
        const rest = pattern.replace(/^\*\*/, '').replace(/^\//, '')
        if (rest) {
          await this.globRecursive(fullPath, rest, results)
        } else {
          results.push(fullPath)
        }
      } else if (entry.isFile()) {
        if (pattern === '**' || pattern === '*') {
          results.push(fullPath)
        } else {
          const filePattern = pattern.replace(/^\*\*\//, '')
          const regex = this.patternToRegex(filePattern)
          if (regex.test(entry.name)) {
            results.push(fullPath)
          }
        }
      }
    }
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${escaped}$`)
  }
}
