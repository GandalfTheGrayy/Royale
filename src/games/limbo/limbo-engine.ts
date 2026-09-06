import { bytesToHex, hmacBytes, randomUnitStream, secureSeed, sha256 } from '../originals/fair-rng'

export type LimboRound = {
  algorithm: 'owl-oracle-hmac-sha256-v1'
  roundId: string
  startedAt: string
  settledAt: string
  stake: number
  target: number
  result: number
  winChance: number
  grossPayout: number
  won: boolean
  rtp: number
  clientSeed: string
  serverSeed: string
  nonce: number
  commitment: string
  digest: string
}

export type LimboOptions = {
  stake: number
  target: number
  rtp: number
  clientSeed: string
  nonce: number
  serverSeed?: string
  now?: string
  maxMultiplier?: number
}

export const LIMBO_MIN_TARGET = 1.01
export const LIMBO_MAX_TARGET = 10_000

export function clampLimboTarget(value: number) {
  if (!Number.isFinite(value)) return 2
  return Math.min(LIMBO_MAX_TARGET, Math.max(LIMBO_MIN_TARGET, Math.round(value * 100) / 100))
}

export function limboWinChance(target: number, rtp = 97) {
  return Math.min(100, (Math.max(1, Math.min(100, rtp)) / clampLimboTarget(target)) )
}

export function limboResultFromUnit(unit: number, rtp = 97, maxMultiplier = LIMBO_MAX_TARGET) {
  const safeUnit = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, unit))
  const raw = (Math.max(1, Math.min(100, rtp)) / 100) / safeUnit
  return Math.max(1, Math.min(maxMultiplier, Math.floor(raw * 100) / 100))
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export async function createLimboRound(options: LimboOptions): Promise<LimboRound> {
  const serverSeed = options.serverSeed ?? secureSeed()
  const target = clampLimboTarget(options.target)
  const message = `${options.clientSeed}:${options.nonce}:limbo`
  const [unit] = await randomUnitStream(serverSeed, message, 1)
  const result = limboResultFromUnit(unit, options.rtp, options.maxMultiplier)
  const won = result >= target
  const startedAt = options.now ?? new Date().toISOString()
  const digest = bytesToHex(await hmacBytes(serverSeed, message))
  return {
    algorithm: 'owl-oracle-hmac-sha256-v1',
    roundId: `owl-oracle-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    startedAt,
    settledAt: startedAt,
    stake: roundMoney(Math.max(0, options.stake)),
    target,
    result,
    winChance: limboWinChance(target, options.rtp),
    grossPayout: won ? roundMoney(Math.max(0, options.stake) * target) : 0,
    won,
    rtp: options.rtp,
    clientSeed: options.clientSeed,
    serverSeed,
    nonce: options.nonce,
    commitment: await sha256(serverSeed),
    digest,
  }
}

export async function verifyLimboRound(round: LimboRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createLimboRound({
    stake: round.stake,
    target: round.target,
    rtp: round.rtp,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    serverSeed: round.serverSeed,
    now: round.startedAt,
  })
  return regenerated.digest === round.digest && regenerated.result === round.result
}
