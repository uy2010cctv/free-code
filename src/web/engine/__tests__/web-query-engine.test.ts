import { describe, expect, test } from 'bun:test'
import { WebQueryEngine } from '../WebQueryEngine'
import type { Tool } from '../types'

function createSkillTool(): Tool {
  return {
    name: 'skill',
    description: 'Invoke a local skill',
    inputSchema: {
      type: 'object',
      properties: {
        skillName: { type: 'string' },
      },
      required: ['skillName'],
    },
    async execute(args) {
      return {
        success: true,
        output: `skill:${args.skillName}`,
      }
    },
  }
}

describe('WebQueryEngine', () => {
  test('forces explicit tool selection and preserves tool history for repeated skill invocation', async () => {
    const createCalls: Array<Record<string, any>> = []
    const responses = [
      {
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'skill', input: { skillName: 'ralph' } },
        ],
      },
      {
        content: [
          { type: 'text', text: 'First skill invocation complete.' },
        ],
      },
      {
        content: [
          { type: 'tool_use', id: 'tool-2', name: 'skill', input: { skillName: 'ralph' } },
        ],
      },
      {
        content: [
          { type: 'text', text: 'Second skill invocation complete.' },
        ],
      },
    ]

    const engine = new WebQueryEngine({
      apiKey: 'test-key',
      baseURL: 'http://example.test',
      anthropicClient: {
        messages: {
          async create(params: Record<string, any>) {
            createCalls.push(JSON.parse(JSON.stringify(params)))
            const next = responses.shift()
            if (!next) {
              throw new Error('No mock response available')
            }
            return next
          },
        },
      },
    })

    engine.registerTool(createSkillTool())

    const firstEvents = []
    for await (const event of engine.submitMessage(
      'Use the skill tool to invoke the local skill named ralph.',
      { cwd: process.cwd(), sessionId: 'session-1' },
    )) {
      firstEvents.push(event)
    }

    const secondEvents = []
    for await (const event of engine.submitMessage(
      'Use the skill tool to invoke the local skill named ralph.',
      { cwd: process.cwd(), sessionId: 'session-1' },
    )) {
      secondEvents.push(event)
    }

    expect(firstEvents.map((event) => event.type)).toContain('tool_start')
    expect(firstEvents.map((event) => event.type)).toContain('tool_result')
    expect(secondEvents.map((event) => event.type)).toContain('tool_start')
    expect(secondEvents.map((event) => event.type)).toContain('tool_result')

    expect(createCalls[0].tool_choice).toEqual({ type: 'tool', name: 'skill' })
    expect(createCalls[2].tool_choice).toEqual({ type: 'tool', name: 'skill' })

    expect(createCalls[2].messages).toEqual([
      { role: 'user', content: 'Use the skill tool to invoke the local skill named ralph.' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'skill', input: { skillName: 'ralph' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tool-1', content: 'skill:ralph', is_error: false },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'First skill invocation complete.' },
        ],
      },
      { role: 'user', content: 'Use the skill tool to invoke the local skill named ralph.' },
    ])
  })
})
