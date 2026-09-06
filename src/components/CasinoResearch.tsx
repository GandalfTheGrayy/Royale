import { useEffect, useState } from 'react'
import { exportCasinoResearchJson, exportCasinoRoundsCsv, getCasinoRounds, getCasinoSummary, getSlotMathAudits, subscribeCasinoDatabase, type CasinoRoundRecord, type CasinoSummary, type SlotMathAudit } from '../data/casino-database'

type Props = { onClose: () => void }
const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const gameNames = { blackjack: 'Blackjack', roulette: 'Canlı Rulet', poker: 'Midnight Poker', 'kiraz-77': 'Kiraz 77', 'neon-kasasi': 'Neon Kasası', 'kaptan-mercan': 'Kaptan Mercan', 'sekerhane-1024': 'Şekerhane 1024', 'allahin-lutfu': 'Allah’ın Lütfu', 'baykus-madeni': 'Baykuş Madeni', 'altin-rota': 'Altın Rota', limbo: 'Owl Oracle Limbo', 'obsidyen-damari': 'Obsidyen Damarı', mines: 'Mines', keno: 'Owl Star Map Keno', 'son-on': 'Son On', plinko: 'Pirinç Galeri Plinko', hilo: 'Hilo', 'yedi-cevher': 'Yedi Cevher' }

