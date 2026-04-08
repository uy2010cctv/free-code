import type { Command } from '../types/settings'

export const COMMANDS: Command[] = [
  // Session commands
  { name: 'plan', description: 'Create a plan for a task', category: 'session', aliases: ['/p'] },
  { name: 'undo', description: 'Undo the last change', category: 'session', aliases: ['/u'] },
  { name: 'redo', description: 'Redo the last undone change', category: 'session' },
  { name: 'compact', description: 'Compact context by summarizing old messages', category: 'session' },
  { name: 'resume', description: 'Resume an interrupted task', category: 'session' },
  { name: 'rewind', description: 'Rewind to a previous state', category: 'session' },
  { name: 'clear', description: 'Clear the conversation', category: 'session' },
  { name: 'continue', description: 'Continue the last task', category: 'session' },

  // Config commands
  { name: 'model', description: 'Switch or show the current model', category: 'config', args: [{ name: 'model', description: 'Model name (optional)', required: false }] },
  { name: 'permission', description: 'Manage permission settings', category: 'config' },
  { name: 'cost', description: 'Show cumulative API costs', category: 'config' },
  { name: 'usage', description: 'Show token usage statistics', category: 'config' },
  { name: 'status', description: 'Show current status and settings', category: 'config' },
  { name: 'env', description: 'Show environment variables', category: 'config' },

  // Tools commands
  { name: 'read', description: 'Read a file', category: 'tools', args: [{ name: 'path', description: 'File path', required: true }] },
  { name: 'write', description: 'Write content to a file', category: 'tools', args: [{ name: 'path', description: 'File path', required: true }] },
  { name: 'bash', description: 'Execute a shell command', category: 'tools', aliases: ['/$'], args: [{ name: 'command', description: 'Command to execute', required: true }] },
  { name: 'grep', description: 'Search for text in files', category: 'tools', args: [{ name: 'pattern', description: 'Pattern to search', required: true }] },
  { name: 'glob', description: 'Find files matching a pattern', category: 'tools', args: [{ name: 'pattern', description: 'Glob pattern', required: true }] },
  { name: 'web-fetch', description: 'Fetch content from a URL', category: 'tools', args: [{ name: 'url', description: 'URL to fetch', required: true }] },

  // Agent commands
  { name: 'ask', description: 'Ask a question', category: 'agent', args: [{ name: 'question', description: 'Question to ask', required: true }] },
  { name: 'review', description: 'Review code changes', category: 'agent' },
  { name: 'diff', description: 'Show uncommitted changes', category: 'agent' },
  { name: 'commit', description: 'Create a git commit', category: 'agent' },

  // Other commands
  { name: 'help', description: 'Show help information', category: 'other' },
  { name: 'exit', description: 'Exit the application', category: 'other' },
  { name: 'theme', description: 'Change the theme', category: 'other', args: [{ name: 'theme', description: 'Theme name (dark/light)', required: false }] },
  { name: 'shortcuts', description: 'Show keyboard shortcuts', category: 'other' },
  { name: 'memory', description: 'Manage memories', category: 'other' },
  { name: 'tasks', description: 'Show active tasks', category: 'other' },
]

export function getCommandsByCategory(): Record<string, Command[]> {
  const categories: Record<string, Command[]> = {}
  for (const cmd of COMMANDS) {
    if (!categories[cmd.category]) {
      categories[cmd.category] = []
    }
    categories[cmd.category].push(cmd)
  }
  return categories
}

export function searchCommands(query: string): Command[] {
  const lower = query.toLowerCase()
  return COMMANDS.filter(cmd =>
    cmd.name.includes(lower) ||
    cmd.description.toLowerCase().includes(lower) ||
    cmd.aliases?.some(a => a.includes(lower))
  )
}
