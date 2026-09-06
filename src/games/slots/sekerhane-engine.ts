import type { SlotPotentialSettings } from '../../data/casino-admin'
import type { SlotFlowDecision } from './slot-flow-engine'

export const SEKERHANE_SIZE = 7
export const SEKERHANE_MIN_CLUSTER = 5
export const SEKERHANE_MAX_WIN_X = 25_000

export type SekerhaneSymbolId =
  | 'ayva'
  | 'nar'
  | 'menekse'
  | 'antep-yildizi'
  | 'gul-ayicigi'
  | 'safran-ayicigi'
  | 'visne-ayicigi'
  | 'scatter'

export type SekerhaneGrid = SekerhaneSymbolId[][]
export type SekerhaneRandom = (max: number) => number

export type SekerhaneSpot = {
  hits: number
  multiplier: number
}

export type SekerhaneCluster = {
  symbol: Exclude<SekerhaneSymbolId, 'scatter'>
  cells: Array<{ row: number; column: number }>
  symbolPayoutX: number
  spotMultipliers: number[]
  spotMultiplierSources: Array<{ row: number; column: number; multiplier: number }>
  spotMultiplier: number
  payoutX: number
}

export type SekerhaneCascade = {
  index: number
  grid: SekerhaneGrid
  nextGrid: SekerhaneGrid
  spots: SekerhaneSpot[][]
  nextSpots: SekerhaneSpot[][]
  clusters: SekerhaneCluster[]
  winningCells: string[]
  payout: number
  payoutX: number
  sourceRows: number[][]
  fallRows: number[][]
}

export type SekerhaneSpinResult = {
  initialGrid: SekerhaneGrid
  finalGrid: SekerhaneGrid
  initialSpots: SekerhaneSpot[][]
  finalSpots: SekerhaneSpot[][]
  cascades: SekerhaneCascade[]
  scatterCount: number
  freeSpinsAwarded: number
  grossReturn: number
  winMultiple: number
  capped: boolean
  potentialCells?: Array<{ row: number; column: number; value: number }>
  flowDecision?: SlotFlowDecision
}

export type SekerhaneMathProfile = {
  payoutScale: number
  bonusPayoutScale: number
  baseScatterRate: number
  bonusScatterRate: number
  maxCascades: number
  minimumCluster: number
  maxWinX: number
  cascadeAffinityPercent: number
  normalBuyPayoutBoost: number
  superBuyPayoutBoost: number
  retriggerSpins: number
  valueWeights: Partial<Record<Exclude<SekerhaneSymbolId, 'scatter'>, number>>
}

export type SekerhaneSpinOptions = {
  bonusMode?: boolean
  superBonus?: boolean
  purchaseMode?: 'normal' | 'super'
  spots?: SekerhaneSpot[][]
  profile?: Partial<SekerhaneMathProfile>
  flow?: SlotFlowDecision
  potential?: SlotPotentialSettings
}

export const SEKERHANE_SYMBOLS: Record<SekerhaneSymbolId, {
  label: string
  shortLabel: string
  family: 'premium' | 'classic' | 'bear' | 'scatter'
  image: string
  weight: number
  payouts: number[]
}> = {
  ayva: { label: 'Ayva Mücevheri', shortLabel: 'AYVA', family: 'premium', image: '/assets/slots/sekerhane-1024/ayva-v1.png', weight: 700, payouts: [1, 1.5, 1.75, 2, 2.5, 5, 7.5, 15, 35, 70, 150] },
  nar: { label: 'Nar Kalbi', shortLabel: 'NAR', family: 'premium', image: '/assets/slots/sekerhane-1024/nar-v1.png', weight: 850, payouts: [.75, 1, 1.25, 1.5, 2, 4, 6, 12.5, 30, 60, 100] },
  menekse: { label: 'Menekşe Bonbonu', shortLabel: 'MENEKŞE', family: 'premium', image: '/assets/slots/sekerhane-1024/menekse-v1.png', weight: 1_050, payouts: [.5, .75, 1, 1.25, 1.5, 3, 4.5, 10, 20, 40, 60] },
  'antep-yildizi': { label: 'Davut Yıldızı Lokumu', shortLabel: 'YILDIZ', family: 'classic', image: '/assets/slots/sekerhane-1024/davut-yildizi-v1.png', weight: 1_300, payouts: [.4, .5, .75, 1, 1.25, 2, 3, 5, 10, 20, 40] },
  'gul-ayicigi': { label: 'Gül Baykuşu', shortLabel: 'BAYKUŞ', family: 'bear', image: '/assets/slots/sekerhane-1024/gul-baykusu-v1.png', weight: 1_550, payouts: [.3, .4, .5, .75, 1, 1.5, 2.5, 3.5, 8, 15, 30] },
  'safran-ayicigi': { label: 'Safran Ayıcığı', shortLabel: 'SAFRAN', family: 'bear', image: '/assets/slots/sekerhane-1024/safran-ayicigi-v1.png', weight: 1_800, payouts: [.25, .3, .4, .5, .75, 1.25, 2, 3, 6, 12, 25] },
  'visne-ayicigi': { label: 'Vişne Ayıcığı', shortLabel: 'VİŞNE', family: 'bear', image: '/assets/slots/sekerhane-1024/visne-ayicigi-v1.png', weight: 2_050, payouts: [.2, .25, .3, .4, .5, 1, 1.5, 2.5, 5, 10, 20] },
  scatter: { label: 'Narin Baykuşu', shortLabel: 'NARİN', family: 'scatter', image: '/assets/slots/sekerhane-1024/narin-scatter-v1.png', weight: 0, payouts: [] },
}

