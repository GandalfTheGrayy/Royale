import { createRecordId, recordGameRound, recordWalletEntry, setCasinoMeta } from '../../data/casino-database'
import { betStake, EUROPEAN_WHEEL, numberColour, settleBets, totalStake, type LuckyNumber, type PlacedBet } from './roulette-engine'
import { acceptsClosedRouletteTicket, type LiveRoulettePhase } from './live-roulette-policy'
import { getAdminSettings } from '../../data/casino-admin'

export type { LiveRoulettePhase } from './live-roulette-policy'

export type LiveRouletteState = {
  roundId: string
  roundNumber: number
  phase: LiveRoulettePhase
  phaseEndsAt: number
  cycleStartedAt: number
  cycleEndsAt: number
  countdown: number
  winner: number
  luckyNumbers: LuckyNumber[]
  history: number[]
}

export type LiveRouletteTicket = {
  ticketId: string
  roundId: string
  bets: PlacedBet[]
  balanceBefore: number
  onSettled: (settlement: ReturnType<typeof settleBets> & { number: number; stake: number; luckyNumbers: LuckyNumber[] }) => void
}

const CYCLE_MS = 30_000
const BETTING_END_MS = 20_000
const SURGE_END_MS = 22_400
const SPIN_END_MS = 27_000
const multiplierPool = [50, 50, 75, 100, 100, 150, 200, 250, 500] as const
const listeners = new Set<() => void>()
const tickets = new Map<string, LiveRouletteTicket>()
const outcomeCache = new Map<number, StoredRound>()
const recordedRounds = new Set<string>()
let timer: number | undefined
let recordQueue = Promise.resolve()

function secureRandom(max: number) {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] % max
}

function createLuckyNumbers(): LuckyNumber[] {
  const available = [...EUROPEAN_WHEEL]
  const count = 2 + secureRandom(4)
  return Array.from({ length: count }, () => {
    const index = secureRandom(available.length)
    const number = available.splice(index, 1)[0]
    return { number, multiplier: multiplierPool[secureRandom(multiplierPool.length)] }
  }).sort((a, b) => b.multiplier - a.multiplier)
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem('pehlevan-roulette-history') ?? '[]') as number[]
    return parsed.filter((number) => Number.isInteger(number) && number >= 0 && number <= 36).slice(0, 80)
  } catch { return [] }
}

type StoredRound = { roundNumber: number; winner: number; luckyNumbers: LuckyNumber[] }

function outcomeFor(roundNumber: number): StoredRound {
  const cached = outcomeCache.get(roundNumber)
  if (cached) return cached
  const key = 'pehlevan-live-roulette-current'
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as StoredRound | null
    if (stored?.roundNumber === roundNumber && EUROPEAN_WHEEL.includes(stored.winner as typeof EUROPEAN_WHEEL[number])) {
      outcomeCache.set(roundNumber, stored)
      return stored
    }
  } catch { /* generate a fresh outcome */ }
  const next = { roundNumber, winner: EUROPEAN_WHEEL[secureRandom(EUROPEAN_WHEEL.length)], luckyNumbers: createLuckyNumbers() }
  outcomeCache.set(roundNumber, next)
  localStorage.setItem(key, JSON.stringify(next))
  return next
}

function buildState(at = Date.now()): LiveRouletteState {
  const roundNumber = Math.floor(at / CYCLE_MS)
  const cycleStartedAt = roundNumber * CYCLE_MS
  const elapsed = at - cycleStartedAt
  const generated = outcomeFor(roundNumber)
  let phase: LiveRoulettePhase
  let phaseEndsAt: number
  if (elapsed < BETTING_END_MS) { phase = 'betting'; phaseEndsAt = cycleStartedAt + BETTING_END_MS }
  else if (elapsed < SURGE_END_MS) { phase = 'surge'; phaseEndsAt = cycleStartedAt + SURGE_END_MS }
  else if (elapsed < SPIN_END_MS) { phase = 'spinning'; phaseEndsAt = cycleStartedAt + SPIN_END_MS }
  else { phase = 'result'; phaseEndsAt = cycleStartedAt + CYCLE_MS }
  return {
    roundId: `roulette-live-${roundNumber}`,
    roundNumber,
    phase,
    phaseEndsAt,
    cycleStartedAt,
    cycleEndsAt: cycleStartedAt + CYCLE_MS,
    countdown: Math.max(0, Math.ceil((phaseEndsAt - at) / 1000)),
    winner: generated.winner,
    luckyNumbers: getAdminSettings().games.roulette.features.surge ? generated.luckyNumbers : [],
    history: loadHistory(),
  }
}

