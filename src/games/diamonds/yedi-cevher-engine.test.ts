import { describe, expect, it } from 'vitest'
import { classifyGems, createYediCevherRound, expectedGemRtp, gemPayoutTable, NATURAL_GEM_RTP, verifyYediCevherRound } from './yedi-cevher-engine'

describe('Yedi Cevher engine', () => {
  it('classifies all seven combinations', () => {
    expect(classifyGems(['ruby', 'emerald', 'cyan', 'rose', 'sapphire'])).toBe('none')
    expect(classifyGems(['ruby', 'ruby', 'cyan', 'rose', 'sapphire'])).toBe('pair')
    expect(classifyGems(['ruby', 'ruby', 'cyan', 'cyan', 'sapphire'])).toBe('two-pair')
    expect(classifyGems(['ruby', 'ruby', 'ruby', 'rose', 'sapphire'])).toBe('three')
    expect(classifyGems(['ruby', 'ruby', 'ruby', 'rose', 'rose'])).toBe('full-house')
    expect(classifyGems(['ruby', 'ruby', 'ruby', 'ruby', 'sapphire'])).toBe('four')
    expect(classifyGems(['ruby', 'ruby', 'ruby', 'ruby', 'ruby'])).toBe('five')
  })

  it('reproduces the 98.292% clean paytable', () => {
    expect(expectedGemRtp()).toBeCloseTo(NATURAL_GEM_RTP, 10)
    expect(gemPayoutTable().find((row) => row.combination === 'five')?.multiplier).toBe(50)
  })

  it('scales the paytable to an administrator RTP target', () => {
    expect(expectedGemRtp(gemPayoutTable(97))).toBeCloseTo(97, 4)
  })

  it('creates deterministic and verifiable rounds', async () => {
    const options = { stake: 100, rtp: NATURAL_GEM_RTP, clientSeed: 'player-seed', nonce: 12, serverSeed: 'house-seed', now: '2026-09-05T12:00:00.000Z' }
    const first = await createYediCevherRound(options)
    const second = await createYediCevherRound(options)
    expect(first.gems).toEqual(second.gems)
    expect(first.gems).toHaveLength(5)
    expect(await verifyYediCevherRound(first)).toBe(true)
  })
})
