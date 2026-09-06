import type { Card, Rank } from './blackjack'

export type SideBetKey = 'perfectPairs' | 'twentyOneThree'

export type SideBetResult = {
  key: SideBetKey
  label: string
  hand: string
  odds: number
  wager: number
  payout: number
  won: boolean
}

const rankValue: Record<Rank, number> = {
  A: 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
}

const cardColor = (card: Card) => card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'

export function perfectPairsResult(cards: Card[]): { hand: string; odds: number } | null {
  if (cards.length < 2 || cards[0].rank !== cards[1].rank) return null
  if (cards[0].suit === cards[1].suit) return { hand: 'Kusursuz çift', odds: 25 }
  if (cardColor(cards[0]) === cardColor(cards[1])) return { hand: 'Renkli çift', odds: 12 }
  return { hand: 'Karışık çift', odds: 6 }
}

export function twentyOneThreeResult(player: Card[], dealerUp?: Card): { hand: string; odds: number } | null {
  if (player.length < 2 || !dealerUp) return null
  const cards = [player[0], player[1], dealerUp]
  const sameSuit = cards.every((card) => card.suit === cards[0].suit)
  const sameRank = cards.every((card) => card.rank === cards[0].rank)
  const values = [...new Set(cards.map((card) => rankValue[card.rank]))].sort((a, b) => a - b)
  const straight = values.length === 3 && (
    values[2] - values[0] === 2
    || values.join(',') === '2,3,14'
    || values.join(',') === '12,13,14'
  )
  if (sameRank && sameSuit) return { hand: 'Aynı tür üçlü', odds: 100 }
  if (straight && sameSuit) return { hand: 'Floş kent', odds: 40 }
  if (sameRank) return { hand: 'Üçlü', odds: 30 }
  if (straight) return { hand: 'Kent', odds: 10 }
  if (sameSuit) return { hand: 'Floş', odds: 5 }
  return null
}

export function resolveSideBets(
  player: Card[],
  dealerUp: Card | undefined,
  wagers: Record<SideBetKey, number>,
): SideBetResult[] {
  const evaluations = {
    perfectPairs: perfectPairsResult(player),
    twentyOneThree: twentyOneThreeResult(player, dealerUp),
  }
  const labels: Record<SideBetKey, string> = { perfectPairs: 'Perfect Pairs', twentyOneThree: '21+3' }
  return (Object.keys(wagers) as SideBetKey[]).filter((key) => wagers[key] > 0).map((key) => {
    const evaluation = evaluations[key]
    return {
      key,
      label: labels[key],
      hand: evaluation?.hand ?? 'Eşleşme yok',
      odds: evaluation?.odds ?? 0,
      wager: wagers[key],
      payout: evaluation ? wagers[key] * (evaluation.odds + 1) : 0,
      won: Boolean(evaluation),
    }
  })
}
