import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { dirname, resolve } from 'path'

interface AdminAccount {
  username: string
  passwordHash: string
  createdAt: number
}

interface BootstrapConfig {
  secretHash: string
  createdAt: number
}

export class AdminAuthService {
  private authFilePath: string
  private bootstrapFilePath: string
  private account: AdminAccount | null = null
  private bootstrap: BootstrapConfig | null = null
  private sessions = new Map<string, string>()

  constructor(authFilePath: string) {
    this.authFilePath = authFilePath
    this.bootstrapFilePath = resolve(dirname(authFilePath), 'admin-bootstrap.json')
  }

  async initialize(): Promise<void> {
    await mkdir(dirname(this.authFilePath), { recursive: true })

    try {
      const raw = await readFile(this.authFilePath, 'utf-8')
      this.account = JSON.parse(raw)
    } catch {
      this.account = null
    }

    try {
      const raw = await readFile(this.bootstrapFilePath, 'utf-8')
      this.bootstrap = JSON.parse(raw)
    } catch {
      this.bootstrap = null
    }

    if (!this.account && !this.bootstrap) {
      const bootstrapSecret = process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET || crypto.randomUUID()
      this.bootstrap = {
        secretHash: this.hashPassword(bootstrapSecret),
        createdAt: Date.now(),
      }
      await writeFile(this.bootstrapFilePath, JSON.stringify(this.bootstrap, null, 2))
      if (!process.env.FREE_CODE_ADMIN_BOOTSTRAP_SECRET) {
        console.log(`Enterprise admin bootstrap secret saved to ${this.bootstrapFilePath}`)
      }
    }
  }

  hasAdminAccount(): boolean {
    return this.account !== null
  }

  getStatus(token?: string): { hasAdminAccount: boolean; isAuthenticated: boolean; username?: string; requiresBootstrapSecret: boolean } {
    const username = token ? this.sessions.get(token) : undefined
    return {
      hasAdminAccount: this.hasAdminAccount(),
      isAuthenticated: Boolean(username),
      username,
      requiresBootstrapSecret: !this.hasAdminAccount(),
    }
  }

  async setupAdmin(username: string, password: string, bootstrapSecret: string): Promise<string> {
    if (this.account) {
      throw new Error('Admin account already configured')
    }
    if (!this.bootstrap || this.bootstrap.secretHash !== this.hashPassword(bootstrapSecret)) {
      throw new Error('Invalid bootstrap secret')
    }

    this.account = {
      username,
      passwordHash: this.hashPassword(password),
      createdAt: Date.now(),
    }
    await this.save()
    this.bootstrap = null
    await unlink(this.bootstrapFilePath).catch(() => {})
    return this.createSession(username)
  }

  login(username: string, password: string): string {
    if (!this.account) {
      throw new Error('Admin account is not configured')
    }
    if (this.account.username !== username || this.account.passwordHash !== this.hashPassword(password)) {
      throw new Error('Invalid credentials')
    }
    return this.createSession(username)
  }

  logout(token: string | undefined): void {
    if (!token) return
    this.sessions.delete(token)
  }

  isAuthorized(token: string | undefined): boolean {
    return Boolean(token && this.sessions.has(token))
  }

  private createSession(username: string): string {
    const token = crypto.randomUUID()
    this.sessions.set(token, username)
    return token
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
  }

  private async save(): Promise<void> {
    if (!this.account) return
    await writeFile(this.authFilePath, JSON.stringify(this.account, null, 2))
  }
}
