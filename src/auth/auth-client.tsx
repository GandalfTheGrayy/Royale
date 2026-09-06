import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { accountRequest, clearAccountCsrfToken } from './auth-api'
import './auth.css'

export { accountRequest } from './auth-api'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'player'
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  balance: number
  walletVersion: number
  createdAt: string
  approvedAt?: string
  lastSeenAt?: string
  avatarId: string
}

type AuthContextValue = {
  user: AuthUser
  logout: () => Promise<void>
  refresh: () => Promise<void>
  refreshWallet: () => Promise<number>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider eksik.')
  return value
}

type GateState = 'loading' | 'setup' | 'login' | 'register' | 'pending' | 'ready'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [localSetupAllowed, setLocalSetupAllowed] = useState(false)
  const [message, setMessage] = useState('')
  const walletVersionRef = useRef(-1)

  const acceptUser = useCallback((next: AuthUser) => {
    walletVersionRef.current = Number.isFinite(next.walletVersion) ? next.walletVersion : 0
    setUser(next)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const result = await accountRequest<{ authenticated: boolean; user?: AuthUser; csrfToken?: string; needsOwnerSetup?: boolean }>('/api/auth/me')
      if (result.authenticated && result.user) { acceptUser(result.user); setState('ready'); return }
      const status = await accountRequest<{ needsOwnerSetup: boolean; localSetupAllowed: boolean }>('/api/auth/status')
      setLocalSetupAllowed(status.localSetupAllowed)
      setState(status.needsOwnerSetup ? 'setup' : 'login')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sunucuya ulaşılamadı.')
      setState('login')
    }
  }, [acceptUser])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ balance: number; version?: number }>).detail
      const balance = detail?.balance
      const version = Number(detail?.version)
      if (!Number.isFinite(balance)) return
      if (Number.isFinite(version) && version < walletVersionRef.current) return
      if (Number.isFinite(version)) walletVersionRef.current = version
      setUser((current) => current ? { ...current, balance, walletVersion: Number.isFinite(version) ? version : current.walletVersion } : current)
    }
    window.addEventListener('pehlevan-wallet-updated', listener)
    return () => window.removeEventListener('pehlevan-wallet-updated', listener)
  }, [])

  const refreshWallet = useCallback(async () => {
    const result = await accountRequest<{ balance: number; version: number }>('/api/me/wallet')
    if (result.version >= walletVersionRef.current) {
      walletVersionRef.current = result.version
      setUser((current) => current ? { ...current, balance: result.balance, walletVersion: result.version } : current)
    }
    return result.balance
  }, [])

  const logout = useCallback(async () => {
    // Keep the session identity stable until its final wager/payout has reached
    // SQLite; otherwise a fast account switch could authenticate a queued write
    // as the next user.
    const { flushCasinoWalletWrites } = await import('../data/casino-database')
    await flushCasinoWalletWrites()
    await accountRequest('/api/auth/logout', { method: 'POST' })
    clearAccountCsrfToken(); walletVersionRef.current = -1; setUser(null); setState('login')
  }, [])

  const value = useMemo(() => user ? { user, logout, refresh, refreshWallet } : null, [user, logout, refresh, refreshWallet])
  if (state === 'loading') return <AuthShell><div className="auth-loading"><i /><strong>Salon hazırlanıyor</strong><span>Hesap ve cüzdan doğrulanıyor…</span></div></AuthShell>
  if (state !== 'ready' || !value) return <AuthPortal state={state} setState={setState} localSetupAllowed={localSetupAllowed} message={message} setMessage={setMessage} onAuthenticated={(next) => { acceptUser(next); setState('ready') }} />
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-shell"><div className="auth-atmosphere" /><header><div className="auth-mark">MP</div><span>PEHLEVAN<small>ROYALE · PRIVATE HOUSE</small></span></header><section className="auth-card">{children}</section><footer>YALNIZCA EĞLENCE İÇİN · SANAL PR · ÖDEME YOKTUR</footer></main>
}

