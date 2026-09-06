import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import GameMusicControls from '../../audio/GameMusicControls'
import { playGameSfx } from '../../audio/game-sfx'
import { useAuth } from '../../auth/auth-client'
import { getAdminSettings } from '../../data/casino-admin'
import { createRecordId, getCasinoRounds, recordGameEvent, recordGameRound, recordWalletEntry, type CasinoRoundRecord } from '../../data/casino-database'
import { shouldStopAutoBet } from '../originals/auto-bet'
import { AutoBetControls, BetAmountControl, type AutoBetUiState } from '../originals/OriginalsBetControls'
import '../originals/originals.css'
import { createYediCevherRound, gemPayoutTable, verifyYediCevherRound, type GemId, type YediCevherRound } from './yedi-cevher-engine'
import './yedi-cevher.css'

type Props = { balance: number; setBalance: Dispatch<SetStateAction<number>>; onExit: () => void; onBackToWorld: () => void }
const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const accountKey = (userId: string, key: string) => `account:${userId}:${key}`

const gemNames: Record<GemId, string> = {
  emerald: 'Zümrüt', amethyst: 'Ametist', citrine: 'Sitrin', ruby: 'Yakut', cyan: 'Akuamarin', rose: 'Pembe Safir', sapphire: 'Safir',
}

