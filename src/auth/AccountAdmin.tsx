import { Fragment, useCallback, useEffect, useState } from 'react'
import { accountRequest } from './auth-api'
import { useAuth, type AuthUser } from './auth-client'
import './account-admin.css'

type ManagedUser = AuthUser & {
  registrationNote?: string
  adminNote?: string
  suspendedReason?: string
  activeSessions: number
}
type ManagedProfile = { id: string; gameId: string; name: string; kind: string; version: number; math: Record<string, unknown>; experience: Record<string, unknown> }
type ProfileAssignment = { userId: string; gameId: string; profileId: string; reason: string; assignedAt: string }
type AuditRecord = { id: string; actor_user_id: string; target_user_id?: string; action: string; entity_type: string; reason?: string; occurred_at: string }
const gameNames: Record<string, string> = { blackjack: 'Blackjack', roulette: 'Rulet', poker: 'Poker', 'kiraz-77': 'Kiraz 77', 'neon-kasasi': 'Neon Kasası', 'kaptan-mercan': 'Kaptan Mercan', 'sekerhane-1024': 'Şekerhane 1024', 'allahin-lutfu': 'Allah’ın Lütfu', 'baykus-madeni': 'Baykuş Madeni', 'altin-rota': 'Altın Rota', limbo: 'Owl Oracle Limbo', 'obsidyen-damari': 'Obsidyen Damarı', mines: 'Mines', keno: 'Owl Star Map Keno', 'son-on': 'Son On', plinko: 'Plinko', hilo: 'Hilo', 'yedi-cevher': 'Yedi Cevher' }

const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