export const DEFAULT_SEKERHANE_PROFILE: SekerhaneMathProfile = {
  payoutScale: 0.9,
  bonusPayoutScale: 0.95,
  baseScatterRate: 72,
  bonusScatterRate: 95,
  maxCascades: 20,
  minimumCluster: SEKERHANE_MIN_CLUSTER,
  maxWinX: SEKERHANE_MAX_WIN_X,
  cascadeAffinityPercent: 18,
  normalBuyPayoutBoost: 1.62,
  // 500x başlangıç haritası, bağımsız uzun örneklemde hedef RTP bandına
  // bu ölçekle oturuyor. Normal satın alım ölçeğinden ayrı tutulur.
  superBuyPayoutBoost: 1.98,
  retriggerSpins: 10,
  valueWeights: {},
}

function cryptoRandom(max: number) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % Math.max(1, max)
}

function cloneGrid(grid: SekerhaneGrid): SekerhaneGrid {
  return grid.map((row) => [...row])
}

export function emptySekerhaneSpots(): SekerhaneSpot[][] {
  return Array.from({ length: SEKERHANE_SIZE }, () =>
    Array.from({ length: SEKERHANE_SIZE }, () => ({ hits: 0, multiplier: 0 })),
  )
}

export function superSekerhaneSpots(): SekerhaneSpot[][] {
  return Array.from({ length: SEKERHANE_SIZE }, () =>
    Array.from({ length: SEKERHANE_SIZE }, () => ({ hits: 2, multiplier: 2 })),
  )
}

function cloneSpots(spots: SekerhaneSpot[][]) {
  return spots.map((row) => row.map((spot) => ({ ...spot })))
}

export function spotMultiplierForHits(hits: number) {
  if (hits < 2) return 0
  return Math.min(1024, 2 ** (hits - 1))
}

export function freeSpinsForSekerhane(scatterCount: number) {
  if (scatterCount >= 7) return 30
  if (scatterCount === 6) return 20
  if (scatterCount === 5) return 15
  if (scatterCount === 4) return 12
  if (scatterCount === 3) return 10
  return 0
}

function symbolPayoutX(symbol: Exclude<SekerhaneSymbolId, 'scatter'>, count: number) {
  const index = Math.min(15, Math.max(5, count)) - 5
  return SEKERHANE_SYMBOLS[symbol].payouts[index] ?? 0
}