export default function CasinoResearch({ onClose }: Props) {
  const [summary, setSummary] = useState<CasinoSummary>()
  const [rounds, setRounds] = useState<CasinoRoundRecord[]>([])
  const [slotAudits, setSlotAudits] = useState<SlotMathAudit[]>([])

  useEffect(() => {
    let active = true
    const refresh = () => void Promise.all([getCasinoSummary(), getCasinoRounds(), getSlotMathAudits()]).then(([nextSummary, nextRounds, nextSlotAudits]) => {
      if (!active) return
      setSummary(nextSummary)
      setRounds(nextRounds.slice(0, 14))
      setSlotAudits(nextSlotAudits)
    })
    refresh()
    const unsubscribe = subscribeCasinoDatabase(refresh)
    return () => { active = false; unsubscribe() }
  }, [])

  return <div className="research-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="research-panel" role="dialog" aria-modal="true" aria-label="Casino araştırma veritabanı">
      <header><div><small>PEHLEVAN ROYALE · HESAP KAPSAMLI SQLITE</small><h2>Oyun araştırma kasası</h2><p>Bu hesaba ait turlar, canlı masa sonuçları, çarpanlar ve cüzdan hareketleri ortak yerel sunucuda kalıcı tutulur.</p></div><button onClick={onClose} aria-label="Veri merkezini kapat">×</button></header>
      <div className="research-actions"><button onClick={() => void exportCasinoResearchJson()}>JSON yedeği indir</button><button onClick={() => void exportCasinoRoundsCsv()}>Turları CSV indir</button><span>Canlı rulet uygulama açıkken 30 saniyede bir kayıt üretir.</span></div>
      <div className="research-kpis">
        <article><small>OYUNCU TURLARI</small><strong>{summary?.playedRounds ?? 0}</strong><span>{summary?.liveRounds ?? 0} canlı masa turu ayrıca kayıtlı</span></article>
        <article><small>TOPLAM HARCAMA</small><strong>{money.format(summary?.totalStake ?? 0)} <em>PR</em></strong><span>{summary?.wins ?? 0} kazanç · {summary?.losses ?? 0} kayıp · {summary?.pushes ?? 0} beraberlik</span></article>
        <article><small>TOPLAM GERİ DÖNÜŞ</small><strong>{money.format(summary?.totalPayout ?? 0)} <em>PR</em></strong><span>Gözlenen RTP %{money.format((summary?.rtp ?? 0) * 100)}</span></article>
        <article className={(summary?.net ?? 0) >= 0 ? 'positive' : 'negative'}><small>OYUNCU NETİ</small><strong>{(summary?.net ?? 0) > 0 ? '+' : (summary?.net ?? 0) < 0 ? '−' : ''}{money.format(Math.abs(summary?.net ?? 0))} <em>PR</em></strong><span>Ödeme eksi masaya konan</span></article>
      </div>
      <section className="slot-audit"><header><span>SLOT MATEMATİĞİ TEŞHİSİ</span><small>GERÇEK KAYIT · BASE / FREE SPIN AYRI</small></header><div>{slotAudits.map((audit) => <article key={audit.game}><header><strong>{gameNames[audit.game]}</strong><small>{audit.sampleWarning ? 'Örneklem küçük; yön gösterir' : 'Örneklem yeterli'}</small></header><div className="slot-audit-grid"><span><small>BASE SPİN</small><b>{audit.paidBase.spins}</b></span><span><small>BASE HIT</small><b>%{money.format(audit.paidBase.hitRate * 100)}</b></span><span><small>BOŞ SPİN</small><b>%{money.format(audit.paidBase.zeroRate * 100)}</b></span><span><small>EN UZUN BOŞ SERİ</small><b>{audit.paidBase.longestZeroStreak}</b></span><span><small>BAHİSİ ÇIKARAN</small><b>%{money.format(audit.paidBase.stakeReturnRate * 100)}</b></span><span><small>BASE GÖZLENEN RTP</small><b>%{money.format(audit.paidBase.observedRtp * 100)}</b></span><span><small>FREE SPİN HIT</small><b>%{money.format(audit.freeSpins.hitRate * 100)}</b></span><span><small>FREE SPİN P99 / MAX</small><b>{money.format(audit.freeSpins.p99WinX)}× / {money.format(audit.freeSpins.maxWinX)}×</b></span></div><footer>{audit.naturalBonusTriggers} doğal giriş · {audit.bonusBuys} satın alma · {audit.bonusSessions} tamamlanan/aktif bonus oturumu</footer></article>)}</div></section>
      <div className="research-body">
        <section className="research-games"><header><span>OYUN BAZINDA</span><small>OYUNCU TURLARI · RTP · NET</small></header>{summary?.byGame.length ? summary.byGame.map((game) => <article key={game.game}><div><strong>{gameNames[game.game]}</strong><small>{game.playedRounds} oynanan · {game.rounds - game.playedRounds} arka plan</small></div><span><small>BAHİS</small><b>{money.format(game.totalStake)} PR</b></span><span><small>RTP</small><b>%{money.format(game.rtp * 100)}</b></span><em className={game.net >= 0 ? 'up' : 'down'}>{game.net > 0 ? '+' : game.net < 0 ? '−' : ''}{money.format(Math.abs(game.net))} PR</em></article>) : <p>İlk sonuç bekleniyor. Canlı rulet açık kaldığı sürece burası kendiliğinden dolacak.</p>}</section>
        <section className="research-rounds"><header><span>SON KAYITLAR</span><small>HAM SONUÇLAR JSON YEDEĞİNDE</small></header>{rounds.length ? rounds.map((round) => <article key={round.id}><i className={round.outcome}>{round.game === 'roulette' ? String(round.result.number ?? 'R') : round.outcome === 'win' ? 'W' : round.outcome === 'loss' ? 'L' : '·'}</i><div><strong>{gameNames[round.game]}</strong><small>{new Date(round.settledAt).toLocaleTimeString('tr-TR')} · {round.source === 'live-table' ? 'arka plan canlı masa' : round.variant}</small></div><span>{round.playerParticipated ? `${round.net > 0 ? '+' : round.net < 0 ? '−' : ''}${money.format(Math.abs(round.net))} PR` : 'KAYIT'}</span></article>) : <p>Henüz veritabanı kaydı yok.</p>}</section>
      </div>
      <footer>Veritabanı: <b>pehlevan-royale-research</b> · tablolar: <b>game_rounds</b>, <b>wallet_ledger</b>, <b>game_events</b>, <b>meta</b></footer>
    </section>
  </div>
}
