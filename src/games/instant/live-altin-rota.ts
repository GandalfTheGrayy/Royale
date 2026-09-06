import { getAdminSettings } from '../../data/casino-admin'
import { getCasinoMeta, recordGameRound, setCasinoMeta } from '../../data/casino-database'
import { createFairCrashRound, flightDurationFor, multiplierAt, type FairCrashRound } from './altin-rota-engine'

export type LiveAltinRotaPhase = 'betting' | 'flying' | 'crashed'

type StoredCycle = {
  round: FairCrashRound
  cycleStartedAt: number
  bettingEndsAt: number
  flightEndsAt: number
  cycleEndsAt: number
}

export type LiveAltinRotaState = StoredCycle & {
  ready: boolean
  phase: LiveAltinRotaPhase
  phaseEndsAt: number
  countdownMs: number
  multiplier: number
  elapsedFlightMs: number
  history: number[]
}

const CURRENT_META = 'liveAltinRotaCurrentV1'
const HISTORY_META = 'liveAltinRotaHistoryV1'
const listeners = new Set<() => void>()
const recordedRounds = new Set<string>()
let timer: number | undefined
let advancing = false
let history: number[] = []

const blankRound: FairCrashRound = {
  roundId: 'altin-rota-hazirlaniyor', nonce: 0, clientSeed: 'live-table', serverSeed: '', commitment: '', digest: '', crashPoint: 1, createdAt: new Date(0).toISOString(),
}

let cycle: StoredCycle = { round: blankRound, cycleStartedAt: 0, bettingEndsAt: 0, flightEndsAt: 0, cycleEndsAt: 0 }
let state: LiveAltinRotaState = { ...cycle, ready: false, phase: 'betting', phaseEndsAt: 0, countdownMs: 0, multiplier: 1, elapsedFlightMs: 0, history: [] }

function settings() {
  const game = getAdminSettings().games['altin-rota']
  return { game, tuning: game.crash! }
}

function validCycle(value: StoredCycle | undefined): value is StoredCycle {
  return !!value?.round?.roundId && Number.isFinite(value.cycleStartedAt) && Number.isFinite(value.cycleEndsAt) && value.cycleEndsAt > value.cycleStartedAt
}

async function createCycle(cycleStartedAt: number, nonce: number) {
  const { game, tuning } = settings()
  const round = await createFairCrashRound({ targetRtp: game.targetRtp, maxMultiplier: tuning.maxMultiplier, curveMs: tuning.curveMs }, 'pehlevan-live-table', nonce)
  round.roundId = `altin-rota-live-${nonce}-${cycleStartedAt}`
  round.createdAt = new Date(cycleStartedAt).toISOString()
  const bettingEndsAt = cycleStartedAt + tuning.bettingWindowMs
  const flightEndsAt = bettingEndsAt + flightDurationFor(round.crashPoint, tuning.curveMs)
  const next: StoredCycle = { round, cycleStartedAt, bettingEndsAt, flightEndsAt, cycleEndsAt: flightEndsAt + tuning.resultWindowMs }
  await setCasinoMeta(CURRENT_META, next)
  return next
}

async function recordCycle(ended: StoredCycle) {
  if (recordedRounds.has(ended.round.roundId)) return
  recordedRounds.add(ended.round.roundId)
  if (history[0] !== ended.round.crashPoint) history = [ended.round.crashPoint, ...history].slice(0, 80)
  await setCasinoMeta(HISTORY_META, history)
  await recordGameRound({
    id: `round:${ended.round.roundId}:table`, roundId: ended.round.roundId, game: 'altin-rota',
    variant: 'Altın Rota · sürekli canlı crash', source: 'live-table', playerParticipated: false,
    startedAt: ended.round.createdAt, settledAt: new Date(ended.flightEndsAt).toISOString(), stake: 0, grossPayout: 0, net: 0, outcome: 'watch',
    result: { telemetryVersion: 2, rngModel: 'SHA-256 / first-52-bit inverse distribution', crashPoint: ended.round.crashPoint, commitment: ended.round.commitment, serverSeed: ended.round.serverSeed, clientSeed: ended.round.clientSeed, nonce: ended.round.nonce, digest: ended.round.digest },
    modifiers: { cycleStartedAt: ended.cycleStartedAt, bettingEndsAt: ended.bettingEndsAt, flightEndsAt: ended.flightEndsAt, cycleEndsAt: ended.cycleEndsAt },
  })
}

function publish(at = Date.now()) {
  if (!cycle.cycleStartedAt) return
  const { tuning } = settings()
  let phase: LiveAltinRotaPhase
  let phaseEndsAt: number
  let multiplier = 1
  let elapsedFlightMs = 0
  if (at < cycle.bettingEndsAt) {
    phase = 'betting'; phaseEndsAt = cycle.bettingEndsAt
  } else if (at < cycle.flightEndsAt) {
    phase = 'flying'; phaseEndsAt = cycle.flightEndsAt
    elapsedFlightMs = Math.max(0, at - cycle.bettingEndsAt)
    multiplier = Math.min(cycle.round.crashPoint, multiplierAt(elapsedFlightMs, tuning.curveMs))
  } else {
    phase = 'crashed'; phaseEndsAt = cycle.cycleEndsAt
    elapsedFlightMs = Math.max(0, cycle.flightEndsAt - cycle.bettingEndsAt)
    multiplier = cycle.round.crashPoint
  }
  state = { ...cycle, ready: true, phase, phaseEndsAt, countdownMs: Math.max(0, phaseEndsAt - at), multiplier, elapsedFlightMs, history }
  listeners.forEach((listener) => listener())
}

async function advance() {
  if (advancing) return
  advancing = true
  try {
    const now = Date.now()
    if (!cycle.cycleStartedAt) {
      const [storedCycle, storedHistory] = await Promise.all([
        getCasinoMeta<StoredCycle>(CURRENT_META), getCasinoMeta<number[]>(HISTORY_META),
      ])
      history = Array.isArray(storedHistory) ? storedHistory.filter((value) => Number.isFinite(value) && value >= 1).slice(0, 80) : []
      cycle = validCycle(storedCycle) ? storedCycle : await createCycle(now, Math.floor(now / 1000))
    }
    let catchup = 0
    while (now >= cycle.cycleEndsAt && catchup < 250) {
      await recordCycle(cycle)
      cycle = await createCycle(cycle.cycleEndsAt, cycle.round.nonce + 1)
      catchup += 1
    }
    // A very long offline gap is collapsed to a fresh live cycle; recorded
    // catch-up is intentionally capped so reconnect cannot freeze the UI.
    if (now >= cycle.cycleEndsAt) cycle = await createCycle(now, cycle.round.nonce + 1)
    publish(now)
  } finally {
    advancing = false
  }
}

export function startLiveAltinRota() {
  if (timer !== undefined) return () => undefined
  void advance()
  timer = window.setInterval(() => {
    if (Date.now() >= cycle.cycleEndsAt) void advance()
    else publish()
  }, 30)
  return () => {
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
  }
}

export function getLiveAltinRotaState() { return state }

export function subscribeLiveAltinRota(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