export function findSekerhaneClusters(
  grid: SekerhaneGrid,
  minimumCluster = SEKERHANE_MIN_CLUSTER,
): Array<{ symbol: Exclude<SekerhaneSymbolId, 'scatter'>; cells: Array<{ row: number; column: number }> }> {
  const visited = new Set<string>()
  const clusters: Array<{ symbol: Exclude<SekerhaneSymbolId, 'scatter'>; cells: Array<{ row: number; column: number }> }> = []
  for (let row = 0; row < SEKERHANE_SIZE; row += 1) {
    for (let column = 0; column < SEKERHANE_SIZE; column += 1) {
      const key = `${row}-${column}`
      const symbol = grid[row]?.[column]
      if (!symbol || symbol === 'scatter' || visited.has(key)) continue
      const cells: Array<{ row: number; column: number }> = []
      const queue = [{ row, column }]
      visited.add(key)
      while (queue.length) {
        const current = queue.shift()!
        cells.push(current)
        ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
          const nextRow = current.row + dr
          const nextColumn = current.column + dc
          const nextKey = `${nextRow}-${nextColumn}`
          if (nextRow < 0 || nextRow >= SEKERHANE_SIZE || nextColumn < 0 || nextColumn >= SEKERHANE_SIZE) return
          if (visited.has(nextKey) || grid[nextRow][nextColumn] !== symbol) return
          visited.add(nextKey)
          queue.push({ row: nextRow, column: nextColumn })
        })
      }
      if (cells.length >= minimumCluster) clusters.push({ symbol, cells })
    }
  }
  return clusters
}

function randomSymbol(random: SekerhaneRandom, profile: SekerhaneMathProfile, bonusMode: boolean): SekerhaneSymbolId {
  const scatterRate = bonusMode ? profile.bonusScatterRate : profile.baseScatterRate
  if (random(10_000) < scatterRate) return 'scatter'
  const entries = (Object.keys(SEKERHANE_SYMBOLS) as SekerhaneSymbolId[])
    .filter((symbol): symbol is Exclude<SekerhaneSymbolId, 'scatter'> => symbol !== 'scatter')
    .map((symbol) => ({ symbol, weight: Math.max(1, profile.valueWeights[symbol] ?? SEKERHANE_SYMBOLS[symbol].weight) }))
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random(total)
  for (const entry of entries) {
    if (roll < entry.weight) return entry.symbol
    roll -= entry.weight
  }
  return 'visne-ayicigi'
}

function ensureSekerhaneScatters(
  grid: SekerhaneGrid,
  count: number,
  random: SekerhaneRandom,
) {
  let current = grid.flat().filter((symbol) => symbol === 'scatter').length
  const cells = Array.from({ length: SEKERHANE_SIZE ** 2 }, (_, index) => ({
    row: Math.floor(index / SEKERHANE_SIZE),
    column: index % SEKERHANE_SIZE,
  })).filter(({ row, column }) => grid[row][column] !== 'scatter')
  while (current < count && cells.length) {
    const index = random(cells.length)
    const cell = cells.splice(index, 1)[0]
    grid[cell.row][cell.column] = 'scatter'
    current += 1
  }
}

function decorateSekerhanePotential(
  grid: SekerhaneGrid,
  spots: SekerhaneSpot[][],
  random: SekerhaneRandom,
  potential: SlotPotentialSettings,
  flow: SlotFlowDecision,
) {
  const potentialCells: Array<{ row: number; column: number; value: number }> = []
  if (!potential.enabled || !flow.showPotential || flow.bonusMode) return potentialCells
  const minimum = Math.max(0, Math.round(potential.displayOnlyMinItems))
  const maximum = Math.max(minimum, Math.round(potential.displayOnlyMaxItems))
  const count = minimum + random(Math.max(1, maximum - minimum + 1))
  const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024].filter(
    (value) => value >= potential.displayOnlyHighValueMinX && value <= potential.displayOnlyHighValueMaxX,
  )
  const candidates = Array.from({ length: SEKERHANE_SIZE ** 2 }, (_, index) => ({
    row: Math.floor(index / SEKERHANE_SIZE),
    column: index % SEKERHANE_SIZE,
  }))
  for (let item = 0; item < count && candidates.length; item += 1) {
    const index = random(candidates.length)
    const cell = candidates.splice(index, 1)[0]
    const value = values.length ? values[random(values.length)] : 64
    const hits = Math.max(2, Math.round(Math.log2(value)) + 1)
    if (spots[cell.row][cell.column].multiplier >= value) continue
    spots[cell.row][cell.column] = { hits, multiplier: value }
    potentialCells.push({ ...cell, value })
  }

  if (random(10_000) < potential.nearMissChancePercent * 100) {
    const symbols = (Object.keys(SEKERHANE_SYMBOLS) as SekerhaneSymbolId[]).filter(
      (symbol): symbol is Exclude<SekerhaneSymbolId, 'scatter'> => symbol !== 'scatter',
    )
    const row = random(SEKERHANE_SIZE - 1)
    const column = random(SEKERHANE_SIZE - 1)
    const symbol = symbols[random(symbols.length)]
    const snapshot = cloneGrid(grid)
    ;[[row, column], [row + 1, column], [row, column + 1], [row + 1, column + 1]].forEach(
      ([targetRow, targetColumn]) => { grid[targetRow][targetColumn] = symbol },
    )
    if (findSekerhaneClusters(grid, SEKERHANE_MIN_CLUSTER).length) {
      snapshot.forEach((sourceRow, sourceIndex) => { grid[sourceIndex] = [...sourceRow] })
    }
  }
  return potentialCells
}

