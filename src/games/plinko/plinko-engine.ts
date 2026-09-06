export type PlinkoRisk = 'dusuk' | 'orta' | 'yuksek'

export type FairPlinkoRound = {
  algorithm: 'pehlevan-plinko-hmac-sha256-v1'
  roundId: string
  startedAt: string
  settledAt: string
  stake: number
  rtp: number
  maxPayoutX: number
  risk: PlinkoRisk
  rows: number
  directions: Array<-1 | 1>
  bucket: number
  multipliers: number[]
  multiplier: number
  grossPayout: number
  net: number
  clientSeed: string
  nonce: number
  serverSeed: string
  commitment: string
  digest: string
  profileName: string
}

export type CreatePlinkoOptions = {
  stake: number
  rtp: number
  risk: PlinkoRisk
  rows: number
  maxPayoutX: number
  clientSeed: string
  nonce: number
  profileName?: string
  serverSeed?: string
  now?: string
}

const encoder = new TextEncoder()

export const PLINKO_RISKS: Record<PlinkoRisk, { label: string; floor: number; edge: (rows: number) => number; exponent: number }> = {
  dusuk: { label: 'Düşük', floor: .55, edge: (rows) => 4 + rows * .25, exponent: 2.8 },
  orta: { label: 'Orta', floor: .25, edge: (rows) => 20 + rows * 2.5, exponent: 3.5 },
  yuksek: { label: 'Yüksek', floor: .1, edge: (rows) => 1_000 * Math.pow(rows / 8, 2), exponent: 10 },
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function combination(n: number, k: number) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0 || k > n) return 0
  let result = 1
  const steps = Math.min(k, n - k)
  for (let index = 1; index <= steps; index += 1) result = (result * (n - steps + index)) / index
  return result
}

export function bucketProbability(rows: number, bucket: number) {
  return combination(rows, bucket) / Math.pow(2, rows)
}

export function plinkoMultipliers(rowsInput: number, risk: PlinkoRisk, rtpInput = 97, maxPayoutX = 1_000) {
  const rows = Math.round(clamp(rowsInput, 8, 16))
  const profile = PLINKO_RISKS[risk]
  const target = clamp(rtpInput, 1, 100) / 100
  const center = rows / 2
  const raw = Array.from({ length: rows + 1 }, (_, bucket) => {
    const distance = Math.abs(bucket - center) / center
    return profile.floor + profile.edge(rows) * Math.pow(distance, profile.exponent)
  })
  const ceiling = Math.max(.01, maxPayoutX)
  const expectedAt = (scale: number) => raw.reduce((sum, value, bucket) => sum + Math.min(ceiling, Math.max(.01, value * scale)) * bucketProbability(rows, bucket), 0)
  let low = 0, high = 1
  while (expectedAt(high) < target && high < 1_000_000) high *= 2
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2
    if (expectedAt(middle) < target) low = middle
    else high = middle
  }
  return raw.map((value) => Math.min(ceiling, Math.max(.01, Math.floor(value * high * 1_000_000) / 1_000_000)))
}

export function expectedPlinkoRtp(multipliers: number[]) {
  const rows = multipliers.length - 1
  return multipliers.reduce((sum, value, bucket) => sum + value * bucketProbability(rows, bucket), 0)
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

function secureSeed() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function createFairPlinkoRound(options: CreatePlinkoOptions): Promise<FairPlinkoRound> {
  const rows = Math.round(clamp(options.rows, 8, 16))
  const stake = roundMoney(Math.max(0, options.stake))
  const serverSeed = options.serverSeed ?? secureSeed()
  const message = `${options.clientSeed}:${options.nonce}:${options.risk}:${rows}:${stake}`
  const digestBytes = await hmacBytes(serverSeed, message)
  const directions = Array.from({ length: rows }, (_, index) => ((digestBytes[index] & 1) ? 1 : -1) as -1 | 1)
  const bucket = directions.filter((direction) => direction === 1).length
  const multipliers = plinkoMultipliers(rows, options.risk, options.rtp, options.maxPayoutX)
  const multiplier = multipliers[bucket]
  const grossPayout = roundMoney(stake * multiplier)
  const startedAt = options.now ?? new Date().toISOString()
  return {
    algorithm: 'pehlevan-plinko-hmac-sha256-v1',
    roundId: `plinko-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    startedAt,
    settledAt: new Date().toISOString(),
    stake,
    rtp: clamp(options.rtp, 1, 100),
    maxPayoutX: Math.max(1, options.maxPayoutX),
    risk: options.risk,
    rows,
    directions,
    bucket,
    multipliers,
    multiplier,
    grossPayout,
    net: roundMoney(grossPayout - stake),
    clientSeed: options.clientSeed,
    nonce: options.nonce,
    serverSeed,
    commitment: await sha256(serverSeed),
    digest: bytesToHex(digestBytes),
    profileName: options.profileName ?? 'plinko-v1-hmac-970',
  }
}

export async function verifyPlinkoRound(round: FairPlinkoRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createFairPlinkoRound({
    stake: round.stake, rtp: round.rtp, risk: round.risk, rows: round.rows,
    maxPayoutX: round.maxPayoutX, clientSeed: round.clientSeed,
    nonce: round.nonce, profileName: round.profileName, serverSeed: round.serverSeed, now: round.startedAt,
  })
  return regenerated.digest === round.digest && regenerated.bucket === round.bucket && JSON.stringify(regenerated.directions) === JSON.stringify(round.directions)
}
