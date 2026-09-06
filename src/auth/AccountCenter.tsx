import { useEffect, useState, type FormEvent } from 'react'
import { accountRequest } from './auth-api'
import { useAuth } from './auth-client'
import './account-center.css'

type SessionInfo = { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; device: string; current: boolean }
type GameProfile = { id: string; gameId: string; name: string; kind: string; version: number; assigned: boolean }
const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const gameNames: Record<string, string> = { blackjack: 'Blackjack', roulette: 'Rulet', poker: 'Poker', 'kiraz-77': 'Kiraz 77', 'neon-kasasi': 'Neon Kasası', 'kaptan-mercan': 'Kaptan Mercan', 'sekerhane-1024': 'Şekerhane 1024', 'allahin-lutfu': 'Allah’ın Lütfu', 'baykus-madeni': 'Baykuş Madeni', 'altin-rota': 'Altın Rota', limbo: 'Owl Oracle Limbo', 'obsidyen-damari': 'Obsidyen Damarı', mines: 'Mines', keno: 'Owl Star Map Keno', 'son-on': 'Son On', plinko: 'Plinko', hilo: 'Hilo', 'yedi-cevher': 'Yedi Cevher' }

export default function AccountCenter({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth()
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [profiles, setProfiles] = useState<GameProfile[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      accountRequest<{ sessions: SessionInfo[] }>('/api/me/sessions'),
      accountRequest<{ profiles: GameProfile[] }>('/api/me/game-profiles'),
    ]).then(([sessionResult, profileResult]) => {
      setSessions(sessionResult.sessions); setProfiles(profileResult.profiles.filter((profile) => profile.assigned || profile.kind === 'standard'))
    }).catch((error) => setMessage(error.message))
  }, [])

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const data = new FormData(event.currentTarget)
    if (data.get('newPassword') !== data.get('confirmPassword')) { setMessage('Yeni parolalar aynı değil.'); setBusy(false); return }
    try {
      await accountRequest('/api/me/password', { method: 'POST', body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') }) })
      event.currentTarget.reset(); setMessage('Parola değiştirildi; diğer cihazlardaki oturumlar kapatıldı.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Parola değiştirilemedi.') }
    finally { setBusy(false) }
  }

  const revokeSession = async (sessionId: string) => {
    try {
      await accountRequest(`/api/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
      setSessions((current) => current.filter((session) => session.id !== sessionId)); setMessage('Diğer cihazın oturumu kapatıldı.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Oturum kapatılamadı.') }
  }

  return <div className="account-center-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="account-center" role="dialog" aria-modal="true" aria-labelledby="account-center-title">
      <header><div><small>PEHLEVAN ROYALE · HESAP</small><h2 id="account-center-title">{user.displayName}</h2><span>@{user.username} · {user.role.toLocaleUpperCase('tr-TR')}</span></div><button onClick={onClose} aria-label="Hesap panelini kapat">×</button></header>
      <div className="account-center-wallet"><small>GÜNCEL CÜZDAN</small><strong>{money.format(user.balance)} <em>PR</em></strong><span>Bu bakiye yalnız Muharrem Pehlevan/yetkili yönetici işlemi veya oyun sonucu ile değişir.</span></div>
      <div className="account-center-grid">
        <article><header><small>AKTİF CİHAZLAR</small><b>{sessions.length}</b></header>{sessions.map((session) => <div className="account-session" key={session.id}><i className={session.current ? 'current' : ''} /><span><b>{session.current ? 'Bu cihaz' : 'Diğer oturum'}</b><small>{session.device.includes('iPhone') ? 'iPhone / Safari' : session.device.includes('Mobile') ? 'Mobil tarayıcı' : 'Masaüstü tarayıcı'} · {new Date(session.lastSeenAt).toLocaleString('tr-TR')}</small></span>{!session.current && <button onClick={() => void revokeSession(session.id)} aria-label="Bu cihazın oturumunu kapat">KAPAT</button>}</div>)}</article>
        <article><header><small>OYUN PROFİLLERİ</small><b>{profiles.filter((profile) => profile.assigned).length || 'STD'}</b></header><div className="account-profile-list">{profiles.map((profile) => <span key={profile.id} className={profile.assigned ? 'assigned' : ''}><i>{profile.assigned ? '✦' : '·'}</i><b>{gameNames[profile.gameId] ?? profile.gameId}</b><small>{profile.name} · v{profile.version}</small></span>)}</div></article>
      </div>
      <form className="account-password" onSubmit={(event) => void changePassword(event)}><header><small>GÜVENLİK</small><b>Parola değiştir</b></header><div><input name="currentPassword" type="password" autoComplete="current-password" placeholder="Mevcut parola" minLength={8} required/><input name="newPassword" type="password" autoComplete="new-password" placeholder="Yeni parola" minLength={8} required/><input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Yeni parola tekrar" minLength={8} required/><button disabled={busy}>{busy ? 'BEKLEYİN…' : 'PAROLAYI GÜNCELLE'}</button></div></form>
      {message && <div className="account-center-message">{message}</div>}
      <footer><button className="account-logout-button" onClick={() => void logout()}>BU HESAPTAN ÇIK</button><small>Parola ve oturum belirteçleri tarayıcı depolamasında tutulmaz.</small></footer>
    </section>
  </div>
}