function randomClientSeed() {
  const bytes = new Uint8Array(12); crypto.getRandomValues(bytes)
  return `cevher-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function Gem({ id, index = 0, muted = false }: { id: GemId; index?: number; muted?: boolean }) {
  return <i className={`yc-gem ${id} ${muted ? 'muted' : ''}`} style={{ '--gem-index': index } as CSSProperties}><span /></i>
}

function recordGems(item: CasinoRoundRecord) {
  return (Array.isArray(item.result.gems) ? item.result.gems : []) as GemId[]
}

export default function YediCevherRoom({ balance, setBalance, onExit, onBackToWorld }: Props) {
  const { user } = useAuth()
  const game = getAdminSettings().games['yedi-cevher']
  const [bet, setBet] = useState(game.defaultBet)
  const [round, setRound] = useState<YediCevherRound | null>(null)
  const [history, setHistory] = useState<CasinoRoundRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState(5)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [fairOpen, setFairOpen] = useState(false)
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual')
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoState, setAutoState] = useState<AutoBetUiState>({ rounds: 10, stopProfit: 0, stopLoss: 0, played: 0, profit: 0 })
  const balanceRef = useRef(balance); balanceRef.current = balance
  const actionLockRef = useRef(false)
  const autoCancelRef = useRef(false)
  const paytable = useMemo(() => gemPayoutTable(game.targetRtp), [game.targetRtp])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
    void getCasinoRounds().then((records) => setHistory(records.filter((item) => item.game === 'yedi-cevher').slice(0, 7)))
  }, [])

  const playOnce = async (): Promise<number | null> => {
    if (actionLockRef.current) return null
    const stake = Math.round(Math.max(game.minBet, bet) * 100) / 100
    if (stake > balanceRef.current) return null
    actionLockRef.current = true; setBusy(true); setVerifyState('idle'); setRevealed(0)
    const seedKey = accountKey(user.id, 'yedi-cevher-client-seed-v1')
    const nonceKey = accountKey(user.id, 'yedi-cevher-nonce-v1')
    const clientSeed = localStorage.getItem(seedKey) ?? randomClientSeed(); localStorage.setItem(seedKey, clientSeed)
    const nonce = Number(localStorage.getItem(nonceKey) ?? '0') + 1; localStorage.setItem(nonceKey, String(nonce))
    try {
      const created = await createYediCevherRound({ stake, rtp: game.targetRtp, clientSeed, nonce })
      const before = balanceRef.current
      setBalance((value) => value - stake); balanceRef.current -= stake
      setRound(created)
      const stakeWrite = recordWalletEntry({ id: createRecordId('wallet-yedi-cevher-stake', created.roundId), roundId: created.roundId, game: 'yedi-cevher', occurredAt: created.startedAt, type: 'stake', amount: -stake, balanceBefore: before, balanceAfter: before - stake, note: 'Yedi Cevher tur bahsi' })
      const commitWrite = recordGameEvent({ id: createRecordId('event-yedi-cevher-commit', created.roundId), roundId: created.roundId, game: 'yedi-cevher', occurredAt: created.startedAt, type: 'yedi-cevher-round-committed', payload: { commitment: created.commitment, nonce } })
      for (let index = 0; index < 5; index += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 105))
        setRevealed(index + 1)
        playGameSfx('yedi-cevher', '/assets/audio/chip-lay.ogg', .2 + index * .035, .82 + index * .06)
      }
      if (created.grossPayout > 0) { setBalance((value) => value + created.grossPayout); balanceRef.current += created.grossPayout }
      const outcome = created.grossPayout > stake ? 'win' : created.grossPayout === stake ? 'push' : 'loss'
      const record: CasinoRoundRecord = {
        id: createRecordId('round-yedi-cevher', created.roundId), roundId: created.roundId, game: 'yedi-cevher', variant: 'Yedi renk · beş cevher', source: 'player', playerParticipated: true,
        startedAt: created.startedAt, settledAt: created.settledAt, stake, grossPayout: created.grossPayout, net: created.grossPayout - stake, outcome,
        balanceBefore: before, balanceAfter: before - stake + created.grossPayout,
        result: { telemetryVersion: 1, gems: created.gems, combination: created.combination, multiplier: created.multiplier, algorithm: created.algorithm, clientSeed, serverSeed: created.serverSeed, nonce, commitment: created.commitment, digest: created.digest },
        modifiers: { targetRtp: created.rtp, totalOutcomes: 16_807 },
      }
      const writes: Promise<unknown>[] = [stakeWrite, commitWrite, recordGameRound(record), recordGameEvent({ id: createRecordId('event-yedi-cevher-settle', created.roundId), roundId: created.roundId, game: 'yedi-cevher', occurredAt: created.settledAt, type: 'yedi-cevher-round-settled', payload: { gems: created.gems, combination: created.combination, multiplier: created.multiplier, payout: created.grossPayout } })]
      if (created.grossPayout > 0) writes.push(recordWalletEntry({ id: createRecordId('wallet-yedi-cevher-payout', created.roundId), roundId: created.roundId, game: 'yedi-cevher', occurredAt: created.settledAt, type: 'payout', amount: created.grossPayout, balanceBefore: before - stake, balanceAfter: before - stake + created.grossPayout, note: `Yedi Cevher · ${created.multiplier.toFixed(2)}x ${paytable.find((row) => row.combination === created.combination)?.label}` }))
      await Promise.all(writes)
      setHistory((items) => [record, ...items].slice(0, 7))
      if (created.multiplier >= 2) playGameSfx('yedi-cevher', '/assets/audio/roulette-payout.ogg', created.multiplier >= 5 ? .58 : .4, created.multiplier >= 5 ? 1.12 : 1)
      return created.grossPayout - stake
    } finally { actionLockRef.current = false; setBusy(false) }
  }

  const runAuto = async () => {
    if (autoRunning) return
    autoCancelRef.current = false; setAutoRunning(true); let played = 0; let profit = 0; setAutoState((state) => ({ ...state, played: 0, profit: 0 }))
    try {
      while (!autoCancelRef.current) {
        const net = await playOnce(); if (net === null) break
        played += 1; profit = Math.round((profit + net) * 100) / 100; setAutoState((state) => ({ ...state, played, profit }))
        if (shouldStopAutoBet(played, profit, autoState)) break
        await new Promise((resolve) => window.setTimeout(resolve, 220))
      }
    } finally { setAutoRunning(false) }
  }

  const verify = async () => { if (!round) return; setVerifyState('checking'); setVerifyState(await verifyYediCevherRound(round) ? 'ok' : 'fail') }
  const activeRow = round ? paytable.find((row) => row.combination === round.combination) : null
  const net = round ? round.grossPayout - round.stake : 0

  return <main className="originals-room yedi-cevher-room">
    <header className="originals-topbar"><button onClick={onBackToWorld}>← Anlık Oyunlar</button><div className="originals-brand"><small>CASINO ORIGINALS · YEDİ CEVHER</small><strong>BAYKUŞUN MÜHRÜ</strong></div><div className="originals-top-actions"><GameMusicControls game="yedi-cevher"/><button onClick={() => setRulesOpen(true)}>OYUN BİLGİSİ</button><button onClick={onExit}>SALONLAR</button><span className="originals-balance">✦ {money.format(balance)} <small>PR</small></span></div></header>
    <div className="yc-shell">
      <section className={`yc-stage ${busy ? 'revealing' : ''} ${round?.combination ?? 'idle'}`} aria-live="polite">
        <div className="yc-backdrop" />
        <div className="yc-title"><img src="/assets/instant/yedi-cevher/yedi-cevher-emblem-v1.png" alt=""/><div><small>BAYKUŞUN MÜHRÜ</small><strong>{busy ? 'CEVHERLER DÜŞÜYOR' : activeRow ? activeRow.label : 'BEŞ TAŞ · TEK HÜKÜM'}</strong><span>{round && !busy ? `${round.multiplier.toFixed(2)}× · ${net >= 0 ? '+' : ''}${money.format(net)} PR` : 'Yedi renkten doğan kombinasyonu aç'}</span></div></div>
        <div className="yc-slots">
          {Array.from({ length: 5 }, (_, index) => <div className="yc-slot" key={index}>{round && index < revealed ? <Gem id={round.gems[index]} index={index}/> : <i className="yc-seal"><span>✦</span></i>}<small>{round && index < revealed ? gemNames[round.gems[index]] : `MÜHÜR ${index + 1}`}</small></div>)}
        </div>
        <div className="yc-result"><span>{busy ? `${revealed} / 5` : round ? activeRow?.label : 'HAZIR'}</span><strong>{busy ? '…' : round ? `${round.multiplier.toFixed(2)}×` : '✦'}</strong><small>{round && !busy ? round.gems.map((gem) => gemNames[gem]).join(' · ') : 'Sonuç tek dokunuşta belirlenir'}</small></div>
      </section>
      <aside className="yc-side">
        <section className="originals-control-card"><small className="originals-kicker">CEVHER BAHİSİ</small><h2>Beş mührü aynı anda aç.</h2><BetAmountControl value={bet} onChange={setBet} min={game.minBet} balance={balance} disabled={busy || autoRunning}/><AutoBetControls mode={betMode} setMode={setBetMode} state={autoState} setState={setAutoState} running={autoRunning} disabled={busy} onStop={() => { autoCancelRef.current = true }}/><button className="originals-primary yc-play" disabled={busy || autoRunning || bet > balance || balance < game.minBet} onClick={() => betMode === 'auto' ? void runAuto() : void playOnce()}>{autoRunning ? `AUTO · ${autoState.played}/${autoState.rounds}` : busy ? `MÜHÜRLER AÇILIYOR · ${revealed}/5` : betMode === 'auto' ? `AUTO BET · ${autoState.rounds} TUR` : 'BET · BEŞ CEVHERİ AÇ'}</button><p className="originals-note">Her taş yedi renkten eşit olasılıkla gelir. Aynı renklerin oluşturduğu kombinasyon otomatik ödenir.</p></section>
        <section className="yc-paytable"><header><strong>ÖDEME MÜHRÜ</strong><button disabled={!round} onClick={() => setFairOpen(true)}>DOĞRULA</button></header>{[...paytable].reverse().map((row) => <div key={row.combination} className={round && !busy && round.combination === row.combination ? 'active' : ''}><span><b>{row.label}</b><small>%{(row.probability * 100).toFixed(row.probability < .01 ? 3 : 2)}</small></span><strong>{row.multiplier.toFixed(row.multiplier < 1 ? 2 : 0)}×</strong></div>)}</section>
        <section className="originals-history-card yc-history"><header><strong>SON MÜHÜRLER</strong><span>RTP %{game.targetRtp.toFixed(2)}</span></header>{history.length ? history.slice(0, 4).map((item) => <article key={item.id} className={item.outcome}><div><span className="yc-mini-gems">{recordGems(item).map((gem, index) => <Gem id={gem} index={index} key={`${gem}-${index}`}/>)}</span><small>{paytable.find((row) => row.combination === item.result.combination)?.label}</small></div><span>{Number(item.result.multiplier ?? 0).toFixed(2)}×<small>{item.net >= 0 ? '+' : ''}{money.format(item.net)} PR</small></span></article>) : <p className="originals-note">İlk cevher dizilimin burada görünecek.</p>}</section>
      </aside>
    </div>
    {rulesOpen && <div className="originals-modal-backdrop" onClick={() => setRulesOpen(false)}><section className="originals-modal" onClick={(event) => event.stopPropagation()}><button onClick={() => setRulesOpen(false)}>×</button><h2>Yedi Cevher nasıl oynanır?</h2><h3>Tek tık, beş taş</h3><p>Bahsini belirle ve beş mührü aç. Her konuma yedi cevher renginden biri bağımsız ve eşit olasılıkla gelir.</p><h3>Kombinasyonlar</h3><p>Bir çiftten beş aynı cevhere kadar eşleşmeler ödeme tablosuna göre değerlendirilir. Bir çift 0,10× geri ödeme sağlar; net kâr değildir. En yüksek sonuç beş aynı renk ile 50×’tir.</p><h3>Adil sonuç</h3><p>Beş sonuç HMAC-SHA256, client seed, nonce ve önceden taahhüt edilen server seed ile üretilir. Toplam 16.807 eş olasılıklı dizilim vardır.</p></section></div>}
    {fairOpen && <div className="originals-modal-backdrop" onClick={() => setFairOpen(false)}><section className="originals-modal" onClick={(event) => event.stopPropagation()}><button onClick={() => setFairOpen(false)}>×</button><h2>Doğrulanabilir mühür</h2>{round ? <><p>Algoritma: {round.algorithm}</p><code>{round.commitment}</code><p>Nonce: {round.nonce} · Client seed: {round.clientSeed}</p><button className="originals-primary" onClick={() => void verify()}>{verifyState === 'checking' ? 'KONTROL EDİLİYOR…' : verifyState === 'ok' ? '✓ TUR DOĞRULANDI' : verifyState === 'fail' ? 'DOĞRULAMA BAŞARISIZ' : 'TURU DOĞRULA'}</button></> : <p>Henüz tamamlanmış tur yok.</p>}</section></div>}
  </main>
}
