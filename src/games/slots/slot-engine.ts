export type SlotSymbolId = 'seven' | 'bar' | 'bell' | 'horseshoe' | 'cherry' | 'clover' | 'lemon' | 'melon'

export type SlotSymbol = {
  id: SlotSymbolId
  label: string
  image: string
  multiplier: number
}

export type SlotWin = {
  line: number
  lineName: string
  symbol: SlotSymbolId
  count: number
  multiplier: number
  returnAmount: number
  cells: Array<[number, number]>
}

export type SlotSpinResult = {
  stops: number[]
  grid: SlotSymbolId[][]
  wins: SlotWin[]
  grossReturn: number
  net: number
}

export const SLOT_SYMBOLS: Record<SlotSymbolId, SlotSymbol> = {
  seven: { id: 'seven', label: 'Şanslı 7', image: '/assets/slots/kiraz-77/Lucky7_rainbow.png', multiplier: 300 },
  bar: { id: 'bar', label: 'Üçlü BAR', image: '/assets/slots/kiraz-77/Bar3.png', multiplier: 140 },
  bell: { id: 'bell', label: 'Altın zil', image: '/assets/slots/kiraz-77/bell.png', multiplier: 80 },
  horseshoe: { id: 'horseshoe', label: 'At nalı', image: '/assets/slots/kiraz-77/horseshoe.png', multiplier: 48 },
  cherry: { id: 'cherry', label: 'Kiraz', image: '/assets/slots/kiraz-77/cherries.png', multiplier: 32 },
  clover: { id: 'clover', label: 'Yonca', image: '/assets/slots/kiraz-77/clover.png', multiplier: 24 },
  lemon: { id: 'lemon', label: 'Limon', image: '/assets/slots/kiraz-77/lemon.png', multiplier: 16 },
  melon: { id: 'melon', label: 'Karpuz', image: '/assets/slots/kiraz-77/melon.png', multiplier: 12 },
}

export const KIRAZ_REELS: SlotSymbolId[][] = [
  ['cherry', 'lemon', 'melon', 'clover', 'cherry', 'bar', 'lemon', 'horseshoe', 'melon', 'cherry', 'bell', 'lemon', 'clover', 'melon', 'cherry', 'seven', 'lemon', 'horseshoe', 'melon', 'cherry', 'bar', 'clover', 'lemon', 'melon', 'cherry', 'bell', 'lemon', 'horseshoe', 'cherry', 'melon', 'clover', 'lemon'],
  ['lemon', 'cherry', 'melon', 'horseshoe', 'clover', 'lemon', 'bar', 'cherry', 'melon', 'bell', 'lemon', 'clover', 'cherry', 'horseshoe', 'melon', 'lemon', 'seven', 'cherry', 'clover', 'melon', 'lemon', 'bar', 'cherry', 'horseshoe', 'melon', 'clover', 'lemon', 'bell', 'cherry', 'melon', 'lemon', 'clover'],
  ['melon', 'lemon', 'cherry', 'clover', 'horseshoe', 'melon', 'lemon', 'cherry', 'bar', 'clover', 'lemon', 'bell', 'melon', 'cherry', 'horseshoe', 'lemon', 'clover', 'melon', 'seven', 'lemon', 'cherry', 'bar', 'melon', 'clover', 'lemon', 'horseshoe', 'cherry', 'melon', 'bell', 'lemon', 'clover', 'cherry'],
]

export const SLOT_PAYLINES = [
  { name: 'Üst çizgi', rows: [0, 0, 0] },
  { name: 'Orta çizgi', rows: [1, 1, 1] },
  { name: 'Alt çizgi', rows: [2, 2, 2] },
  { name: 'Aşağı çapraz', rows: [0, 1, 2] },
  { name: 'Yukarı çapraz', rows: [2, 1, 0] },
] as const

export function secureSlotRandom(max: number) {
  if (max <= 0) return 0
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] % max
}

export function gridFromStops(stops: number[], reels = KIRAZ_REELS): SlotSymbolId[][] {
  return Array.from({ length: 3 }, (_, row) => reels.map((reel, reelIndex) => {
    const stop = stops[reelIndex] ?? 0
    return reel[(stop + row - 1 + reel.length) % reel.length]
  }))
}

export function nextStops(previous: number[], held: boolean[], reels = KIRAZ_REELS) {
  return reels.map((reel, index) => held[index] ? previous[index] : secureSlotRandom(reel.length))
}

export function evaluateSlot(stops: number[], wager: number, reels = KIRAZ_REELS): SlotSpinResult {
  const grid = gridFromStops(stops, reels)
  const lineBet = wager / SLOT_PAYLINES.length
  const wins: SlotWin[] = []

  SLOT_PAYLINES.forEach((payline, line) => {
    const ids = payline.rows.map((row, reel) => grid[row][reel])
    const cells = payline.rows.map((row, reel) => [row, reel] as [number, number])
    if (ids[0] === ids[1] && ids[1] === ids[2]) {
      const multiplier = SLOT_SYMBOLS[ids[0]].multiplier
      wins.push({ line, lineName: payline.name, symbol: ids[0], count: 3, multiplier, returnAmount: lineBet * multiplier, cells })
      return
    }
    if (ids[0] === 'cherry' && ids[1] === 'cherry') {
      wins.push({ line, lineName: payline.name, symbol: 'cherry', count: 2, multiplier: 8, returnAmount: lineBet * 8, cells: cells.slice(0, 2) })
    }
  })

  const grossReturn = wins.reduce((sum, win) => sum + win.returnAmount, 0)
  return { stops, grid, wins, grossReturn, net: grossReturn - wager }
}

export function winningCellSet(wins: SlotWin[]) {
  return new Set(wins.flatMap((win) => win.cells.map(([row, reel]) => `${row}-${reel}`)))
}
