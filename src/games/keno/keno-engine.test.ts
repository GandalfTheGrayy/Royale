import { describe, expect, it } from 'vitest'
import { createKenoRound, kenoPaytable, theoreticalKenoRtp, verifyKenoRound } from './keno-engine'

describe('Owl Star Map Keno motoru', () => {
  it('40 sayıdan 10 benzersiz sayı çeker ve aynı turu doğrular', async () => {
    const round = await createKenoRound({ stake: 100, selected: [3, 8, 17, 25, 36], risk: 'medium', rtp: 97, clientSeed: 'muharrem', nonce: 3, serverSeed: 'stars', now: '2026-09-01T12:00:00.000Z' })
    expect(round.drawn).toHaveLength(10)
    expect(new Set(round.drawn).size).toBe(10)
    expect(round.drawn.every((value) => value >= 1 && value <= 40)).toBe(true)
    expect(await verifyKenoRound(round)).toBe(true)
  })

  it('risk tablolarını gerçek hipergeometrik olasılıktan üretir', () => {
    for (let selectedCount = 1; selectedCount <= 10; selectedCount += 1)
      for (const risk of ['low', 'medium', 'high'] as const)
        expect(theoreticalKenoRtp(selectedCount, risk, 97)).toBeCloseTo(.97, 4)
    expect(kenoPaytable(8, 'high', 97)[8]).toBeGreaterThan(kenoPaytable(8, 'low', 97)[8])
  })

  it('ödeme seçilen sayı adedi, hit ve risk profilinden gelir', async () => {
    const round = await createKenoRound({ stake: 25, selected: [1, 2, 3], risk: 'low', rtp: 97, clientSeed: 'x', nonce: 9, serverSeed: 'y' })
    expect(round.multiplier).toBe(kenoPaytable(3, 'low', 97)[round.hits.length])
    expect(round.grossPayout).toBe(Math.round(round.stake * round.multiplier * 100) / 100)
  })

  it('3 seçim yüksek riskte yalnız 3/3 hit için tek ödeme üretir', () => {
    const table = kenoPaytable(3, 'high', 97)
    expect(Object.entries(table).filter(([, multiplier]) => multiplier > 0)).toEqual([['3', table[3]]])
  })
})
