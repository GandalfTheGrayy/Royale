import { describe, expect, it } from 'vitest'
import { cashOutHilo, createHiloRound, guessHilo, hiloOdds, verifyHiloRound, type HiloRound } from './hilo-engine'

const options = {
  stake: 100,
  rtp: 97,
  clientSeed: 'test-client',
  nonce: 7,
  serverSeed: 'test-server',
  now: '2026-09-05T00:00:00.000Z',
}

describe('hilo engine', () => {
  it('creates deterministic and verifiable rounds', async () => {
    const first = await createHiloRound(options)
    const second = await createHiloRound(options)
    expect(first.deck).toEqual(second.deck)
    expect(first.currentCard).toEqual(first.deck[0])
    expect(await verifyHiloRound(first)).toBe(true)
  })

  it('calculates exact odds from the remaining shoe', async () => {
    const round = await createHiloRound(options)
    const odds = hiloOdds(round)
    expect(odds.higherCards + odds.lowerCards + odds.equalCards).toBe(51)
    expect(odds.higherChance).toBeCloseTo(odds.higherCards / 51)
  })

  it('grows the multiplier on a correct prediction and cashes out', async () => {
    const created = await createHiloRound(options)
    const next = created.deck[1]
    const guess = next.rank > created.currentCard.rank ? 'higher' : next.rank < created.currentCard.rank ? 'lower' : null
    if (!guess) return
    const played = guessHilo(created, guess)
    expect(played.correctGuesses).toBe(1)
    expect(played.multiplier).toBeGreaterThan(1)
    const settled = cashOutHilo(played)
    expect(settled.status).toBe('cashed-out')
    expect(settled.grossPayout).toBeCloseTo(100 * played.multiplier, 2)
  })

  it('treats equal ranks as a loss', () => {
    const card = { rank: 8, suit: 'clubs' as const }
    const tied = { status: 'active', currentCard: card, deck: [card, { rank: 8, suit: 'hearts' as const }], position: 1 } as HiloRound
    const result = guessHilo(tied, 'higher')
    expect(result.status).toBe('lost')
    expect(result.lastResult).toBe('tie')
  })
})
