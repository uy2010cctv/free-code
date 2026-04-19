import { createHash } from 'crypto'
import { appendFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'

export interface AuditLogEntry {
  timestamp: string
  adminTokenHash: string
  action: string
  resourceId: string | undefined
  outcome: 'success' | 'failure'
  details?: Record<string, unknown>
}

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.setup'
  | 'connector.create'
  | 'connector.update'
  | 'module.save'
  | 'module.refresh'
  | 'module.publish'
  | 'session.connectors'
  | 'session.modules'

export class AuditLogger {
  private logFilePath: string

  constructor(enterpriseDir: string) {
    this.logFilePath = resolve(enterpriseDir, 'audit.log')
  }

  async initialize(): Promise<void> {
    await mkdir(dirname(this.logFilePath), { recursive: true })
  }

  hashToken(token: string | undefined): string {
    if (!token) return 'anonymous'
    return createHash('sha256').update(token).digest('hex').slice(0, 16)
  }

  async log(
    token: string | undefined,
    action: AuditAction,
    resourceId: string | undefined,
    outcome: 'success' | 'failure',
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      adminTokenHash: this.hashToken(token),
      action,
      resourceId,
      outcome,
      details,
    }
    await appendFile(this.logFilePath, JSON.stringify(entry) + '\n')
  }
}
