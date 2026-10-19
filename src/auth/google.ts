/* Google Identity Services, token-flow зі scope drive.file.
   Підхід перенесено зі stable-journal: тихе перепідключення,
   кеш токена в localStorage, окрема помилка для протухлої сесії. */

export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const LS_KEY = 'shafa-auth-v1'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface TokenClient {
  callback: (r: TokenResponse) => void
  requestAccessToken: (o?: { prompt?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (c: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: unknown) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

export class AuthExpiredError extends Error {
  constructor(msg = 'Сесія Google протухла — потрібен повторний вхід') {
    super(msg)
    this.name = 'AuthExpiredError'
  }
}

interface Saved {
  signedIn: boolean
  token?: string
  expiry?: number
}

let tokenClient: TokenClient | null = null
let accessToken: string | null = null
let tokenExpiry = 0
let onError: ((e: unknown) => void) | null = null

function readSaved(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null')
  } catch {
    return null
  }
}
function writeSaved(s: Saved | null) {
  try {
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s))
    else localStorage.removeItem(LS_KEY)
  } catch {
    /* сховище може бути недоступним */
  }
}

export const wasSignedIn = (): boolean => !!readSaved()?.signedIn

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Не вдалося завантажити Google Identity'))
    document.head.appendChild(s)
  })
}

export async function initAuth(): Promise<void> {
  if (!CLIENT_ID) return
  await loadScript()
  tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {},
    error_callback: (e) => onError?.(e),
  })
  const saved = readSaved()
  if (saved?.token && saved.expiry && Date.now() < saved.expiry) {
    accessToken = saved.token
    tokenExpiry = saved.expiry
  }
}

function requestToken(prompt: '' | 'consent' | 'select_account'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Google вхід недоступний'))
    let done = false
    const ok = (t: string) => {
      if (done) return
      done = true
      onError = null
      resolve(t)
    }
    const bad = (e: unknown) => {
      if (done) return
      done = true
      onError = null
      reject(e)
    }
    tokenClient.callback = (r) => {
      if (r.error || !r.access_token) return bad(r)
      accessToken = r.access_token
      tokenExpiry = Date.now() + ((r.expires_in ?? 3600) - 60) * 1000
      writeSaved({ signedIn: true, token: accessToken, expiry: tokenExpiry })
      ok(accessToken)
    }
    onError = bad
    setTimeout(() => bad(new Error('Час очікування входу вичерпано')), 30000)
    try {
      tokenClient.requestAccessToken({ prompt })
    } catch (e) {
      bad(e)
    }
  })
}

/** Інтерактивний вхід (кнопка). */
export const signIn = () => requestToken('select_account')

export async function ensureToken(force = false): Promise<string> {
  if (!force && accessToken && Date.now() < tokenExpiry) return accessToken
  return requestToken('')
}

export function invalidateToken() {
  accessToken = null
  tokenExpiry = 0
  const s = readSaved()
  if (s) writeSaved({ signedIn: s.signedIn })
}

export function signOut() {
  const t = accessToken
  accessToken = null
  tokenExpiry = 0
  writeSaved(null)
  if (t) window.google?.accounts.oauth2.revoke(t)
}

/** fetch з Bearer-токеном і однією тихою повторною спробою при 401. */
export async function authFetch(
  url: string,
  opts: RequestInit = {},
  retried = false,
): Promise<Response> {
  let token: string
  try {
    token = await ensureToken()
  } catch {
    throw new AuthExpiredError()
  }
  const r = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  })
  if (r.status === 401) {
    if (retried) throw new AuthExpiredError()
    invalidateToken()
    try {
      await ensureToken(true)
    } catch {
      throw new AuthExpiredError()
    }
    return authFetch(url, opts, true)
  }
  if (!r.ok) throw new Error(`Drive API: ${r.status}`)
  return r
}
