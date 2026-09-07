import { useEffect, useState } from 'react';
import { accountRequest } from '../auth/auth-api';
import { getAdminSettings } from '../data/casino-admin';
import type { CasinoGameId } from '../data/casino-database';
import './owner-activity.css';

type Report = {
  generatedAt: string; selected: string; hasMore: boolean;
  users: { id: string; name: string; username: string; lastSeenAt: string; balanceMicro: string }[];
  games: { game: string; rounds: number; stake: number; payout: number; net: number }[];
  rounds: { id: string; game: string; time: string; stake: number; payout: number; net: number; outcome: string }[];
  movements: { id: string; game: string; time: string; type: string; reason: string; amountMicro: string; balanceMicro: string }[];
};
const money = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const date = (s: string) => s ? new Date(s).toLocaleString('tr-TR') : 'Henüz yok';
const gameName = (id: string) => getAdminSettings().games[id as CasinoGameId]?.name ?? id ?? 'Cüzdan';

export default function OwnerActivity() {
  const [report, setReport] = useState<Report>();
  const [user, setUser] = useState('');
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true, inFlight = false;
    setReport(undefined);
    const load = async () => {
      if (!active || inFlight || document.hidden) return;
      inFlight = true; setBusy(true);
      try {
        const next = await accountRequest<Report>(`/api/casino-data/owner-activity?days=${days}&page=${page}&user=${encodeURIComponent(user)}`);
        if (active) { setReport(next); setError(''); }
      } catch { if (active) setError('Hareketler yüklenemedi. Yeniden deneyin.'); }
      finally { inFlight = false; if (active) setBusy(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    document.addEventListener('visibilitychange', load);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [user, days, page, refresh]);
  const totals = report?.games.reduce((a, g) => ({ rounds: a.rounds + g.rounds, stake: a.stake + g.stake, payout: a.payout + g.payout, net: a.net + g.net }), { rounds: 0, stake: 0, payout: 0, net: 0 });
  return <section className="owner-activity">
    <div className="admin-section-intro"><div><small>OWNER · OYUNCU TAKİBİ</small><h2>Oyunlar, kazançlar ve hareketler</h2><p>Oyuncu seçerek dönem toplamlarını ve son 40 kaydı inceleyin. Görünürken 30 saniyede bir yenilenir.</p></div><button disabled={busy} onClick={() => setRefresh(v => v + 1)}>{busy ? 'Yükleniyor…' : 'Yenile'}</button></div>
    <div className="owner-filters"><label>Oyuncu<select value={user || report?.selected || ''} onChange={e => setUser(e.target.value)}>{report?.users.map(u => <option value={u.id} key={u.id}>{u.name} · @{u.username}</option>)}</select></label><label>Dönem<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={1}>Son 24 saat</option><option value={7}>Son 7 gün</option><option value={30}>Son 30 gün</option></select></label><button disabled={!page || busy} onClick={() => { setPage(p => p - 1); setUser(''); }}>Önceki kullanıcılar</button><button disabled={!report?.hasMore || busy} onClick={() => { setPage(p => p + 1); setUser(''); }}>Sonraki kullanıcılar</button></div>
    {error && <p role="alert">{error}</p>}
    {report && <>
      <p>{report.users.find(u => u.id === report.selected)?.name} · Bakiye: {money(Number(report.users.find(u => u.id === report.selected)?.balanceMicro ?? 0) / 1e6)} PR · Son görülme: {date(report.users.find(u => u.id === report.selected)?.lastSeenAt ?? '')}</p>
      <div className="owner-totals">{[['Tur', totals?.rounds], ['Bahis', totals?.stake], ['Brüt ödeme', totals?.payout], ['Oyuncu neti', totals?.net]].map(([label, value]) => <article key={label}><small>{label}</small><strong>{money(Number(value ?? 0))}</strong></article>)}</div>
      <h3>Oyun bazında dönem toplamı</h3><div className="owner-scroll"><table><thead><tr><th>Oyun</th><th>Tur</th><th>Bahis</th><th>Brüt ödeme</th><th>Net</th></tr></thead><tbody>{report.games.map(g => <tr key={g.game}><td>{gameName(g.game)}</td><td>{g.rounds}</td><td>{money(g.stake)}</td><td>{money(g.payout)}</td><td>{money(g.net)}</td></tr>)}</tbody></table></div>
      {!report.games.length && <p>Bu dönemde tamamlanan oyuncu turu yok.</p>}
      <h3>Son oyunlar</h3><div className="owner-scroll"><table><thead><tr><th>Zaman</th><th>Oyun</th><th>Bahis</th><th>Ödeme</th><th>Net</th></tr></thead><tbody>{report.rounds.map(r => <tr key={r.id}><td>{date(r.time)}</td><td>{gameName(r.game)}</td><td>{money(r.stake)}</td><td>{money(r.payout)}</td><td>{money(r.net)}</td></tr>)}</tbody></table></div>
      <h3>Son cüzdan hareketleri</h3><div className="owner-scroll"><table><thead><tr><th>Zaman</th><th>Oyun / işlem</th><th>Açıklama</th><th>Tutar</th><th>Bakiye</th></tr></thead><tbody>{report.movements.map(m => <tr key={m.id}><td>{date(m.time)}</td><td>{gameName(m.game)} · {m.type}</td><td>{m.reason}</td><td>{money(Number(m.amountMicro) / 1e6)}</td><td>{money(Number(m.balanceMicro) / 1e6)}</td></tr>)}</tbody></table></div>
      <small>Son güncelleme: {date(report.generatedAt)} · Tutarlar sanal PR birimindedir.</small>
    </>}
  </section>;
}
