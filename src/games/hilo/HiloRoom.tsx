import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import GameMusicControls from '../../audio/GameMusicControls'
import { playGameSfx } from '../../audio/game-sfx'
import { useAuth } from '../../auth/auth-client'
import { getAdminSettings } from '../../data/casino-admin'
import {
  createRecordId,
  getCasinoRounds,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
  type CasinoRoundRecord,
} from '../../data/casino-database'
import { BetAmountControl } from '../originals/OriginalsBetControls'
import '../originals/originals.css'
import {
  cashOutHilo,
  createHiloRound,
  guessHilo,
  hiloCardLabel,
  hiloOdds,
  verifyHiloRound,
  type HiloCard,
  type HiloGuess,
  type HiloRound,
} from './hilo-engine'
import './hilo.css'

type Props = {
  balance: number
  setBalance: Dispatch<SetStateAction<number>>
  onExit: () => void
  onBackToWorld: () => void
}

const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const accountKey = (userId: string, key: string) => `account:${userId}:${key}`

function randomClientSeed() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return `hilo-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function cardImage(card: HiloCard) {
  const rankNames: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king', 14: 'ace' }
  const rank = rankNames[card.rank] ?? String(card.rank)
  return `/assets/cards/opendecks-game/card fronts/${card.suit}/${rank} of ${card.suit}.png`
}

function suitMark(suit: HiloCard['suit']) {
  return { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[suit]
}

function historyCards(item: CasinoRoundRecord) {
  const first = item.result.firstCard as HiloCard | undefined
  const last = item.result.lastCard as HiloCard | undefined
  if (!first || !last) return '—'
  return `${hiloCardLabel(first)}${suitMark(first.suit)} → ${hiloCardLabel(last)}${suitMark(last.suit)}`
}

export default function HiloRoom({ balance, setBalance, onExit, onBackToWorld }: Props) {
  const { user } = useAuth()
  const game = getAdminSettings().games.hilo
  const [bet, setBet] = useState(game.defaultBet)
  const [round, setRound] = useState<HiloRound | null>(null)
  const [lastSettled, setLastSettled] = useState<HiloRound | null>(null)
  const [history, setHistory] = useState<CasinoRoundRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [fairOpen, setFairOpen] = useState(false)
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const balanceRef = useRef(balance)
  const roundRef = useRef<HiloRound | null>(round)
  const actionLockRef = useRef(false)
  const settledIdsRef = useRef(new Set<string>())
  balanceRef.current = balance
  roundRef.current = round

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
    void getCasinoRounds().then((records) => setHistory(records.filter((item) => item.game === 'hilo').slice(0, 7)))
  }, [])

  const odds = useMemo(() => round?.status === 'active' ? hiloOdds(round) : null, [round])
  const currentValue = round ? round.stake * round.multiplier : bet

  const settle = async (settled: HiloRound) => {
    if (settledIdsRef.current.has(settled.roundId)) return
    settledIdsRef.current.add(settled.roundId)
    const beforePayout = balanceRef.current
    if (settled.grossPayout > 0) {
      setBalance((value) => value + settled.grossPayout)
      balanceRef.current += settled.grossPayout
    }
    const outcome = settled.status === 'cashed-out'
      ? settled.grossPayout > settled.stake ? 'win' : settled.grossPayout === settled.stake ? 'push' : 'loss'
      : 'loss'
    const record: CasinoRoundRecord = {
      id: createRecordId('round-hilo', settled.roundId),
      roundId: settled.roundId,
      game: 'hilo',
      variant: 'Higher / Lower',
      source: 'player',
      playerParticipated: true,
      startedAt: settled.startedAt,
      settledAt: settled.settledAt ?? new Date().toISOString(),
      stake: settled.stake,
      grossPayout: settled.grossPayout,
      net: settled.grossPayout - settled.stake,
      outcome,
      balanceBefore: beforePayout + settled.stake,
      balanceAfter: beforePayout + settled.grossPayout,
      result: {
        telemetryVersion: 1,
        firstCard: settled.deck[0],
        lastCard: settled.currentCard,
        correctGuesses: settled.correctGuesses,
        multiplier: settled.multiplier,
        status: settled.status,
        lastResult: settled.lastResult,
        cards: settled.deck.slice(0, settled.position),
        commitment: settled.commitment,
        digest: settled.digest,
        algorithm: settled.algorithm,
        clientSeed: settled.clientSeed,
        serverSeed: settled.serverSeed,
        nonce: settled.nonce,
      },
      modifiers: { targetRtp: settled.rtp },
    }
    const writes: Promise<unknown>[] = [
      recordGameRound(record),
      recordGameEvent({
        id: createRecordId('event-hilo-settle', settled.roundId),
        roundId: settled.roundId,
        game: 'hilo',
        occurredAt: record.settledAt,
        type: 'hilo-round-settled',
        payload: { status: settled.status, correctGuesses: settled.correctGuesses, multiplier: settled.multiplier, payout: settled.grossPayout },
      }),
    ]
    if (settled.grossPayout > 0) writes.push(recordWalletEntry({
      id: createRecordId('wallet-hilo-payout', settled.roundId),
      roundId: settled.roundId,
      game: 'hilo',
      occurredAt: record.settledAt,
      type: 'payout',
      amount: settled.grossPayout,
      balanceBefore: beforePayout,
      balanceAfter: beforePayout + settled.grossPayout,
      note: `Hilo ${settled.multiplier.toFixed(2)}x kasa`,
    }))
    await Promise.all(writes)
    setHistory((items) => [record, ...items].slice(0, 7))
    setLastSettled(settled)
  }

  const startRound = async () => {
    if (actionLockRef.current || bet < game.minBet || bet > balanceRef.current) return
    actionLockRef.current = true
    setBusy(true)
    setVerifyState('idle')
    const stake = Math.round(Math.max(game.minBet, bet) * 100) / 100
    const seedKey = accountKey(user.id, 'hilo-client-seed-v1')
    const nonceKey = accountKey(user.id, 'hilo-nonce-v1')
    const clientSeed = localStorage.getItem(seedKey) ?? randomClientSeed()
    localStorage.setItem(seedKey, clientSeed)
    const nonce = Number(localStorage.getItem(nonceKey) ?? '0') + 1
    localStorage.setItem(nonceKey, String(nonce))
    try {
      const created = await createHiloRound({ stake, rtp: game.targetRtp, clientSeed, nonce })
      const before = balanceRef.current
      setBalance((value) => value - stake)
      balanceRef.current -= stake
      await Promise.all([
        recordWalletEntry({
          id: createRecordId('wallet-hilo-stake', created.roundId),
          roundId: created.roundId,
          game: 'hilo',
          occurredAt: created.startedAt,
          type: 'stake',
          amount: -stake,
          balanceBefore: before,
          balanceAfter: before - stake,
          note: 'Hilo tur bahsi',
        }),
        recordGameEvent({
          id: createRecordId('event-hilo-commit', created.roundId),
          roundId: created.roundId,
          game: 'hilo',
          occurredAt: created.startedAt,
          type: 'hilo-round-committed',
          payload: { commitment: created.commitment, nonce: created.nonce },
        }),
      ])
      setRound(created)
      playGameSfx('hilo', '/assets/audio/card-slide.ogg', .42)
    } finally {
      setBusy(false)
      actionLockRef.current = false
    }
  }

  const choose = async (guess: HiloGuess) => {
    const active = roundRef.current
    if (!active || active.status !== 'active' || actionLockRef.current) return
    const activeOdds = hiloOdds(active)
    if ((guess === 'higher' ? activeOdds.higherCards : activeOdds.lowerCards) === 0) return
    actionLockRef.current = true
    setBusy(true)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 230))
      const next = guessHilo(active, guess)
      setRound(next)
      roundRef.current = next
      playGameSfx('hilo', '/assets/audio/card-slide.ogg', .46, next.lastResult === 'correct' ? 1.08 : .9)
      if (next.status !== 'active') {
        playGameSfx('hilo', '/assets/audio/chip-lay.ogg', .4, .82)
        await settle(next)
      }
    } finally {
      setBusy(false)
      actionLockRef.current = false
    }
  }

  const cashOut = async () => {
    const active = roundRef.current
    if (!active || active.status !== 'active' || actionLockRef.current) return
    actionLockRef.current = true
    setBusy(true)
    try {
      const settled = cashOutHilo(active)
      setRound(settled)
      roundRef.current = settled
      playGameSfx('hilo', '/assets/audio/roulette-payout.ogg', .45)
      await settle(settled)
    } finally {
      setBusy(false)
      actionLockRef.current = false
    }
  }

  const leave = async (destination: 'world' | 'lobby') => {
    if (actionLockRef.current) return
    if (roundRef.current?.status === 'active') await cashOut()
    if (destination === 'world') onBackToWorld()
    else onExit()
  }

  const verify = async () => {
    if (!lastSettled) return
    setVerifyState('checking')
    setVerifyState(await verifyHiloRound(lastSettled) ? 'ok' : 'fail')
  }

  const active = round?.status === 'active'
  const resultMessage = !round
    ? 'İlk kartı aç, yönünü seç.'
    : round.status === 'lost'
      ? round.lastResult === 'tie' ? 'Aynı değer geldi — tur sona erdi.' : 'Tahmin tutmadı — tur sona erdi.'
      : round.status === 'cashed-out'
        ? `${money.format(round.grossPayout)} PR kasaya alındı.`
        : round.lastResult === 'correct'
          ? 'Doğru! Devam et veya kasaya al.'
          : 'Kart açık. Sıradaki daha yüksek mi, düşük mü?'

  return <main className="originals-room hilo-room">
    <header className="originals-topbar">
      <button onClick={() => void leave('world')}>← Anlık Oyunlar</button>
      <div className="originals-brand"><small>CASINO ORIGINALS · HILO</small><strong>YÜKSEK / DÜŞÜK</strong></div>
      <div className="originals-top-actions"><GameMusicControls game="hilo"/><button onClick={() => setRulesOpen(true)}>OYUN BİLGİSİ</button><button onClick={() => void leave('lobby')}>SALONLAR</button><span className="originals-balance">✦ {money.format(balance)} <small>PR</small></span></div>
    </header>

    <div className="hilo-shell">
      <section className={`hilo-table ${round?.status ?? 'ready'} ${busy ? 'dealing' : ''}`} aria-live="polite">
        <div className="hilo-table-pattern" />
        <div className="hilo-table-heading"><small>MEVCUT ÇARPAN</small><strong>{round ? round.multiplier.toFixed(2) : '1.00'}<em>×</em></strong><span>{round?.correctGuesses ?? 0} doğru tahmin</span></div>
        <div className="hilo-cards">
          {round?.previousCard && <div className="hilo-previous-card"><img src={cardImage(round.previousCard)} alt={`${hiloCardLabel(round.previousCard)} ${round.previousCard.suit}`} /><small>ÖNCEKİ</small></div>}
          <div className={`hilo-current-card ${round ? '' : 'empty'}`}>
            {round ? <img src={cardImage(round.currentCard)} alt={`${hiloCardLabel(round.currentCard)} ${round.currentCard.suit}`} /> : <div><b>H</b><span>?</span></div>}
            <small>MEVCUT KART</small>
          </div>
        </div>
        <p className="hilo-result-message">{resultMessage}</p>
        {active && odds && <div className="hilo-table-actions">
          <button className="lower" disabled={busy || odds.lowerCards === 0} onClick={() => void choose('lower')}><span>↓</span><b>DAHA DÜŞÜK</b><small>%{(odds.lowerChance * 100).toFixed(1)} · ×{odds.lowerFactor.toFixed(2)}</small></button>
          <button className="cash" disabled={busy} onClick={() => void cashOut()}><span>{money.format(currentValue)}</span><b>KASAYA AL</b><small>{round.multiplier.toFixed(2)}× · {round.correctGuesses} DOĞRU</small></button>
          <button className="higher" disabled={busy || odds.higherCards === 0} onClick={() => void choose('higher')}><span>↑</span><b>DAHA YÜKSEK</b><small>%{(odds.higherChance * 100).toFixed(1)} · ×{odds.higherFactor.toFixed(2)}</small></button>
        </div>}
        <footer><span>BERABERLİK KAYBETTİRİR</span><span>KALAN {odds?.remainingCards ?? 51} KART</span><span>RTP %{game.targetRtp}</span></footer>
      </section>

      <aside className="hilo-side">
        <section className="originals-control-card">
          <small className="originals-kicker">HIZLI TUR</small><h2>Riskini seç.</h2>
          <BetAmountControl value={bet} onChange={setBet} min={game.minBet} balance={balance} disabled={busy || active}/>
          {!active && <button className="originals-primary hilo-start" disabled={busy || bet > balance || balance < game.minBet} onClick={() => void startRound()}>{busy ? 'KART AÇILIYOR…' : round ? 'YENİ TUR · KARTI AÇ' : 'BAHİS YAP · KARTI AÇ'}</button>}
          {active && <div className="hilo-live-summary"><div><small>ANLIK DEĞER</small><strong>{money.format(currentValue)} PR</strong></div><div><small>NET KÂR</small><strong>+{money.format(currentValue - round.stake)} PR</strong></div></div>}
          <p className="originals-note">Doğru tahminde çarpan, kalan destedeki gerçek olasılığa göre büyür. İstediğin anda kasaya alabilirsin.</p>
        </section>
        <section className="originals-history-card hilo-history">
          <header><strong>SON TURLAR</strong><button disabled={!lastSettled} onClick={() => setFairOpen(true)}>DOĞRULA</button></header>
          {history.length ? history.map((item) => <article key={item.id} className={item.outcome}><div><b>{historyCards(item)}</b><small>{Number(item.result.correctGuesses ?? 0)} doğru · {Number(item.result.multiplier ?? 1).toFixed(2)}×</small></div><span>{item.net >= 0 ? '+' : ''}{money.format(item.net)} PR</span></article>) : <p className="originals-note">İlk Hilo turun burada görünecek.</p>}
        </section>
      </aside>
    </div>

    {rulesOpen && <div className="originals-modal-backdrop" onClick={() => setRulesOpen(false)}><section className="originals-modal" onClick={(event) => event.stopPropagation()}><button onClick={() => setRulesOpen(false)}>×</button><h2>Hilo nasıl oynanır?</h2><h3>Bir yön seç</h3><p>Bir kart açık gelir. Sıradaki kartın değerinin daha yüksek veya daha düşük olacağını tahmin et. As en yüksek karttır.</p><h3>Çarpanı büyüt</h3><p>Her doğru tahmin çarpanı artırır. Olasılığı düşük yön, daha yüksek çarpan verir. İstediğin anda “Kasaya Al” ile turu bitirebilirsin.</p><h3>Beraberlik</h3><p>Aynı değerde kart gelirse tahmin kaybeder. Butonlarda, kalan desteye göre gerçek kazanma olasılığı ve adım çarpanı gösterilir.</p><h3>Adil sonuç</h3><p>Deste HMAC-SHA256 ile client seed, nonce ve gizli server seed’den deterministik olarak karılır. Tur bittikten sonra deste doğrulanabilir.</p></section></div>}
    {fairOpen && <div className="originals-modal-backdrop" onClick={() => setFairOpen(false)}><section className="originals-modal" onClick={(event) => event.stopPropagation()}><button onClick={() => setFairOpen(false)}>×</button><h2>Doğrulanabilir deste</h2>{lastSettled ? <><p>Algoritma: {lastSettled.algorithm}</p><p>Taahhüt</p><code>{lastSettled.commitment}</code><p>Nonce: {lastSettled.nonce}</p><button className="originals-primary" onClick={() => void verify()}>{verifyState === 'checking' ? 'KONTROL EDİLİYOR…' : verifyState === 'ok' ? '✓ DESTE DOĞRULANDI' : verifyState === 'fail' ? 'DOĞRULAMA BAŞARISIZ' : 'DESTEYİ DOĞRULA'}</button></> : <p>Henüz tamamlanmış tur yok.</p>}</section></div>}
  </main>
}
