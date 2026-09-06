export const EUROPEAN_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26] as const

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export type RouletteColour = 'green' | 'red' | 'black'
export type RouletteBetKind = 'straight' | 'split' | 'street' | 'corner' | 'sixline' | 'dozen' | 'column' | 'outside' | 'call'

export type BetComponent = {
  numbers: number[]
  payout: number
  units?: number
}

export type BetDefinition = {
  id: string
  label: string
  shortLabel: string
  kind: RouletteBetKind
  numbers: number[]
  payout?: number
  components?: BetComponent[]
}

export type PlacedBet = {
  definition: BetDefinition
  chips: number[]
}

export type LuckyNumber = {
  number: number
  multiplier: number
}

export const numberColour = (number: number): RouletteColour => number === 0 ? 'green' : RED_NUMBERS.has(number) ? 'red' : 'black'

export const straightBet = (number: number): BetDefinition => ({
  id: `straight-${number}`,
  label: `${number} tek sayı`,
  shortLabel: String(number),
  kind: 'straight',
  numbers: [number],
  payout: 35,
})

export const splitBet = (a: number, b: number): BetDefinition => ({
  id: `split-${Math.min(a, b)}-${Math.max(a, b)}`,
  label: `${a}/${b} ayırma`,
  shortLabel: `${a}/${b}`,
  kind: 'split',
  numbers: [a, b],
  payout: 17,
})

export const streetBet = (start: number): BetDefinition => ({
  id: `street-${start}`,
  label: `${start}-${start + 2} sokak`,
  shortLabel: `${start}–${start + 2}`,
  kind: 'street',
  numbers: [start, start + 1, start + 2],
  payout: 11,
})

export const cornerBet = (a: number): BetDefinition => ({
  id: `corner-${a}`,
  label: `${a}/${a + 1}/${a + 3}/${a + 4} köşe`,
  shortLabel: `${a}▦`,
  kind: 'corner',
  numbers: [a, a + 1, a + 3, a + 4],
  payout: 8,
})

export const sixLineBet = (start: number): BetDefinition => ({
  id: `sixline-${start}`,
  label: `${start}-${start + 5} altılı`,
  shortLabel: `${start}–${start + 5}`,
  kind: 'sixline',
  numbers: Array.from({ length: 6 }, (_, index) => start + index),
  payout: 5,
})

export const outsideBets: BetDefinition[] = [
  { id: 'low', label: '1–18', shortLabel: '1–18', kind: 'outside', numbers: Array.from({ length: 18 }, (_, i) => i + 1), payout: 1 },
  { id: 'even', label: 'Çift', shortLabel: 'ÇİFT', kind: 'outside', numbers: Array.from({ length: 18 }, (_, i) => (i + 1) * 2), payout: 1 },
  { id: 'red', label: 'Kırmızı', shortLabel: '◆', kind: 'outside', numbers: [...RED_NUMBERS], payout: 1 },
  { id: 'black', label: 'Siyah', shortLabel: '◆', kind: 'outside', numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !RED_NUMBERS.has(n)), payout: 1 },
  { id: 'odd', label: 'Tek', shortLabel: 'TEK', kind: 'outside', numbers: Array.from({ length: 18 }, (_, i) => i * 2 + 1), payout: 1 },
  { id: 'high', label: '19–36', shortLabel: '19–36', kind: 'outside', numbers: Array.from({ length: 18 }, (_, i) => i + 19), payout: 1 },
]

export const dozens: BetDefinition[] = [0, 1, 2].map((group) => ({
  id: `dozen-${group + 1}`,
  label: `${group + 1}. düzine`,
  shortLabel: `${group + 1}. 12`,
  kind: 'dozen',
  numbers: Array.from({ length: 12 }, (_, index) => group * 12 + index + 1),
  payout: 2,
}))

export const columns: BetDefinition[] = [0, 1, 2].map((row) => ({
  id: `column-${row + 1}`,
  label: `${row + 1}. kolon`,
  shortLabel: '2:1',
  kind: 'column',
  numbers: Array.from({ length: 12 }, (_, index) => index * 3 + (3 - row)),
  payout: 2,
}))

