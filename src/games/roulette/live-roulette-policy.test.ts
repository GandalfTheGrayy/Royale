import { describe, expect, it } from 'vitest'
import { acceptsClosedRouletteTicket, type LiveRoulettePhase } from './live-roulette-policy'

describe('live roulette ticket window', () => {
  it.each<[LiveRoulettePhase, boolean]>([
    ['betting', false],
    ['surge', true],
    ['spinning', true],
    ['result', false],
  ])('%s phase acceptance is %s', (phase, accepted) => {
    expect(acceptsClosedRouletteTicket(phase)).toBe(accepted)
  })
})
