import { describe, expect, it } from 'vitest'
import { bucketProbability, createFairPlinkoRound, expectedPlinkoRtp, plinkoMultipliers, verifyPlinkoRound } from './plinko-engine'

describe('Pehlevan Plinko motoru', () => {
  it('binom göz olasılıklarının toplamını bire eşitler', () => {
    for (const rows of [8, 12, 16]) {
      const total = Array.from({ length: rows + 1 }, (_, bucket) => bucketProbability(rows, bucket)).reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('tüm sıra ve risklerde hedef RTP çevresinde kalır', () => {
    for (const rows of [8, 10, 12, 14, 16]) for (const risk of ['dusuk', 'orta', 'yuksek'] as const) {
      expect(expectedPlinkoRtp(plinkoMultipliers(rows, risk, 97, 1_000))).toBeCloseTo(.97, 3)
    }
  })

  it('aynı seed ile aynı yolu üretir ve doğrulanır', async () => {
    const options = { stake: 10_000, rtp: 97, risk: 'yuksek' as const, rows: 16, maxPayoutX: 1_000, clientSeed: 'muharrem', nonce: 42, serverSeed: '11'.repeat(32), now: '2026-08-28T12:00:00.000Z' }
    const first = await createFairPlinkoRound(options)
    const second = await createFairPlinkoRound(options)
    expect(first.directions).toEqual(second.directions)
    expect(first.bucket).toBe(second.bucket)
    expect(await verifyPlinkoRound(first)).toBe(true)
  })
})
