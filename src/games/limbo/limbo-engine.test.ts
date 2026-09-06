import { describe, expect, it } from 'vitest'
import { createLimboRound, limboResultFromUnit, limboWinChance, verifyLimboRound } from './limbo-engine'

describe('Owl Oracle Limbo motoru', () => {
  it('target büyüdükçe kazanma olasılığını düşürür ve RTPyi korur', () => {
    expect(limboWinChance(2, 97)).toBeCloseTo(48.5, 6)
    expect(limboWinChance(5, 97)).toBeCloseTo(19.4, 6)
    expect((limboWinChance(5, 97) / 100) * 5).toBeCloseTo(.97, 6)
  })

  it('aynı adil girdilerle aynı sonucu üretir ve doğrular', async () => {
    const options = { stake: 100, target: 3.5, rtp: 97, clientSeed: 'muharrem', nonce: 8, serverSeed: 'oracle-secret', now: '2026-09-01T12:00:00.000Z' }
    const first = await createLimboRound(options)
    const second = await createLimboRound(options)
    expect(first.result).toBe(second.result)
    expect(first.digest).toBe(second.digest)
    expect(await verifyLimboRound(first)).toBe(true)
  })

  it('ödemeyi çıkan sonuçtan değil seçilen targettan hesaplar', async () => {
    const round = await createLimboRound({ stake: 10, target: 5, rtp: 97, clientSeed: 'x', nonce: 1, serverSeed: 'seed' })
    if (round.won) expect(round.grossPayout).toBe(50)
    else expect(round.grossPayout).toBe(0)
    expect(limboResultFromUnit(.5, 97)).toBe(1.94)
  })
})