export function createSekerhaneGrid(
  random: SekerhaneRandom = cryptoRandom,
  profile: SekerhaneMathProfile = DEFAULT_SEKERHANE_PROFILE,
  bonusMode = false,
): SekerhaneGrid {
  return Array.from({ length: SEKERHANE_SIZE }, () =>
    Array.from({ length: SEKERHANE_SIZE }, () => randomSymbol(random, profile, bonusMode)),
  )
}

function collapseGrid(
  grid: SekerhaneGrid,
  winningCells: Set<string>,
  random: SekerhaneRandom,
  profile: SekerhaneMathProfile,
  bonusMode: boolean,
) {
  const nextGrid = Array.from({ length: SEKERHANE_SIZE }, () => Array<SekerhaneSymbolId>(SEKERHANE_SIZE))
  const sourceRows = Array.from({ length: SEKERHANE_SIZE }, () => Array(SEKERHANE_SIZE).fill(-1))
  const fallRows = Array.from({ length: SEKERHANE_SIZE }, () => Array(SEKERHANE_SIZE).fill(0))
  for (let column = 0; column < SEKERHANE_SIZE; column += 1) {
    const survivors: Array<{ symbol: SekerhaneSymbolId; sourceRow: number }> = []
    for (let row = SEKERHANE_SIZE - 1; row >= 0; row -= 1) {
      if (!winningCells.has(`${row}-${column}`)) survivors.push({ symbol: grid[row][column], sourceRow: row })
    }
    let survivorIndex = 0
    for (let row = SEKERHANE_SIZE - 1; row >= 0; row -= 1) {
      const survivor = survivors[survivorIndex]
      if (survivor) {
        nextGrid[row][column] = survivor.symbol
        sourceRows[row][column] = survivor.sourceRow
        fallRows[row][column] = row - survivor.sourceRow
        survivorIndex += 1
      } else {
        const affinity = Math.min(40, profile.cascadeAffinityPercent * (bonusMode ? 1.2 : 1))
        const neighbors = [nextGrid[row + 1]?.[column], nextGrid[row]?.[column - 1]]
          .filter((symbol): symbol is Exclude<SekerhaneSymbolId, 'scatter'> => Boolean(symbol && symbol !== 'scatter'))
        nextGrid[row][column] = neighbors.length && random(10_000) < affinity * 100
          ? neighbors[random(neighbors.length)]
          : randomSymbol(random, profile, bonusMode)
        sourceRows[row][column] = -1
        fallRows[row][column] = row + 1
      }
    }
  }
  return { nextGrid, sourceRows, fallRows }
}

