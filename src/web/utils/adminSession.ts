const ADMIN_TOKEN_KEY = 'free-code-admin-token'

export function loadAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function saveAdminToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ADMIN_TOKEN_KEY)
}
