import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

export class WebFetchTool extends BaseTool {
  name = 'web_fetch'
  description = 'Fetch content from a URL (HTTP GET request).'
  inputSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch content from',
      },
      headers: {
        type: 'object',
        description: 'Optional HTTP headers',
      },
    },
    required: ['url'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { url, headers = {} } = args

    // Validate URL
    try {
      new URL(url)
    } catch {
      return this.failure('Invalid URL format')
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent/1.0)',
          ...headers,
        },
      })

      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const data = await response.json()
        return this.success(JSON.stringify(data, null, 2))
      }

      const text = await response.text()

      // Truncate very large responses
      if (text.length > 50000) {
        return this.success(text.slice(0, 50000) + '\n\n[... content truncated]')
      }

      return this.success(text)
    } catch (error: any) {
      return this.failure(`Fetch failed: ${error.message}`)
    }
  }
}