export function runSekerhaneSpin(
  wager: number,
  random: SekerhaneRandom = cryptoRandom,
  options: SekerhaneSpinOptions = {},
): SekerhaneSpinResult {
  const profile: SekerhaneMathProfile = { ...DEFAULT_SEKERHANE_PROFILE, ...options.profile, valueWeights: { ...DEFAULT_SEKERHANE_PROFILE.valueWeights, ...options.profile?.valueWeights } }
  const bonusMode = Boolean(options.bonusMode)
  if (options.flow) {
    profile.cascadeAffinityPercent = Math.min(
      100,
      profile.cascadeAffinityPercent * options.flow.eventWeightMultiplier,
    )
    if (bonusMode) profile.bonusScatterRate *= options.flow.bonusWeightMultiplier
    else profile.baseScatterRate *= options.flow.bonusWeightMultiplier
  }
  let grid = createSekerhaneGrid(random, profile, bonusMode)
  if (options.flow?.strongTease) {
    ensureSekerhaneScatters(grid, options.flow.convertTease ? 3 : 2, random)
  }
  const initialGrid = cloneGrid(grid)
  let spots = options.spots ? cloneSpots(options.spots) : options.superBonus ? superSekerhaneSpots() : emptySekerhaneSpots()
  const initialSpots = cloneSpots(spots)
  const cascades: SekerhaneCascade[] = []
  let grossReturn = 0
  let capped = false
  const purchaseBoost = options.purchaseMode === 'super'
    ? profile.superBuyPayoutBoost
    : options.purchaseMode === 'normal'
      ? profile.normalBuyPayoutBoost
      : 1
  const payoutScale = bonusMode ? profile.bonusPayoutScale * purchaseBoost : profile.payoutScale

  for (let index = 0; index < profile.maxCascades; index += 1) {
    const rawClusters = findSekerhaneClusters(grid, profile.minimumCluster)
    if (!rawClusters.length) break
    const winningCells = new Set(rawClusters.flatMap((cluster) => cluster.cells.map((cell) => `${cell.row}-${cell.column}`)))
    const nextSpots = cloneSpots(spots)
    winningCells.forEach((key) => {
      const [row, column] = key.split('-').map(Number)
      const hits = nextSpots[row][column].hits + 1
      nextSpots[row][column] = { hits, multiplier: spotMultiplierForHits(hits) }
    })
    const clusters: SekerhaneCluster[] = rawClusters.map((cluster) => {
      const spotMultiplierSources = cluster.cells
        .map(({ row, column }) => ({ row, column, multiplier: nextSpots[row][column].multiplier }))
        .filter((source) => source.multiplier > 0)
      const active = spotMultiplierSources.map((source) => source.multiplier)
      const spotMultiplier = active.length ? active.reduce((sum, multiplier) => sum + multiplier, 0) : 1
      const baseX = symbolPayoutX(cluster.symbol, cluster.cells.length)
      return { ...cluster, symbolPayoutX: baseX, spotMultipliers: active, spotMultiplierSources, spotMultiplier, payoutX: baseX * spotMultiplier * payoutScale }
    })
    const payoutX = clusters.reduce((sum, cluster) => sum + cluster.payoutX, 0)
    let payout = Math.round(wager * payoutX)
    const maximumReturn = Math.round(wager * profile.maxWinX)
    if (grossReturn + payout >= maximumReturn) {
      payout = Math.max(0, maximumReturn - grossReturn)
      capped = true
    }
    grossReturn += payout
    const { nextGrid, sourceRows, fallRows } = collapseGrid(grid, winningCells, random, profile, bonusMode)
    cascades.push({ index, grid: cloneGrid(grid), nextGrid: cloneGrid(nextGrid), spots: cloneSpots(spots), nextSpots: cloneSpots(nextSpots), clusters, winningCells: [...winningCells], payout, payoutX, sourceRows, fallRows })
    grid = nextGrid
    spots = nextSpots
    if (capped) break
  }

  const scatterCount = grid.flat().filter((symbol) => symbol === 'scatter').length
  const potentialCells = options.flow && options.potential
    ? decorateSekerhanePotential(grid, spots, random, options.potential, options.flow)
    : []
  if (!cascades.length && potentialCells.length) {
    grid.forEach((row, rowIndex) => { initialGrid[rowIndex] = [...row] })
    spots.forEach((row, rowIndex) => {
      initialSpots[rowIndex] = row.map((spot) => ({ ...spot }))
    })
  }
  if (cascades.length && potentialCells.length) {
    cascades.at(-1)!.nextGrid = cloneGrid(grid)
    cascades.at(-1)!.nextSpots = cloneSpots(spots)
  }
  return {
    initialGrid,
    finalGrid: cloneGrid(grid),
    initialSpots,
    finalSpots: cloneSpots(spots),
    cascades,
    scatterCount,
    freeSpinsAwarded:
      bonusMode && scatterCount >= 3
        ? Math.max(0, Math.round(profile.retriggerSpins))
        : freeSpinsForSekerhane(scatterCount),
    grossReturn,
    winMultiple: wager ? grossReturn / wager : 0,
    capped,
    potentialCells,
    flowDecision: options.flow,
  }
}
