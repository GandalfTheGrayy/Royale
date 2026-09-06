import { bytesToHex, hmacBytes, secureSeed, sha256, shuffledRange } from '../originals/fair-rng'

export type HiloSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type HiloGuess = 'higher' | 'lower'

export type HiloCard = {
  rank: number
  suit: HiloSuit
}

export type HiloRound = {
  algorithm: 'pehlevan-hilo-hmac-sha256-v1'
  roundId: string
  startedAt: string
  settledAt?: string
  stake: number
  rtp: number
  clientSeed: string
  serverSeed: string
  nonce: number
  commitment: string
  digest: string
  deck: HiloCard[]
  position: number
  currentCard: HiloCard
  previousCard?: HiloCard
  lastGuess?: HiloGuess
  lastResult?: 'correct' | 'wrong' | 'tie'
  correctGuesses: number
  multiplier: number
  status: 'active' | 'lost' | 'cashed-out'
  grossPayout: number
}

export type HiloOdds = {
  higherCards: number
  lowerCards: number
  equalCards: number
  remainingCards: number
  higherChance: number
  lowerChance: number
  higherFactor: number
  lowerFactor: number
}

export type CreateHiloOptions = {
  stake: number
  rtp: number
  clientSeed: string
  nonce: number
  serverSeed?: string
  now?: string
}

const suits: HiloSuit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export function createHiloDeck(): HiloCard[] {
  return suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ rank: index + 2, suit })))
}

export function roundHiloMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function roundHiloMultiplier(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

export function hiloCardLabel(card: HiloCard) {
  if (card.rank === 14) return 'A'
  if (card.rank === 13) return 'K'
  if (card.rank === 12) return 'Q'
  if (card.rank === 11) return 'J'
  return String(card.rank)
}

export function hiloOdds(round: Pick<HiloRound, 'deck' | 'position' | 'currentCard' | 'rtp'>): HiloOdds {
  const remaining = round.deck.slice(round.position)
  const higherCards = remaining.filter((card) => card.rank > round.currentCard.rank).length
  const lowerCards = remaining.filter((card) => card.rank < round.currentCard.rank).length
  const equalCards = remaining.length - higherCards - lowerCards
  const rtp = Math.max(1, Math.min(100, round.rtp)) / 100
  const higherChance = remaining.length ? higherCards / remaining.length : 0
  const lowerChance = remaining.length ? lowerCards / remaining.length : 0
  return {
    higherCards,
    lowerCards,
    equalCards,
    remainingCards: remaining.length,
    higherChance,
    lowerChance,
    higherFactor: higherChance ? roundHiloMultiplier(rtp / higherChance) : 0,
    lowerFactor: lowerChance ? roundHiloMultiplier(rtp / lowerChance) : 0,
  }
}

export async function createHiloRound(options: CreateHiloOptions): Promise<HiloRound> {
  const serverSeed = options.serverSeed ?? secureSeed()
  const startedAt = options.now ?? new Date().toISOString()
  const message = `${options.clientSeed}:${options.nonce}:hilo`
  const order = await shuffledRange(52, serverSeed, message)
  const sourceDeck = createHiloDeck()
  const deck = order.map((index) => sourceDeck[index])
  const digest = bytesToHex(await hmacBytes(serverSeed, message))
  return {
    algorithm: 'pehlevan-hilo-hmac-sha256-v1',
    roundId: `hilo-${options.nonce}-${Date.parse(startedAt) || Date.now()}`,
    startedAt,
    stake: roundHiloMoney(Math.max(0, options.stake)),
    rtp: Math.max(1, Math.min(100, options.rtp)),
    clientSeed: options.clientSeed,
    serverSeed,
    nonce: options.nonce,
    commitment: await sha256(serverSeed),
    digest,
    deck,
    position: 1,
    currentCard: deck[0],
    correctGuesses: 0,
    multiplier: 1,
    status: 'active',
    grossPayout: 0,
  }
}

export function guessHilo(round: HiloRound, guess: HiloGuess, now = new Date().toISOString()): HiloRound {
  if (round.status !== 'active') return round
  const nextCard = round.deck[round.position]
  if (!nextCard) return cashOutHilo(round, now)
  const odds = hiloOdds(round)
  const comparison = nextCard.rank - round.currentCard.rank
  const correct = guess === 'higher' ? comparison > 0 : comparison < 0
  const lastResult = comparison === 0 ? 'tie' : correct ? 'correct' : 'wrong'
  if (!correct) {
    return {
      ...round,
      previousCard: round.currentCard,
      currentCard: nextCard,
      position: round.position + 1,
      lastGuess: guess,
      lastResult,
      status: 'lost',
      grossPayout: 0,
      settledAt: now,
    }
  }
  const factor = guess === 'higher' ? odds.higherFactor : odds.lowerFactor
  const multiplier = Math.min(1_000_000, roundHiloMultiplier(round.multiplier * factor))
  return {
    ...round,
    previousCard: round.currentCard,
    currentCard: nextCard,
    position: round.position + 1,
    lastGuess: guess,
    lastResult,
    correctGuesses: round.correctGuesses + 1,
    multiplier,
  }
}

export function cashOutHilo(round: HiloRound, now = new Date().toISOString()): HiloRound {
  if (round.status !== 'active') return round
  return {
    ...round,
    status: 'cashed-out',
    settledAt: now,
    grossPayout: roundHiloMoney(round.stake * round.multiplier),
  }
}

export async function verifyHiloRound(round: HiloRound) {
  if (await sha256(round.serverSeed) !== round.commitment) return false
  const regenerated = await createHiloRound({
    stake: round.stake,
    rtp: round.rtp,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    serverSeed: round.serverSeed,
    now: round.startedAt,
  })
  return regenerated.digest === round.digest && JSON.stringify(regenerated.deck) === JSON.stringify(round.deck)
}
