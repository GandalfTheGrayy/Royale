export type MinesMode = 'free' | 'depth'
export type MinesPhase = 'idle' | 'active' | 'won' | 'lost' | 'cashed'
export type DepthRisk = 'temkinli' | 'keskin' | 'ucurum'

export type FairMinesRound = {
  algorithm: 'obsidyen-mines-hmac-sha256-v1'
  roundId: string
  mode: MinesMode
  phase: MinesPhase
  startedAt: string
  settledAt?: string
  stake: number
  rtp: number
  mineCount: number
  depthRisk?: DepthRisk
  depthHazards: number
  rows: number
  columns: number
  mineIndices: number[]
  boardOrder: number[]
  revealed: number[]
  safeReveals: number
  activeDepthRow: number
  currentMultiplier: number
  maxMultiplier: number
  grossPayout: number
  clientSeed: string
  nonce: number
  serverSeed: string
  commitment: string
  digest: string
}

export type CreateMinesRoundOptions = {
  mode: MinesMode
  stake: number
  rtp: number
  mineCount?: number
  depthRisk?: DepthRisk
  clientSeed: string
  nonce: number
  serverSeed?: string
  now?: string
  rows?: number
  maxMultiplier?: number
}

const encoder = new TextEncoder()

export const DEPTH_HAZARDS: Record<DepthRisk, number> = {
  temkinli: 1,
  keskin: 2,
  ucurum: 3,
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function combination(n: number, k: number) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0
  const steps = Math.min(k, n - k)
  let result = 1
  for (let index = 1; index <= steps; index += 1) result = (result * (n - steps + index)) / index
  return result
}

export function freeSurvivalProbability(mineCount: number, safeReveals: number, cells = 25) {
  if (safeReveals <= 0) return 1
  const safeCells = cells - mineCount
  if (safeReveals > safeCells) return 0
  return combination(safeCells, safeReveals) / combination(cells, safeReveals)
}

export function freeMultiplier(mineCount: number, safeReveals: number, rtp = 97, cells = 25) {
  if (safeReveals <= 0) return 1
  const survival = freeSurvivalProbability(mineCount, safeReveals, cells)
  return survival > 0 ? (rtp / 100) / survival : 0
}

