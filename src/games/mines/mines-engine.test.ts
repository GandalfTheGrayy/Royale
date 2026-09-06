import { describe, expect, it } from 'vitest'
import {
  cashOutMinesRound,
  combination,
  createFairMinesRound,
  depthMultiplier,
  freeMultiplier,
  freeSurvivalProbability,
  nextSafeProbability,
  revealMinesTile,
  roundMoney,
  verifyMinesRound,
} from './mines-engine'

const seed = '0123456789abcdef'.repeat(4)

describe('Obsidyen Damarı matematiği', () => {
  it('kombinasyonları doğru hesaplar', () => {
    expect(combination(25, 3)).toBe(2300)
    expect(combination(5, 2)).toBe(10)
    expect(combination(4, 7)).toBe(0)
  })

  it('serbest kazıda bütün cash-out noktalarında aynı teorik RTPyi korur', () => {
    for (let mines = 1; mines <= 24; mines += 1) {
      for (let safe = 1; safe <= 25 - mines; safe += 1) {
        const expected = freeSurvivalProbability(mines, safe) * freeMultiplier(mines, safe, 97)
        expect(expected).toBeCloseTo(.97, 10)
      }
    }
  })

  it('derin hattın bütün seviyelerinde RTPyi bir kez uygular', () => {
    for (const hazards of [1, 2, 3]) {
      const chance = (5 - hazards) / 5
      for (let row = 1; row <= 12; row += 1) {
        expect(Math.pow(chance, row) * depthMultiplier(hazards, row, 97)).toBeCloseTo(.97, 10)
      }
    }
  })

  it('PR tutarını muhasebe ile aynı iki ondalığa yuvarlar', () => {
    expect(roundMoney(110.22 - 100)).toBe(10.22)
    expect(roundMoney(1.005)).toBe(1.01)
  })
})

describe('Obsidyen Damarı doğrulanabilir turu', () => {
  it('aynı girdilerle aynı tahtayı üretir ve doğrular', async () => {
    const options = { mode: 'free' as const, stake: 100, rtp: 97, mineCount: 5, clientSeed: 'muharrem', nonce: 42, serverSeed: seed, now: '2026-08-27T12:00:00.000Z' }
    const first = await createFairMinesRound(options)
    const second = await createFairMinesRound(options)
    expect(first.mineIndices).toEqual(second.mineIndices)
    expect(first.commitment).toBe(second.commitment)
    expect(await verifyMinesRound(first)).toBe(true)
  })

  it('güvenli seçimde değeri büyütür, mayında kapatır', async () => {
    const round = await createFairMinesRound({ mode: 'free', stake: 100, rtp: 97, mineCount: 3, clientSeed: 'test', nonce: 1, serverSeed: seed })
    const safe = Array.from({ length: 25 }, (_, index) => index).find((index) => !round.mineIndices.includes(index))!
    const afterSafe = revealMinesTile(round, safe).round
    expect(afterSafe.phase).toBe('active')
    expect(afterSafe.safeReveals).toBe(1)
    expect(afterSafe.grossPayout).toBeGreaterThan(100)
    expect(nextSafeProbability(afterSafe)).toBeGreaterThan(0)
    const afterMine = revealMinesTile(afterSafe, round.mineIndices[0]).round
    expect(afterMine.phase).toBe('lost')
    expect(afterMine.grossPayout).toBe(0)
  })

  it('cash-out ancak güvenli seçimden sonra çalışır', async () => {
    const round = await createFairMinesRound({ mode: 'depth', depthRisk: 'keskin', stake: 250, rtp: 97, clientSeed: 'test', nonce: 2, serverSeed: seed })
    expect(cashOutMinesRound(round).phase).toBe('active')
    const safe = [0, 1, 2, 3, 4].find((index) => !round.mineIndices.includes(index))!
    const progressed = revealMinesTile(round, safe).round
    expect(cashOutMinesRound(progressed).phase).toBe('cashed')
  })

  it('admin satır ve azami çarpan ayarlarını turun içine kilitler', async () => {
    const round = await createFairMinesRound({ mode: 'depth', depthRisk: 'ucurum', stake: 100, rtp: 97, clientSeed: 'admin', nonce: 3, serverSeed: seed, rows: 16, maxMultiplier: 50 })
    expect(round.rows).toBe(16)
    expect(round.maxMultiplier).toBe(50)
    let progressed = round
    for (let row = 0; row < 6 && progressed.phase === 'active'; row += 1) {
      const safe = Array.from({ length: 5 }, (_, column) => row * 5 + column).find((index) => !progressed.mineIndices.includes(index))!
      progressed = revealMinesTile(progressed, safe).round
    }
    expect(progressed.currentMultiplier).toBeLessThanOrEqual(50)
    expect(await verifyMinesRound(progressed)).toBe(true)
  })
})
