import { bytesToHex, hmacBytes, randomUnitStream, secureSeed, sha256 } from '../originals/fair-rng'

export const GEM_IDS = ['emerald', 'amethyst', 'citrine', 'ruby', 'cyan', 'rose', 'sapphire'] as const
export type GemId = (typeof GEM_IDS)[number]
export type GemCombination = 'none' | 'pair' | 'two-pair' | 'three' | 'full-house' | 'four' | 'five'

export type GemPayout = {
  combination: GemCombination
  label: string
  numerator: number
  probability: number
  multiplier: number
}

export type YediCevherRound = {
  algorithm: 'yedi-cevher-hmac-sha256-v1'
  roundId: string
  startedAt: string
  settledAt: string
  stake: number
  gems: GemId[]
  combination: GemCombination
  multiplier: number
  grossPayout: number
  rtp: number
  clientSeed: string
  serverSeed: string
  nonce: number
  commitment: string
  digest: string
}

export type CreateYediCevherOptions = {
  stake: number
  rtp?: number
  clientSeed: string
  nonce: number
  serverSeed?: string
  now?: string
}

export const GEM_OUTCOME_COUNT = 7 ** 5
export const NATURAL_GEM_RTP = (16_520 / GEM_OUTCOME_COUNT) * 100

const basePayouts: Array<Omit<GemPayout, 'probability' | 'multiplier'> & { multiplier: number }> = [
  { combination: 'none', label: 'Eşleşme Yok', numerator: 2_520, multiplier: 0 },
  { combination: 'pair', label: 'Bir Çift', numerator: 8_400, multiplier: .1 },
  { combination: 'two-pair', label: 'İki Çift', numerator: 3_150, multiplier: 2 },
  { combination: 'three', label: 'Üçlü', numerator: 2_100, multiplier: 3 },
  { combination: 'full-house', label: 'Full House', numerator: 420, multiplier: 4 },
  { combination: 'four', label: 'Dörtlü', numerator: 210, multiplier: 5 },
  { combination: 'five', label: 'Beşli', numerator: 7, multiplier: 50 },
]

export function roundGemMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function gemPayoutTable(targetRtp = NATURAL_GEM_RTP): GemPayout[] {
  const scale = Math.max(1, Math.min(100, targetRtp)) / NATURAL_GEM_RTP
  return basePayouts.map((row) => ({
    ...row,
    probability: row.numerator / GEM_OUTCOME_COUNT,
    multiplier: row.multiplier * scale,
  }))
}

export function expectedGemRtp(table = gemPayoutTable()) {
  return table.reduce((sum, row) => sum + row.probability * row.multiplier, 0) * 100
}

export function classifyGems(gems: readonly GemId[]): GemCombination {
  const counts = [...new Map(gems.map((gem) => [gem, gems.filter((item) => item === gem).length])).values()].sort((a, b) => b - a)
  if (counts[0] === 5) return 'five'
  if (counts[0] === 4) return 'four'
  if (counts[0] === 3 && counts[1] === 2) return 'full-house'
  if (counts[0] === 3) return 'three'
  if (counts[0] === 2 && counts[1] === 2) return 'two-pair'
  if (counts[0] === 2) return 'pair'
  return 'none'
}

export async function createYediCevherRound(options: CreateYediCevherOptions): Promise<YediCevherRound> {
  const serverSeed = options.serverSeed ?? secureSeed()
  const rtp = Math.max(1, Math.min(100, options.rtp ?? NATURAL_GEM_RTP))
  const message = `${options.clientSeed}:${options.nonce}:yedi-cevher`
  const units = await randomUnitStream(serverSeed, message, 5)
  const gems = units.map((unit) => GEM_IDS[Math.floor(unit * GEM_IDS.length)])
  const combination = classifyGems(gems)
  const multiplier = gemPayoutTable(rtp).find((row) => row.combination === combination)?.multiplier ?? 0
  const startedAt = options.now ?? new Date().toISOString()
  return {
    algorithm: 'yedi-cevher-hmac-sha256-v1',
    roundId: `yedi-cevher-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    startedAt,
    settledAt: startedAt,
    stake: roundGemMoney(Math.max(0, options.stake)),
    gems,
    combination,
    multiplier,
    grossPayout: roundGemMoney(Math.max(0, options.stake) * multiplier),
    rtp,
    clientSeed: options.clientSeed,
    serverSeed,
    nonce: options.nonce,
    commitment: await sha256(serverSeed),
    digest: bytesToHex(await hmacBytes(serverSeed, message)),
  }
}

export async function verifyYediCevherRound(round: YediCevherRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createYediCevherRound({
    stake: round.stake,
    rtp: round.rtp,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    serverSeed: round.serverSeed,
    now: round.startedAt,
  })
  return regenerated.digest === round.digest && JSON.stringify(regenerated.gems) === JSON.stringify(round.gems) && regenerated.grossPayout === round.grossPayout
}