export function depthMultiplier(hazardsPerRow: number, safeRows: number, rtp = 97, columns = 5) {
  if (safeRows <= 0) return 1
  const safeChance = (columns - hazardsPerRow) / columns
  return (rtp / 100) / Math.pow(safeChance, safeRows)
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function roundMultiplier(value: number) {
  return Math.floor((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

export function currentMultiplierFor(round: Pick<FairMinesRound, 'mode' | 'mineCount' | 'depthHazards' | 'safeReveals' | 'rtp' | 'columns' | 'rows' | 'maxMultiplier'>) {
  const value = round.mode === 'free'
    ? freeMultiplier(round.mineCount, round.safeReveals, round.rtp, round.columns * round.rows)
    : depthMultiplier(round.depthHazards, round.safeReveals, round.rtp, round.columns)
  return Math.min(round.maxMultiplier, value)
}

export function nextSafeProbability(round: FairMinesRound) {
  if (round.phase !== 'active') return 0
  if (round.mode === 'depth') return (round.columns - round.depthHazards) / round.columns
  const remainingCells = round.columns * round.rows - round.revealed.length
  const remainingSafe = round.columns * round.rows - round.mineCount - round.safeReveals
  return remainingCells > 0 ? remainingSafe / remainingCells : 0
}

export function nextMultiplier(round: FairMinesRound) {
  if (round.phase !== 'active') return round.currentMultiplier
  const value = round.mode === 'free'
    ? freeMultiplier(round.mineCount, round.safeReveals + 1, round.rtp, round.columns * round.rows)
    : depthMultiplier(round.depthHazards, round.safeReveals + 1, round.rtp, round.columns)
  return Math.min(round.maxMultiplier, value)
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
  const values: number[] = []
  let counter = 0
  while (values.length < count) {
    const bytes = await hmacBytes(serverSeed, `${message}:${counter}`)
    for (let offset = 0; offset + 3 < bytes.length && values.length < count; offset += 4) {
      const integer = (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0
      values.push(integer / 0x1_0000_0000)
    }
    counter += 1
  }
  return values
}

async function shuffledIndices(length: number, serverSeed: string, message: string) {
  const result = Array.from({ length }, (_, index) => index)
  const randoms = await randomStream(serverSeed, message, Math.max(1, length - 1))
  let randomIndex = 0
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randoms[randomIndex] * (index + 1))
    randomIndex += 1
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function secureSeed() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function createFairMinesRound(options: CreateMinesRoundOptions): Promise<FairMinesRound> {
  const mode = options.mode
  const columns = 5
  const rows = mode === 'free' ? 5 : Math.round(clamp(options.rows ?? 12, 6, 20))
  const maxMultiplier = Math.max(1, options.maxMultiplier ?? 1_000_000)
  const serverSeed = options.serverSeed ?? secureSeed()
  const mineCount = mode === 'free' ? Math.round(clamp(options.mineCount ?? 3, 1, 24)) : 0
  const depthRisk = mode === 'depth' ? (options.depthRisk ?? 'temkinli') : undefined
  const depthHazards = mode === 'depth' ? DEPTH_HAZARDS[depthRisk!] : 0
  const message = `${options.clientSeed}:${options.nonce}:${mode}`
  const boardOrder = await shuffledIndices(columns * rows, serverSeed, message)
  const mineIndices = mode === 'free'
    ? boardOrder.slice(0, mineCount).sort((a, b) => a - b)
    : (await Promise.all(Array.from({ length: rows }, async (_, row) => {
        const rowOrder = await shuffledIndices(columns, serverSeed, `${message}:row:${row}`)
        return rowOrder.slice(0, depthHazards).map((column) => row * columns + column)
      }))).flat().sort((a, b) => a - b)
  const commitment = await sha256(serverSeed)
  const digest = bytesToHex(await hmacBytes(serverSeed, message))
  const startedAt = options.now ?? new Date().toISOString()
  return {
    algorithm: 'obsidyen-mines-hmac-sha256-v1',
    roundId: `obsidyen-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    mode,
    phase: 'active',
    startedAt,
    stake: roundMoney(Math.max(0, options.stake)),
    rtp: clamp(options.rtp, 1, 100),
    mineCount,
    depthRisk,
    depthHazards,
    rows,
    columns,
    mineIndices,
    boardOrder,
    revealed: [],
    safeReveals: 0,
    activeDepthRow: 0,
    currentMultiplier: 1,
    maxMultiplier,
    grossPayout: 0,
    clientSeed: options.clientSeed,
    nonce: options.nonce,
    serverSeed,
    commitment,
    digest,
  }
}

export function canReveal(round: FairMinesRound, index: number) {
  if (round.phase !== 'active' || round.revealed.includes(index)) return false
  if (index < 0 || index >= round.columns * round.rows) return false
  return round.mode === 'free' || Math.floor(index / round.columns) === round.activeDepthRow
}

export function revealMinesTile(round: FairMinesRound, index: number, settledAt = new Date().toISOString()) {
  if (!canReveal(round, index)) return { round, result: 'invalid' as const }
  const revealed = [...round.revealed, index]
  if (round.mineIndices.includes(index)) {
    return {
      round: { ...round, revealed, phase: 'lost' as const, grossPayout: 0, settledAt },
      result: 'mine' as const,
    }
  }
  const safeReveals = round.safeReveals + 1
  const complete = round.mode === 'free'
    ? safeReveals >= round.columns * round.rows - round.mineCount
    : safeReveals >= round.rows
  const currentMultiplier = roundMultiplier(Math.min(round.maxMultiplier, round.mode === 'free'
    ? freeMultiplier(round.mineCount, safeReveals, round.rtp, round.columns * round.rows)
    : depthMultiplier(round.depthHazards, safeReveals, round.rtp, round.columns)))
  const grossPayout = roundMoney(round.stake * currentMultiplier)
  return {
    round: {
      ...round,
      revealed,
      safeReveals,
      activeDepthRow: round.mode === 'depth' ? Math.min(round.rows, round.activeDepthRow + 1) : 0,
      currentMultiplier,
      grossPayout,
      phase: complete ? 'won' as const : 'active' as const,
      settledAt: complete ? settledAt : undefined,
    },
    result: complete ? 'complete' as const : 'safe' as const,
  }
}

export function cashOutMinesRound(round: FairMinesRound, settledAt = new Date().toISOString()) {
  if (round.phase !== 'active' || round.safeReveals < 1) return round
  return { ...round, phase: 'cashed' as const, settledAt }
}

export async function verifyMinesRound(round: FairMinesRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createFairMinesRound({
    mode: round.mode,
    stake: round.stake,
    rtp: round.rtp,
    mineCount: round.mineCount,
    depthRisk: round.depthRisk,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    serverSeed: round.serverSeed,
    now: round.startedAt,
    rows: round.rows,
    maxMultiplier: round.maxMultiplier,
  })
  return regenerated.digest === round.digest
    && regenerated.mineIndices.join(',') === round.mineIndices.join(',')
    && regenerated.boardOrder.join(',') === round.boardOrder.join(',')
}