export default function AccountAdmin() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [profiles, setProfiles] = useState<ManagedProfile[]>([])
  const [assignments, setAssignments] = useState<ProfileAssignment[]>([])
  const [expandedUser, setExpandedUser] = useState('')
  const [profileGame, setProfileGame] = useState<Record<string, string>>({})
  const [selectedProfile, setSelectedProfile] = useState<Record<string, string>>({})
  const [newProfile, setNewProfile] = useState({ gameId: 'neon-kasasi', name: '', targetRtp: '95', volatility: 'orta', hitBias: '1', bonusBias: '1', celebration: 'dengeli' })
  const [audit, setAudit] = useState<AuditRecord[]>([])
  const [defaultStartingPiar, setDefaultStartingPiar] = useState(5000)

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      accountRequest<{ users: ManagedUser[] }>('/api/admin/accounts/users').then((result) => setUsers(result.users)),
      accountRequest<{ profiles: ManagedProfile[]; assignments: ProfileAssignment[] }>('/api/admin/accounts/profiles').then((result) => { setProfiles(result.profiles); setAssignments(result.assignments) }),
      accountRequest<{ records: AuditRecord[] }>('/api/admin/accounts/audit').then((result) => setAudit(result.records)),
      accountRequest<{ config: { economy: { startingPiar: number } } }>('/api/casino-data/competition/admin/config').then((result) => setDefaultStartingPiar(result.config.economy.startingPiar)),
    ])
    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  }, [])

  useEffect(() => { void load().catch((error) => setNotice(error.message)) }, [load])

  const action = async (user: ManagedUser, name: 'approve' | 'reject' | 'suspend' | 'activate' | 'wallet') => {
    setBusy(`${user.id}:${name}`); setNotice('')
    try {
      const amount = Number(amounts[user.id] || (name === 'approve' ? defaultStartingPiar : 0))
      const reason = reasons[user.id] || (name === 'approve' ? 'Üyelik onayı ve başlangıç bakiyesi' : 'Muharrem Pehlevan kullanıcı düzenlemesi')
      const payload = name === 'approve' ? { initialBalance: Math.max(0, amount), reason } : name === 'wallet' ? { amount, reason } : { reason }
      const result = await accountRequest<{ userId?: string; balance?: number; version?: number }>(`/api/admin/accounts/users/${encodeURIComponent(user.id)}/${name}`, { method: 'POST', body: JSON.stringify(payload) })
      if (name === 'wallet' && result.userId === currentUser.id && Number.isFinite(result.balance) && Number.isFinite(result.version)) {
        window.dispatchEvent(new CustomEvent('pehlevan-wallet-updated', { detail: { userId: result.userId, balance: result.balance, version: result.version } }))
      }
      setNotice(`${user.displayName}: işlem tamamlandı.`)
      await load().catch(() => setNotice(`${user.displayName}: işlem tamamlandı; listenin bir bölümü yenilenemedi. YENİLE ile tekrar yükleyebilirsiniz.`))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'İşlem tamamlanamadı.') }
    finally { setBusy('') }
  }

  const changeRole = async (user: ManagedUser, role: 'admin' | 'player') => {
    setBusy(`${user.id}:role`); setNotice('')
    try {
      await accountRequest(`/api/admin/accounts/users/${encodeURIComponent(user.id)}/role`, { method: 'POST', body: JSON.stringify({ role, reason: 'Muharrem Pehlevan yetki düzenlemesi' }) })
      await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Rol değiştirilemedi.') }
    finally { setBusy('') }
  }

  const assignProfile = async (user: ManagedUser) => {
    const gameId = profileGame[user.id] ?? 'neon-kasasi'
    const available = profiles.filter((profile) => profile.gameId === gameId)
    const profileId = selectedProfile[user.id] ?? available[0]?.id
    if (!profileId) return
    setBusy(`${user.id}:profile`)
    try {
      await accountRequest(`/api/admin/accounts/users/${encodeURIComponent(user.id)}/profile`, { method: 'POST', body: JSON.stringify({ gameId, profileId, reason: reasons[user.id] || 'Muharrem Pehlevan oyun profili ataması' }) })
      setNotice(`${user.displayName}: ${gameNames[gameId]} profili atandı.`); await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Profil atanamadı.') }
    finally { setBusy('') }
  }

  const createProfile = async () => {
    if (newProfile.name.trim().length < 2) { setNotice('Profil adı en az iki karakter olmalı.'); return }
    setBusy('profile:create')
    try {
      await accountRequest('/api/admin/accounts/profiles', { method: 'POST', body: JSON.stringify({ gameId: newProfile.gameId, name: newProfile.name.trim(), kind: 'custom', math: { targetRtp: Number(newProfile.targetRtp), volatility: newProfile.volatility, hitBias: Number(newProfile.hitBias), bonusBias: Number(newProfile.bonusBias) }, experience: { celebration: newProfile.celebration }, reason: 'Muharrem Pehlevan özel profil oluşturdu' }) })
      setNewProfile((current) => ({ ...current, name: '' })); setNotice('Yeni sürümlü oyun profili oluşturuldu.'); await load()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Profil oluşturulamadı.') }
    finally { setBusy('') }
  }

  const pending = users.filter((user) => user.status === 'pending')
  return <div className="account-admin">
    <div className="admin-section-intro">
      <div><small>GERÇEK HESAP DİZİNİ</small><h2>Üyelik, onay ve cüzdanlar</h2><p>Her hesap bağımsız bakiye, oturum ve oyun geçmişi taşır. Bütün cüzdan işlemleri denetim kaydına yazılır.</p></div>
      <button className="account-refresh" onClick={() => void load().catch((error) => setNotice(error.message))}>YENİLE</button>
    </div>
    {notice && <div className="account-notice">{notice}</div>}
    {currentUser.role === 'owner' && <details className="profile-creator"><summary>YENİ KULLANICI OYUN PROFİLİ OLUŞTUR</summary><div><label>Oyun<select value={newProfile.gameId} onChange={(event) => setNewProfile((current) => ({ ...current, gameId: event.target.value }))}>{Object.entries(gameNames).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><label>Profil adı<input value={newProfile.name} placeholder="Örn. Festival Demo" onChange={(event) => setNewProfile((current) => ({ ...current, name: event.target.value }))}/></label><label>Hedef RTP<input inputMode="decimal" value={newProfile.targetRtp} onChange={(event) => setNewProfile((current) => ({ ...current, targetRtp: event.target.value }))}/></label><label>Volatilite<select value={newProfile.volatility} onChange={(event) => setNewProfile((current) => ({ ...current, volatility: event.target.value }))}><option>düşük</option><option>orta</option><option>yüksek</option><option>çok yüksek</option></select></label><label>Hit ağırlığı<input inputMode="decimal" value={newProfile.hitBias} onChange={(event) => setNewProfile((current) => ({ ...current, hitBias: event.target.value }))}/></label><label>Bonus ağırlığı<input inputMode="decimal" value={newProfile.bonusBias} onChange={(event) => setNewProfile((current) => ({ ...current, bonusBias: event.target.value }))}/></label><label>Kutlama ritmi<select value={newProfile.celebration} onChange={(event) => setNewProfile((current) => ({ ...current, celebration: event.target.value }))}><option value="sakin">Sakin</option><option value="dengeli">Dengeli</option><option value="festival">Festival</option></select></label><button disabled={Boolean(busy)} onClick={() => void createProfile()}>SÜRÜMLÜ PROFİLİ KAYDET</button></div><p>Profil değişikliği yalnız sonraki turlara uygulanır ve Muharrem Pehlevan denetim kaydına yazılır.</p></details>}
    {pending.length > 0 && <section className="pending-accounts"><header><span>ONAY BEKLEYEN BAŞVURULAR</span><b>{pending.length}</b></header>{pending.map((user) => <article key={user.id}>
      <div className="account-identity"><i>{user.displayName.slice(0, 2).toLocaleUpperCase('tr-TR')}</i><span><b>{user.displayName}</b><small>@{user.username} · {user.registrationNote || 'Not bırakılmadı'}</small></span></div>
      <label>Başlangıç bakiyesi<input inputMode="decimal" value={amounts[user.id] ?? String(defaultStartingPiar)} onChange={(event) => setAmounts((current) => ({ ...current, [user.id]: event.target.value }))} /><em>PR</em></label>
      <label>İşlem notu<input value={reasons[user.id] ?? ''} placeholder="Üyelik onayı" onChange={(event) => setReasons((current) => ({ ...current, [user.id]: event.target.value }))} /></label>
      <div className="account-actions"><button disabled={Boolean(busy)} onClick={() => void action(user, 'approve')}>ONAYLA</button><button className="danger" disabled={Boolean(busy)} onClick={() => void action(user, 'reject')}>REDDET</button></div>
    </article>)}</section>}
    <section className="real-user-table">
      <header><span>KULLANICI</span><span>YETKİ / DURUM</span><span>CÜZDAN</span><span>BAKİYE İŞLEMİ</span><span>OTURUM</span></header>
      {users.map((user) => <Fragment key={user.id}><article>
        <div className="account-identity"><i>{user.displayName.slice(0, 2).toLocaleUpperCase('tr-TR')}</i><span><b>{user.displayName}</b><small>@{user.username}</small></span></div>
        <div className="account-state">{user.role === 'owner' ? <b>MUHARREM PEHLEVAN</b> : <select value={user.role} disabled={Boolean(busy)} onChange={(event) => void changeRole(user, event.target.value as 'admin' | 'player')}><option value="player">PLAYER</option><option value="admin">ADMIN</option></select>}<button disabled={user.role === 'owner' || Boolean(busy)} onClick={() => void action(user, user.status === 'active' ? 'suspend' : 'activate')}>{user.status === 'active' ? 'AKTİF' : user.status.toLocaleUpperCase('tr-TR')}</button></div>
        <strong className="account-balance">{money.format(user.balance)} <small>PR</small></strong>
        <div className="wallet-adjust"><input inputMode="decimal" placeholder="+ / - tutar" value={amounts[user.id] ?? ''} onChange={(event) => setAmounts((current) => ({ ...current, [user.id]: event.target.value }))}/><input placeholder="Sebep" value={reasons[user.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [user.id]: event.target.value }))}/><button disabled={Boolean(busy) || !Number(amounts[user.id])} onClick={() => void action(user, 'wallet')}>UYGULA</button></div>
        <span className="session-count">{user.activeSessions} aktif<small>{user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString('tr-TR') : 'Henüz giriş yok'}</small><button onClick={() => setExpandedUser((current) => current === user.id ? '' : user.id)}>{expandedUser === user.id ? 'KAPAT' : 'OYUN PROFİLLERİ'}</button></span>
      </article>{expandedUser === user.id && <section className="user-profile-editor"><div><small>KULLANICIYA ÖZEL PROFİL</small><b>{user.displayName}</b></div><label>Oyun<select value={profileGame[user.id] ?? 'neon-kasasi'} onChange={(event) => { const gameId = event.target.value; setProfileGame((current) => ({ ...current, [user.id]: gameId })); setSelectedProfile((current) => ({ ...current, [user.id]: profiles.find((profile) => profile.gameId === gameId)?.id ?? '' })) }}>{Object.entries(gameNames).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><label>Profil<select value={selectedProfile[user.id] ?? profiles.find((profile) => profile.gameId === (profileGame[user.id] ?? 'neon-kasasi'))?.id ?? ''} onChange={(event) => setSelectedProfile((current) => ({ ...current, [user.id]: event.target.value }))}>{profiles.filter((profile) => profile.gameId === (profileGame[user.id] ?? 'neon-kasasi')).map((profile) => <option value={profile.id} key={profile.id}>{profile.name} · v{profile.version}</option>)}</select></label><button disabled={Boolean(busy)} onClick={() => void assignProfile(user)}>PROFİLİ ATA</button><div className="profile-assignment-list">{assignments.filter((entry) => entry.userId === user.id).map((entry) => <span key={entry.gameId}><b>{gameNames[entry.gameId] ?? entry.gameId}</b><small>{profiles.find((profile) => profile.id === entry.profileId)?.name ?? entry.profileId}</small></span>)}</div></section>}</Fragment>)}
    </section>
    <details className="account-audit"><summary>SON MUHARREM PEHLEVAN / ADMIN İŞLEMLERİ · {audit.length}</summary><div>{audit.slice(0, 20).map((record) => <span key={record.id}><i>{record.action}</i><b>{users.find((user) => user.id === record.target_user_id)?.displayName ?? record.entity_type}</b><small>{record.reason || 'Sebep kaydı yok'} · {new Date(record.occurred_at).toLocaleString('tr-TR')}</small></span>)}</div></details>
  </div>
}
