export type CrashMathSettings = {
  targetRtp: number
  maxMultiplier: number
  curveMs: number
}

export type FairCrashRound = {
  roundId: string
  nonce: number
  clientSeed: string
  serverSeed: string
  commitment: string
  digest: string
  crashPoint: number
  createdAt: string
}

export type CrashChartPoint = {
  elapsedSeconds: number
  multiplier: number
  x: number
  y: number
}

export type CrashChart = {
  width: number
  height: number
  points: CrashChartPoint[]
  polyline: string
  endpoint: CrashChartPoint
  xTicks: Array<{ value: number; x: number }>
  yTicks: Array<{ value: number; y: number }>
  xMax: number
  yMax: number
  gridZoomX: number
  gridZoomY: number
}

const encoder = new TextEncoder()
const TWO_POW_52 = 4_503_599_627_370_496

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function crashPointFromDigest(digest: string, settings: CrashMathSettings) {
  const uniform = Number.parseInt(digest.slice(0, 13), 16) / TWO_POW_52
  const rtp = Math.max(.5, Math.min(.999, settings.targetRtp / 100))
  const raw = Math.floor((rtp / Math.max(Number.EPSILON, 1 - uniform)) * 100) / 100
  return Math.min(settings.maxMultiplier, Math.max(1, raw))
}

export async function createFairCrashRound(
  settings: CrashMathSettings,
  clientSeed: string,
  nonce: number,
  serverSeed: string = crypto.randomUUID(),
): Promise<FairCrashRound> {
  const digest = await sha256(`${serverSeed}:${clientSeed}:${nonce}`)
  return {
    roundId: `altin-rota-${Date.now()}-${nonce}`,
    nonce,
    clientSeed,
    serverSeed,
    commitment: await sha256(serverSeed),
    digest,
    crashPoint: crashPointFromDigest(digest, settings),
    createdAt: new Date().toISOString(),
  }
}

export async function verifyFairCrashRound(round: FairCrashRound, settings: CrashMathSettings) {
  const commitment = await sha256(round.serverSeed)
  const digest = await sha256(`${round.serverSeed}:${round.clientSeed}:${round.nonce}`)
  const crashPoint = crashPointFromDigest(digest, settings)
  return commitment === round.commitment && digest === round.digest && crashPoint === round.crashPoint
}

export function multiplierAt(elapsedMs: number, curveMs: number) {
  return Math.max(1, Math.exp(Math.max(0, elapsedMs) / Math.max(1000, curveMs)))
}

export function flightDurationFor(multiplier: number, curveMs: number) {
  return Math.max(0, Math.log(Math.max(1, multiplier)) * Math.max(1000, curveMs))
}

/**
 * Produces the graph line and the aircraft endpoint from the same projection.
 * X is elapsed flight time; Y is the actual multiplier on a linear scale.
 */
export function buildCrashChart(multiplier: number, curveMs: number): CrashChart {
  const width = 1000
  const height = 500
  const margin = { top: 28, right: 34, bottom: 46, left: 58 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const currentMultiplier = Math.max(1, multiplier)
  const elapsedSeconds = flightDurationFor(currentMultiplier, curveMs) / 1000
  // Continuous domains avoid the visible jump caused by switching between
  // discrete 2×/3×/5× axis ceilings. Once the aircraft approaches the edge,
  // the chart expands smoothly on every animation tick.
  const xMax = Math.max(5, elapsedSeconds * 1.14)
  const yMax = Math.max(2, 1 + (currentMultiplier - 1) * 1.18)
  // Keep the aircraft in its upper-right tracking zone while the SVG pattern
  // contracts continuously beneath it. A pattern is constant-cost, so neither
  // axis needs a zoom ceiling on high-multiplier rounds.
  const gridZoomX = xMax / 5
  const gridZoomY = yMax - 1
  const project = (seconds: number, value: number): CrashChartPoint => ({
    elapsedSeconds: seconds,
    multiplier: value,
    x: margin.left + (seconds / xMax) * plotWidth,
    y: margin.top + (1 - (value - 1) / (yMax - 1)) * plotHeight,
  })
  const sampleCount = Math.max(2, Math.min(140, Math.ceil(elapsedSeconds * 14)))
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const seconds = elapsedSeconds * (index / (sampleCount - 1))
    return project(seconds, multiplierAt(seconds * 1000, curveMs))
  })
  const endpoint = project(elapsedSeconds, currentMultiplier)
  points[points.length - 1] = endpoint
  const xTicks = Array.from({ length: 6 }, (_, index) => ({
    value: xMax * index / 5,
    x: margin.left + plotWidth * index / 5,
  }))
  const yTicks = Array.from({ length: 6 }, (_, index) => ({
    value: 1 + (yMax - 1) * index / 5,
    y: margin.top + plotHeight * (1 - index / 5),
  }))
  return {
    width,
    height,
    points,
    polyline: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
    endpoint,
    xTicks,
    yTicks,
    xMax,
    yMax,
    gridZoomX,
    gridZoomY,
  }
}

export function adaptiveBetStep(amount: number) {
  if (amount < 100) return 10
  if (amount < 1_000) return 100
  if (amount < 10_000) return 1_000
  if (amount < 100_000) return 10_000
  if (amount < 1_000_000) return 100_000
  return 1_000_000
}

export function adjustBetAmount(amount: number, direction: -1 | 1, minimum: number, maximum: number) {
  const safeMinimum = Math.max(0, minimum)
  const safeMaximum = Math.max(safeMinimum, maximum)
  const reference = direction < 0 ? Math.max(safeMinimum, amount - Math.max(1e-9, Math.abs(amount) * 1e-12)) : amount
  const next = amount + adaptiveBetStep(reference) * direction
  return Math.round(Math.max(safeMinimum, Math.min(safeMaximum, next)) * 100) / 100
}

export function canCashOut(currentMultiplier: number, crashPoint: number) {
  return currentMultiplier >= 1 && currentMultiplier < crashPoint
}

export function multiplierTone(multiplier: number) {
  if (multiplier >= 50) return 'efsane'
  if (multiplier >= 10) return 'yüksek'
  if (multiplier >= 2) return 'güçlü'
  return 'sakin'
}
