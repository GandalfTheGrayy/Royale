export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  rank: Rank
}

export interface HandValue {
  total: number
  soft: boolean
}

const suits: Suit[] = ['♠', '♥', '♦', '♣']
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export const createDeck = (): Card[] => suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })))

export const createShoe = (deckCount = 6): Card[] => Array.from({ length: deckCount }, () => createDeck()).flat()

const randomIndex = (max: number) => {
  const entropy = new Uint32Array(1)
  crypto.getRandomValues(entropy)
  return entropy[0] % max
}

export const shuffle = (cards: Card[]) => {
  const deck = [...cards]
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export const draw = (deck: Card[]) => ({ card: deck[0], deck: deck.slice(1) })

export const handValue = (hand: Card[]): HandValue => {
  let total = 0
  let aces = 0
  hand.forEach(({ rank }) => {
    if (rank === 'A') {
      total += 11
      aces += 1
    } else if (['J', 'Q', 'K'].includes(rank)) {
      total += 10
    } else {
      total += Number(rank)
    }
  })
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  return { total, soft: aces > 0 }
}

export const isBlackjack = (hand: Card[]) => hand.length === 2 && handValue(hand).total === 21

export const formatCard = ({ rank, suit }: Card) => `${rank}${suit}`
