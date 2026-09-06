import { describe, expect, it } from 'vitest'
import { cashOutCountdown, chooseCountdownCell, countdownMultiplier, createFairCountdownRound, verifyCountdownRound } from './son-on-engine'

describe('Son On countdown engine', () => {
  it('calculates risk-based cumulative multipliers', () => {
    expect(countdownMultiplier('temkinli', 1, 97)).toBeCloseTo(1.455, 3)
    expect(countdownMultiplier('keskin', 2, 97)).toBeCloseTo(3.88, 2)
    expect(countdownMultiplier('son-saniye', 3, 97)).toBeCloseTo(15.15625, 3)
  })

  it('commits deterministic hazards and can verify them', async () => {
    const round = await createFairCountdownRound({ stake: 100, rtp: 97, risk: 'keskin', clientSeed: 'test', nonce: 1, serverSeed: 'server-test' })
    expect(round.hazardIndices).toHaveLength(10)
    expect(round.hazardIndices.every((stage) => stage.length === 2)).toBe(true)
    expect(await verifyCountdownRound(round)).toBe(true)
  })

  it('settles safe, alarm and cashout paths', async () => {
    const created = await createFairCountdownRound({ stake: 100, rtp: 97, risk: 'temkinli', clientSeed: 'test', nonce: 2, serverSeed: 'server-test-2' })
    const safeCell = [0, 1, 2].find((cell) => !created.hazardIndices[0].includes(cell))!
    const safe = chooseCountdownCell(created, safeCell).round
    expect(safe.safeSteps).toBe(1)
    expect(cashOutCountdown(safe).phase).toBe('cashed')
    const alarm = chooseCountdownCell(created, created.hazardIndices[0][0]).round
    expect(alarm.phase).toBe('lost')
  })
})