let state = buildState()

function addHistory(number: number) {
  const current = loadHistory()
  if (current[0] !== number) current.unshift(number)
  const next = current.slice(0, 80)
  localStorage.setItem('pehlevan-roulette-history', JSON.stringify(next))
  state = { ...state, history: next }
}

function settleLiveTickets(current: LiveRouletteState) {
  const settledAt = new Date(current.cycleStartedAt + SPIN_END_MS).toISOString()
  const roundTickets = [...tickets.values()].filter((ticket) => ticket.roundId === current.roundId)
  roundTickets.forEach((ticket) => {
    tickets.delete(ticket.ticketId)
    const stake = totalStake(ticket.bets)
    const settlement = { ...settleBets(ticket.bets, current.winner, current.luckyNumbers), number: current.winner, stake, luckyNumbers: current.luckyNumbers }
    const balanceAfter = ticket.balanceBefore - stake + settlement.grossReturn
    void recordGameRound({
      id: `round:${current.roundId}:player:${ticket.ticketId}`,
      roundId: current.roundId,
      game: 'roulette',
      variant: 'Rouge Salon · Avrupa Tek Sıfır · Pehlevan Surge',
      source: 'player',
      playerParticipated: true,
      startedAt: new Date(current.cycleStartedAt).toISOString(),
      settledAt,
      stake,
      grossPayout: settlement.grossReturn,
      net: settlement.net,
      outcome: settlement.net > 0 ? 'win' : settlement.net < 0 ? 'loss' : 'push',
      balanceBefore: ticket.balanceBefore,
      balanceAfter,
      result: {
        telemetryVersion: 2, rngModel: 'european-wheel-crypto-v1', number: current.winner,
        colour: numberColour(current.winner),
        totalStake: stake, betAreaCount: ticket.bets.length, chipCount: ticket.bets.reduce((sum, bet) => sum + bet.chips.length, 0),
        bets: ticket.bets.map((bet) => ({ id: bet.definition.id, label: bet.definition.label, kind: bet.definition.kind, numbers: bet.definition.numbers, payoutOdds: bet.definition.payout ?? null, components: bet.definition.components ?? null, chips: bet.chips, stake: betStake(bet), won: bet.definition.numbers.includes(current.winner) })),
        winners: settlement.winners.map(({ bet, returnAmount }) => ({ id: bet.definition.id, label: bet.definition.label, stake: betStake(bet), returnAmount, profit: returnAmount - betStake(bet) })),
        grossReturn: settlement.grossReturn, net: settlement.net, winMultiple: stake ? settlement.grossReturn / stake : 0,
      },
      modifiers: { luckyNumbers: current.luckyNumbers, luckyNumberCount: current.luckyNumbers.length, hitMultiplier: settlement.hitMultiplier ?? null, multiplierReturn: settlement.multiplierReturn, cycleStartedAt: current.cycleStartedAt, bettingClosedAt: current.cycleStartedAt + BETTING_END_MS, wheelSettledAt: current.cycleStartedAt + SPIN_END_MS },
    })
    void recordWalletEntry({ id: createRecordId('ledger-stake', current.roundId), roundId: current.roundId, game: 'roulette', occurredAt: new Date(current.cycleStartedAt + BETTING_END_MS).toISOString(), type: 'stake', amount: -stake, balanceBefore: ticket.balanceBefore, balanceAfter: ticket.balanceBefore - stake, note: 'Canlı rulet bahsi kapandı' })
    if (settlement.grossReturn) void recordWalletEntry({ id: createRecordId('ledger-payout', current.roundId), roundId: current.roundId, game: 'roulette', occurredAt: settledAt, type: 'payout', amount: settlement.grossReturn, balanceBefore: ticket.balanceBefore - stake, balanceAfter, note: `Canlı rulet ${current.winner} ödemesi` })
    // UI settlement is deliberately synchronous. IndexedDB/database work above
    // must never hold the player's result card behind the persistence queue.
    ticket.onSettled(settlement)
  })
}

