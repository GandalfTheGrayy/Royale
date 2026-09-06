import { bytesToHex, hmacBytes, secureSeed, sha256, shuffledRange } from '../originals/fair-rng'

export type KenoRisk = 'low' | 'medium' | 'high'

export type KenoRound = {
  algorithm: 'owl-star-map-hmac-sha256-v1'
  roundId: string
  startedAt: string
  settledAt: string
  stake: number
  selected: number[]
  drawn: number[]
  hits: number[]
  risk: KenoRisk
  multiplier: number
  grossPayout: number
  rtp: number
  clientSeed: string
  serverSeed: string
  nonce: number
  commitment: string
  digest: string
}

export type KenoOptions = {
  stake: number
  selected: number[]
  risk: KenoRisk
  rtp: number
  clientSeed: string
  nonce: number
  serverSeed?: string
  now?: string
}

export function combination(n: number, k: number) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0
  const steps = Math.min(k, n - k)
  let result = 1
  for (let index = 1; index <= steps; index += 1) result = (result * (n - steps + index)) / index
  return result
}

export function kenoHitProbability(selectedCount: number, hits: number) {
  if (selectedCount < 1 || selectedCount > 10 || hits < 0 || hits > selectedCount || hits > 10) return 0
  return (combination(selectedCount, hits) * combination(40 - selectedCount, 10 - hits)) / combination(40, 10)
}

export function winningThreshold(selectedCount: number, risk: KenoRisk) {
  const ratio = risk === 'low' ? .35 : risk === 'medium' ? .55 : .75
  return Math.max(1, Math.ceil(selectedCount * ratio))
}

export function kenoPaytable(selectedCount: number, risk: KenoRisk, rtp = 97) {
  const count = Math.max(1, Math.min(10, Math.round(selectedCount)))
  const threshold = winningThreshold(count, risk)
  const winningHits = Array.from({ length: count - threshold + 1 }, (_, index) => threshold + index)
  const expectedShare = (Math.max(1, Math.min(100, rtp)) / 100) / winningHits.length
  return Object.fromEntries(Array.from({ length: count + 1 }, (_, hits) => {
    if (hits < threshold) return [hits, 0]
    const probability = kenoHitProbability(count, hits)
    return [hits, probability > 0 ? Math.floor((expectedShare / probability) * 1_000_000) / 1_000_000 : 0]
  })) as Record<number, number>
}

export function theoreticalKenoRtp(selectedCount: number, risk: KenoRisk, rtp = 97) {
  const table = kenoPaytable(selectedCount, risk, rtp)
  return Object.entries(table).reduce((sum, [hits, multiplier]) => (
    sum + kenoHitProbability(selectedCount, Number(hits)) * multiplier
  ), 0)
}

export function normalizeKenoSelection(values: number[]) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 1 && value <= 40))]
    .slice(0, 10)
    .sort((a, b) => a - b)
}

export async function createKenoRound(options: KenoOptions): Promise<KenoRound> {
  const selected = normalizeKenoSelection(options.selected)
  if (selected.length < 1) throw new Error('En az bir yıldız seçilmeli.')
  const serverSeed = options.serverSeed ?? secureSeed()
  const message = `${options.clientSeed}:${options.nonce}:keno:${selected.join('-')}:${options.risk}`
  const drawn = (await shuffledRange(40, serverSeed, message, 1)).slice(0, 10)
  const hits = drawn.filter((value) => selected.includes(value))
  const multiplier = kenoPaytable(selected.length, options.risk, options.rtp)[hits.length] ?? 0
  const stake = Math.round(Math.max(0, options.stake) * 100) / 100
  const startedAt = options.now ?? new Date().toISOString()
  return {
    algorithm: 'owl-star-map-hmac-sha256-v1',
    roundId: `owl-star-map-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    startedAt,
    settledAt: startedAt,
    stake,
    selected,
    drawn,
    hits,
    risk: options.risk,
    multiplier,
    grossPayout: Math.round(stake * multiplier * 100) / 100,
    rtp: options.rtp,
    clientSeed: options.clientSeed,
    serverSeed,
    nonce: options.nonce,
    commitment: await sha256(serverSeed),
    digest: bytesToHex(await hmacBytes(serverSeed, message)),
  }
}

export async function verifyKenoRound(round: KenoRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createKenoRound({
    stake: round.stake,
    selected: round.selected,
    risk: round.risk,
    rtp: round.rtp,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    serverSeed: round.serverSeed,
    now: round.startedAt,
  })
  return regenerated.digest === round.digest && regenerated.drawn.join(',') === round.drawn.join(',')
}
