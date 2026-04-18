export type DataSourceKind = 'file' | 'database' | 'external'
export type ConnectorAuthType = 'none' | 'apiKey' | 'oauth' | 'serviceAccount'
export type ConnectorCompatibilityStatus = 'ready' | 'beta' | 'legacy'

export interface DataSourceConnector {
  id: string
  name: string
  kind: DataSourceKind
  description: string
  capabilities: string[]
  status: 'connected' | 'disconnected' | 'error'
  config: Record<string, string>
  authType: ConnectorAuthType
  schemaHints: string[]
  compatibilityStatus: ConnectorCompatibilityStatus
}
