import type { BusinessModule } from './types'

export class ModuleRegistry {
  private modules = new Map<string, BusinessModule>()

  async load(items: BusinessModule[]): Promise<void> {
    this.modules.clear()
    for (const item of items) {
      this.modules.set(item.id, item)
    }
  }

  async refresh(items: BusinessModule[]): Promise<void> {
    await this.load(items)
  }

  getAll(): BusinessModule[] {
    return [...this.modules.values()]
  }

  getById(id: string): BusinessModule | undefined {
    return this.modules.get(id)
  }

  upsert(module: BusinessModule): BusinessModule {
    const existing = this.modules.get(module.id)
    const next: BusinessModule = {
      ...existing,
      ...module,
      id: module.id,
      lifecycleState: module.lifecycleState ?? existing?.lifecycleState ?? 'draft',
      publishedAt: module.lifecycleState === 'published' ? (module.publishedAt ?? existing?.publishedAt ?? Date.now()) : existing?.publishedAt,
    }
    this.modules.set(module.id, next)
    return next
  }

  getByIds(ids: string[]): BusinessModule[] {
    return ids
      .map(id => this.modules.get(id))
      .filter((item): item is BusinessModule => Boolean(item))
  }

  getPublishedByIds(ids: string[]): BusinessModule[] {
    return this.getByIds(ids).filter(item => item.lifecycleState === 'published')
  }

  publish(id: string): BusinessModule | undefined {
    const module = this.modules.get(id)
    if (!module) return undefined

    const published: BusinessModule = {
      ...module,
      lifecycleState: 'published',
      publishedAt: Date.now(),
    }
    this.modules.set(id, published)
    return published
  }

  refreshById(id: string): BusinessModule | undefined {
    const module = this.modules.get(id)
    if (!module) return undefined

    const refreshed: BusinessModule = {
      ...module,
      lifecycleState: 'refreshed',
      refreshedAt: Date.now(),
    }
    this.modules.set(id, refreshed)
    return refreshed
  }
}
