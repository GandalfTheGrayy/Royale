export type CountdownRisk = 'temkinli' | 'keskin' | 'son-saniye'
export type CountdownPhase = 'active' | 'lost' | 'cashed' | 'completed'

export const COUNTDOWN_PROFILE: Record<CountdownRisk, { choices: number; alarms: number; label: string }> = {
  temkinli: { choices: 3, alarms: 1, label: 'Temkinli' },
  keskin: { choices: 4, alarms: 2, label: 'Keskin' },
  'son-saniye': { choices: 5, alarms: 3, label: 'Son Saniye' },
}

export type FairCountdownRound = {
  algorithm: 'son-on-hmac-sha256-v1'
  roundId: string
  phase: CountdownPhase
  startedAt: string
  settledAt?: string
  stake: number
  rtp: number
  risk: CountdownRisk
  stages: number
  choices: number
  alarmsPerStage: number
  hazardIndices: number[][]
  selections: number[]
  safeSteps: number
  currentMultiplier: number
  grossPayout: number
  maxPayoutX: number
  clientSeed: string
  nonce: number
  serverSeed: string
  commitment: string
  digest: string
}

type CreateOptions = {
  stake: number
  rtp: number
  risk: CountdownRisk
  stages?: number
  maxPayoutX?: number
  clientSeed: string
  nonce: number
  serverSeed?: string
  now?: string
}

const encoder = new TextEncoder()

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundMultiplier(value: number) {
  return Math.floor((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

export function countdownSafeChance(risk: CountdownRisk) {
  const profile = COUNTDOWN_PROFILE[risk]
  return (profile.choices - profile.alarms) / profile.choices
}

export function countdownMultiplier(risk: CountdownRisk, safeSteps: number, rtp = 97, maxPayoutX = 1_000_000) {
  if (safeSteps <= 0) return 1
  const fairValue = (clamp(rtp, 1, 100) / 100) / Math.pow(countdownSafeChance(risk), safeSteps)
  return roundMultiplier(Math.min(Math.max(1, maxPayoutX), fairValue))
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToHex(new Uint8Array(digest))
}

async function hmacBytes(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)))
}

async function randomStream(serverSeed: string, message: string, count: number) {
  const result: number[] = []
  let counter = 0
  while (result.length < count) {
    const bytes = await hmacBytes(serverSeed, `${message}:${counter}`)
    for (let offset = 0; offset + 3 < bytes.length && result.length < count; offset += 4) {
      const integer = (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0
      result.push(integer / 0x1_0000_0000)
    }
    counter += 1
  }
  return result
}

async function shuffled(length: number, serverSeed: string, message: string) {
  const values = Array.from({ length }, (_, index) => index)
  const randoms = await randomStream(serverSeed, message, Math.max(1, length - 1))
  let cursor = 0
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randoms[cursor++] * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
  return values
}

function secureSeed() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function createFairCountdownRound(options: CreateOptions): Promise<FairCountdownRound> {
  const profile = COUNTDOWN_PROFILE[options.risk]
  const stages = Math.round(clamp(options.stages ?? 10, 4, 20))
  const serverSeed = options.serverSeed ?? secureSeed()
  const message = `${options.clientSeed}:${options.nonce}:${options.risk}:${stages}`
  const hazardIndices = await Promise.all(Array.from({ length: stages }, async (_, stage) =>
    (await shuffled(profile.choices, serverSeed, `${message}:stage:${stage}`)).slice(0, profile.alarms).sort((a, b) => a - b),
  ))
  const startedAt = options.now ?? new Date().toISOString()
  return {
    algorithm: 'son-on-hmac-sha256-v1',
    roundId: `son-on-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    phase: 'active',
    startedAt,
    stake: roundMoney(Math.max(0, options.stake)),
    rtp: clamp(options.rtp, 1, 100),
    risk: options.risk,
    stages,
    choices: profile.choices,
    alarmsPerStage: profile.alarms,
    hazardIndices,
    selections: [],
    safeSteps: 0,
    currentMultiplier: 1,
    grossPayout: 0,
    maxPayoutX: Math.max(1, options.maxPayoutX ?? 1_000_000),
    clientSeed: options.clientSeed,
    nonce: options.nonce,
    serverSeed,
    commitment: await sha256(serverSeed),
    digest: bytesToHex(await hmacBytes(serverSeed, message)),
  }
}

export function chooseCountdownCell(round: FairCountdownRound, cell: number, settledAt = new Date().toISOString()) {
  if (round.phase !== 'active' || cell < 0 || cell >= round.choices) return { round, result: 'invalid' as const }
  const stageIndex = round.safeSteps
  const selections = [...round.selections, cell]
  if (round.hazardIndices[stageIndex]?.includes(cell)) {
    return { round: { ...round, selections, phase: 'lost' as const, grossPayout: 0, settledAt }, result: 'alarm' as const }
  }
  const safeSteps = round.safeSteps + 1
  const currentMultiplier = countdownMultiplier(round.risk, safeSteps, round.rtp, round.maxPayoutX)
  const grossPayout = roundMoney(round.stake * currentMultiplier)
  const complete = safeSteps >= round.stages
  return {
    round: { ...round, selections, safeSteps, currentMultiplier, grossPayout, phase: complete ? 'completed' as const : 'active' as const, settledAt: complete ? settledAt : undefined },
    result: complete ? 'complete' as const : 'safe' as const,
  }
}

export function cashOutCountdown(round: FairCountdownRound, settledAt = new Date().toISOString()) {
  if (round.phase !== 'active' || round.safeSteps < 1) return round
  return { ...round, phase: 'cashed' as const, settledAt }
}

export async function verifyCountdownRound(round: FairCountdownRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createFairCountdownRound({
    stake: round.stake, rtp: round.rtp, risk: round.risk, stages: round.stages, maxPayoutX: round.maxPayoutX,
    clientSeed: round.clientSeed, nonce: round.nonce, serverSeed: round.serverSeed, now: round.startedAt,
  })
  return regenerated.digest === round.digest && JSON.stringify(regenerated.hazardIndices) === JSON.stringify(round.hazardIndices)
}