function AuthPortal({ state, setState, localSetupAllowed, message, setMessage, onAuthenticated }: {
  state: GateState; setState: (state: GateState) => void; localSetupAllowed: boolean; message: string; setMessage: (value: string) => void; onAuthenticated: (user: AuthUser) => void
}) {
  const [busy, setBusy] = useState(false)
  const [registeredName, setRegisteredName] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>, mode: 'setup' | 'login' | 'register') => {
    event.preventDefault(); setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try {
      if ((mode === 'setup' || mode === 'register') && data.get('password') !== data.get('confirmPassword')) {
        throw new Error('Parolalar aynı değil.')
      }
      if (mode === 'setup') {
        const result = await accountRequest<{ user: AuthUser; csrfToken: string }>('/api/auth/bootstrap-owner', { method: 'POST', body: JSON.stringify({ displayName: data.get('displayName'), password: data.get('password') }) })
        onAuthenticated(result.user); return
      }
      if (mode === 'register') {
        const username = String(data.get('username') ?? '')
        await accountRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, displayName: data.get('displayName'), password: data.get('password'), note: data.get('note') }) })
        setRegisteredName(username); setState('pending'); return
      }
      const result = await accountRequest<{ user: AuthUser; csrfToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password'), remember: data.get('remember') === 'on' }) })
      onAuthenticated(result.user)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'İşlem tamamlanamadı.') }
    finally { setBusy(false) }
  }

  return <AuthShell>
    {state === 'setup' ? <form onSubmit={(event) => void submit(event, 'setup')}>
      <small className="auth-kicker">İLK KURULUM · MUHARREM PEHLEVAN</small><h1>Özel salonun anahtarını belirle.</h1><p>Mevcut bakiyen ve bütün oyun geçmişin Muharrem Pehlevan hesabına bağlanacak.</p>
      {!localSetupAllowed && <div className="auth-alert">İlk kurulum güvenlik nedeniyle yalnız bu bilgisayarda <b>localhost</b> adresinden yapılabilir.</div>}
      <label>Muharrem Pehlevan kullanıcı adı<input value="Pehlevan" readOnly aria-readonly="true" /></label>
      <label>Görünen ad<input name="displayName" defaultValue="Muharrem Pehlevan" minLength={2} maxLength={60} required disabled={!localSetupAllowed} /></label>
      <label>Yeni Muharrem Pehlevan parolası<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={!localSetupAllowed} /></label>
      <label>Parola tekrar<input name="confirmPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={!localSetupAllowed} /></label>
      {message && <div className="auth-error">{message}</div>}<button disabled={busy || !localSetupAllowed}>{busy ? 'HAZIRLANIYOR…' : 'MUHARREM PEHLEVAN HESABINI KUR'}</button>
    </form> : state === 'register' ? <form onSubmit={(event) => void submit(event, 'register')}>
      <small className="auth-kicker">YENİ ÜYELİK</small><h1>Salona başvur.</h1><p>Kayıt Muharrem Pehlevan onayından sonra açılır. Başlangıç bakiyeni Muharrem Pehlevan belirler.</p>
      <label>Kullanıcı adı<input name="username" minLength={3} maxLength={24} autoCapitalize="none" autoComplete="username" required /></label>
      <label>Görünen ad<input name="displayName" minLength={2} maxLength={60} autoComplete="name" required /></label>
      <label>Parola<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
      <label>Parola tekrar<input name="confirmPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
      <label>Muharrem Pehlevan'a not <em>isteğe bağlı</em><textarea name="note" maxLength={500} rows={2} /></label>
      {message && <div className="auth-error">{message}</div>}<button disabled={busy}>{busy ? 'GÖNDERİLİYOR…' : 'ONAYA GÖNDER'}</button><button type="button" className="auth-secondary" onClick={() => { setMessage(''); setState('login') }}>Girişe dön</button>
    </form> : state === 'pending' ? <div className="auth-pending"><i>✓</i><small>BAŞVURU ALINDI</small><h1>Muharrem Pehlevan onayı bekleniyor.</h1><p><b>{registeredName}</b> hesabı açıldı. Muharrem Pehlevan onaylayıp başlangıç bakiyeni belirlediğinde giriş yapabilirsin.</p><button onClick={() => setState('login')}>GİRİŞ EKRANINA DÖN</button></div> : <form onSubmit={(event) => void submit(event, 'login')}>
      <small className="auth-kicker">ÜYE GİRİŞİ</small><h1>Gece kaldığı yerden devam etsin.</h1><p>Bakiyen, geçmişin ve sana atanmış salon profilleri bu hesaba aittir.</p>
      <label>Kullanıcı adı<input name="username" autoCapitalize="none" autoComplete="username" required /></label>
      <label>Parola<input name="password" type="password" autoComplete="current-password" required /></label>
      <label className="auth-remember"><input name="remember" type="checkbox" /><span>Bu cihazda beni hatırla</span></label>
      {message && <div className="auth-error">{message}</div>}<button disabled={busy}>{busy ? 'DOĞRULANIYOR…' : 'SALONA GİR'}</button><button type="button" className="auth-secondary" onClick={() => { setMessage(''); setState('register') }}>Yeni hesap oluştur</button>
    </form>}
  </AuthShell>
}
