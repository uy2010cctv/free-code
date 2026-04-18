import type { DataSourceConnector, DataSourceKind } from './types'

export class ConnectorRegistry {
  private connectors = new Map<string, DataSourceConnector>()

  async load(items: DataSourceConnector[]): Promise<void> {
    this.connectors.clear()
    for (const item of items) {
      this.connectors.set(item.id, item)
    }
  }

  register(item: DataSourceConnector): void {
    this.connectors.set(item.id, item)
  }

  update(id: string, updates: Partial<DataSourceConnector>): DataSourceConnector | undefined {
    const current = this.connectors.get(id)
    if (!current) return undefined
    const next = { ...current, ...updates, id: current.id }
    this.connectors.set(id, next)
    return next
  }

  getAll(): DataSourceConnector[] {
    return [...this.connectors.values()]
  }

  getByKind(kind: DataSourceKind): DataSourceConnector[] {
    return this.getAll().filter(item => item.kind === kind)
  }

  getByIds(ids: string[]): DataSourceConnector[] {
    return ids
      .map(id => this.connectors.get(id))
      .filter((item): item is DataSourceConnector => Boolean(item))
  }
}
