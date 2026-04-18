export function slugifyName(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function parseCommaSeparated(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}
