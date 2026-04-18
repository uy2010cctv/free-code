import type { DataSourceKind } from '../connectors/types'

export type ModuleLifecycleState = 'draft' | 'refreshed' | 'published'
export type ModuleOutputFormat = 'docx' | 'xlsx' | 'report'

export interface BusinessModule {
  id: string
  name: string
  description: string
  version: string
  prompts: string[]
  requiredConnectorKinds: DataSourceKind[]
  reportTemplates: string[]
  outputFormats: ModuleOutputFormat[]
  lifecycleState: ModuleLifecycleState
  publishedAt?: number
  refreshedAt?: number
}