const callBet = (id: string, label: string, shortLabel: string, components: BetComponent[]): BetDefinition => ({
  id,
  label,
  shortLabel,
  kind: 'call',
  components,
  numbers: [...new Set(components.flatMap((component) => component.numbers))],
})

export const announcedBets: BetDefinition[] = [
  callBet('voisins', 'Voisins du Zéro', 'VOISINS', [
    { numbers: [0, 2, 3], payout: 11, units: 2 }, { numbers: [4, 7], payout: 17 }, { numbers: [12, 15], payout: 17 },
    { numbers: [18, 21], payout: 17 }, { numbers: [19, 22], payout: 17 }, { numbers: [25, 26, 28, 29], payout: 8, units: 2 }, { numbers: [32, 35], payout: 17 },
  ]),
  callBet('tiers', 'Tiers du Cylindre', 'TIERS', [[5, 8], [10, 11], [13, 16], [23, 24], [27, 30], [33, 36]].map((numbers) => ({ numbers, payout: 17 }))),
  callBet('orphelins', 'Orphelins', 'ORPHELINS', [
    { numbers: [1], payout: 35 }, { numbers: [6, 9], payout: 17 }, { numbers: [14, 17], payout: 17 }, { numbers: [17, 20], payout: 17 }, { numbers: [31, 34], payout: 17 },
  ]),
  callBet('jeu-zero', 'Jeu Zéro', 'JEU ZÉRO', [
    { numbers: [0, 3], payout: 17 }, { numbers: [12, 15], payout: 17 }, { numbers: [26, 29], payout: 17 }, { numbers: [32], payout: 35 },
  ]),
]

export function neighbourBet(number: number): BetDefinition {
  const index = EUROPEAN_WHEEL.indexOf(number as typeof EUROPEAN_WHEEL[number])
  const numbers = [-2, -1, 0, 1, 2].map((offset) => EUROPEAN_WHEEL[(index + offset + EUROPEAN_WHEEL.length) % EUROPEAN_WHEEL.length])
  return callBet(`neighbours-${number}`, `${number} ve 2 komşusu`, `${number}±2`, numbers.map((n) => ({ numbers: [n], payout: 35 })))
}

export function betUnits(definition: BetDefinition): number {
  return definition.components?.reduce((sum, component) => sum + (component.units ?? 1), 0) ?? 1
}

export function betStake(bet: PlacedBet): number {
  return bet.chips.reduce((sum, chip) => sum + chip * betUnits(bet.definition), 0)
}

export function totalStake(bets: PlacedBet[]): number {
  return bets.reduce((sum, bet) => sum + betStake(bet), 0)
}

export function settleBets(bets: PlacedBet[], winner: number, luckyNumbers: LuckyNumber[] = []) {
  let grossReturn = 0
  let winningStake = 0
  let multiplierReturn = 0
  const winners: Array<{ bet: PlacedBet; returnAmount: number }> = []
  const hitMultiplier = luckyNumbers.find((lucky) => lucky.number === winner)
  bets.forEach((bet) => {
    const chipUnit = bet.chips.reduce((sum, chip) => sum + chip, 0)
    let returnAmount = 0
    if (bet.definition.kind === 'straight' && hitMultiplier && bet.definition.numbers[0] === winner) {
      returnAmount = chipUnit * hitMultiplier.multiplier
      multiplierReturn += returnAmount
    } else if (bet.definition.components) {
      bet.definition.components.forEach((component) => {
        if (component.numbers.includes(winner)) returnAmount += chipUnit * (component.units ?? 1) * (component.payout + 1)
      })
    } else if (bet.definition.numbers.includes(winner)) {
      returnAmount = chipUnit * ((bet.definition.payout ?? 0) + 1)
    }
    if (returnAmount > 0) {
      grossReturn += returnAmount
      winningStake += betStake(bet)
      winners.push({ bet, returnAmount })
    }
  })
  return { grossReturn, winningStake, winners, net: grossReturn - totalStake(bets), multiplierReturn, hitMultiplier }
}

export function compactChipStack(chips: number[]) {
  return chips.slice(-4)
}