async function recordLiveOutcome(current: LiveRouletteState) {
  const settledAt = new Date(current.cycleStartedAt + SPIN_END_MS).toISOString()
  addHistory(current.winner)
  await recordGameRound({
    id: `round:${current.roundId}:table`,
    roundId: current.roundId,
    game: 'roulette',
    variant: 'Rouge Salon · Avrupa Tek Sıfır · Pehlevan Surge',
    source: 'live-table',
    playerParticipated: false,
    startedAt: new Date(current.cycleStartedAt).toISOString(),
    settledAt,
    stake: 0,
    grossPayout: 0,
    net: 0,
    outcome: 'watch',
    result: { telemetryVersion: 2, rngModel: 'european-wheel-crypto-v1', number: current.winner, colour: numberColour(current.winner) },
    modifiers: { luckyNumbers: current.luckyNumbers, luckyNumberCount: current.luckyNumbers.length, hitMultiplier: current.luckyNumbers.find((entry) => entry.number === current.winner)?.multiplier ?? null, cycleStartedAt: current.cycleStartedAt, wheelSettledAt: current.cycleStartedAt + SPIN_END_MS },
  })
  // The compact live-table round already contains the result and multipliers.
  // Avoid writing the same 30-second outcome a second time to game_events.
  await setCasinoMeta('liveRouletteLastRound', { roundId: current.roundId, settledAt, number: current.winner })
}

function queueLiveOutcome(current: LiveRouletteState) {
  if (recordedRounds.has(current.roundId)) return
  recordedRounds.add(current.roundId)
  settleLiveTickets(current)
  recordQueue = recordQueue.then(() => recordLiveOutcome(current)).catch(() => undefined)
}

function tick() {
  const previous = state
  const next = buildState()
  state = { ...next, history: previous.history }
  if (previous.roundId !== next.roundId) {
    queueLiveOutcome(previous)
    for (let roundNumber = previous.roundNumber + 1; roundNumber < next.roundNumber; roundNumber += 1) {
      const cycleStartedAt = roundNumber * CYCLE_MS
      const generated = outcomeFor(roundNumber)
      queueLiveOutcome({ roundId: `roulette-live-${roundNumber}`, roundNumber, phase: 'result', phaseEndsAt: cycleStartedAt + CYCLE_MS, cycleStartedAt, cycleEndsAt: cycleStartedAt + CYCLE_MS, countdown: 0, winner: generated.winner, luckyNumbers: getAdminSettings().games.roulette.features.surge ? generated.luckyNumbers : [], history: state.history })
    }
  }
  if (next.phase === 'result') queueLiveOutcome(next)
  listeners.forEach((listener) => listener())
}

export function startLiveRoulette() {
  if (timer !== undefined) return () => undefined
  tick()
  timer = window.setInterval(tick, 200)
  return () => {
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
  }
}

export function getLiveRouletteState() {
  return state
}

export function subscribeLiveRoulette(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function submitLiveRouletteTicket(ticket: LiveRouletteTicket) {
  // The UI locks the wager on the betting -> Surge edge. A busy render or a
  // throttled browser timer may observe that edge just after the wheel entered
  // `spinning`; the ticket still belongs to the same already-closed round and
  // must not be dropped. Result phase is intentionally excluded because the
  // winning number is visible by then.
  if (!acceptsClosedRouletteTicket(state.phase) || ticket.roundId !== state.roundId || tickets.has(ticket.ticketId) || recordedRounds.has(ticket.roundId)) return false
  tickets.set(ticket.ticketId, ticket)
  return true
}

export function liveRouletteTimings() {
  return { cycleMs: CYCLE_MS, bettingMs: BETTING_END_MS, surgeEndMs: SURGE_END_MS, spinEndMs: SPIN_END_MS }
}
