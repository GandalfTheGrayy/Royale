import { describe, expect, it } from 'vitest'
import {
  emptySekerhaneSpots,
  findSekerhaneClusters,
  freeSpinsForSekerhane,
  runSekerhaneSpin,
  spotMultiplierForHits,
  superSekerhaneSpots,
  type SekerhaneSymbolId,
} from './sekerhane-engine'

describe('Şekerhane 1024 motoru', () => {
  it('yalnız yatay/dikey bağlı beşli kümeleri bulur', () => {
    const grid = Array.from({ length: 7 }, () => Array(7).fill('scatter') as SekerhaneSymbolId[])
    ;[[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]].forEach(([row, column]) => { grid[row][column] = 'ayva' })
    grid[4][4] = 'nar'; grid[5][5] = 'nar'; grid[6][6] = 'nar'
    const clusters = findSekerhaneClusters(grid)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].symbol).toBe('ayva')
    expect(clusters[0].cells).toHaveLength(5)
  })

  it('hücreyi ilk patlamada işaretler, ikinci patlamada 2x açar ve 1024xte sınırlar', () => {
    expect(spotMultiplierForHits(0)).toBe(0)
    expect(spotMultiplierForHits(1)).toBe(0)
    expect(spotMultiplierForHits(2)).toBe(2)
    expect(spotMultiplierForHits(3)).toBe(4)
    expect(spotMultiplierForHits(12)).toBe(1024)
  })

  it('normal ve süper bonus hücre haritalarını doğru kurar', () => {
    expect(emptySekerhaneSpots().flat().every((spot) => spot.hits === 0 && spot.multiplier === 0)).toBe(true)
    expect(superSekerhaneSpots().flat().every((spot) => spot.hits === 2 && spot.multiplier === 2)).toBe(true)
  })

  it('kümedeki paket çarpanlarını animasyona uygun ayrı terimler olarak saklar', () => {
    const result = runSekerhaneSpin(1, () => 100, {
      spots: superSekerhaneSpots(),
      profile: { maxCascades: 1, maxWinX: 1_000_000 },
    })
    const cluster = result.cascades[0].clusters[0]
    expect(cluster.spotMultipliers).toHaveLength(49)
    expect(cluster.spotMultipliers.every((value) => value === 4)).toBe(true)
    expect(cluster.spotMultipliers.reduce((sum, value) => sum + value, 0)).toBe(cluster.spotMultiplier)
    expect(cluster.spotMultiplierSources).toHaveLength(49)
    expect(cluster.spotMultiplierSources[0]).toEqual({ row: 0, column: 0, multiplier: 4 })
    expect(cluster.spotMultiplierSources.at(-1)).toEqual({ row: 6, column: 6, multiplier: 4 })
    expect(cluster.spotMultiplier).toBe(196)
  })

  it('scatter sayısını resmi 10/12/15/20/30 skalasına çevirir', () => {
    expect(freeSpinsForSekerhane(2)).toBe(0)
    expect(freeSpinsForSekerhane(3)).toBe(10)
    expect(freeSpinsForSekerhane(4)).toBe(12)
    expect(freeSpinsForSekerhane(5)).toBe(15)
    expect(freeSpinsForSekerhane(6)).toBe(20)
    expect(freeSpinsForSekerhane(7)).toBe(30)
  })

  it('sabit tohumla güvenli sınırlar içinde bir spin üretir', () => {
    let state = 0x51e71a9
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state % max
    }
    const result = runSekerhaneSpin(100, random)
    expect(result.initialGrid).toHaveLength(7)
    expect(result.initialGrid.every((row) => row.length === 7)).toBe(true)
    expect(result.grossReturn).toBeGreaterThanOrEqual(0)
    expect(result.grossReturn).toBeLessThanOrEqual(2_500_000)
    expect(result.cascades.length).toBeLessThanOrEqual(20)
  })

  it('50 bin ücretli spinlik profil ölçümünü raporlar', () => {
    let state = 0x6a09e667
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state % max
    }
    const wager = 25
    const paidSpins = 50_000
    let gross = 0
    let hits = 0
    let bonuses = 0
    let totalCascades = 0
    let chainedSpins = 0
    let longestChain = 0
    for (let spin = 0; spin < paidSpins; spin += 1) {
      const result = runSekerhaneSpin(wager, random)
      gross += result.grossReturn
      if (result.grossReturn > 0) hits += 1
      if (result.freeSpinsAwarded) bonuses += 1
      totalCascades += result.cascades.length
      if (result.cascades.length >= 2) chainedSpins += 1
      longestChain = Math.max(longestChain, result.cascades.length)
    }
    const baseRtp = gross / (paidSpins * wager)
    const averageCascades = totalCascades / paidSpins
    const chainedSpinRate = chainedSpins / paidSpins
    console.info(`Şekerhane 1024 · temel RTP %${(baseRtp * 100).toFixed(2)} · hit %${(hits / paidSpins * 100).toFixed(2)} · zincir %${(chainedSpinRate * 100).toFixed(2)} · ort. patlama ${averageCascades.toFixed(3)} · en uzun ${longestChain} · bonus ${bonuses}`)
    expect(baseRtp).toBeGreaterThan(.55)
    expect(baseRtp).toBeLessThan(1.1)
    expect(averageCascades).toBeGreaterThan(.42)
    expect(chainedSpinRate).toBeGreaterThan(.04)
  }, 15_000)

  it('bonuslar dahil birleşik matematik profilini raporlar', () => {
    let state = 0xbb67ae85
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state % max
    }
    const wager = 25
    const paidSpins = 20_000
    let gross = 0
    let bonusSpins = 0
    for (let spin = 0; spin < paidSpins; spin += 1) {
      const base = runSekerhaneSpin(wager, random)
      gross += base.grossReturn
      let remaining = base.freeSpinsAwarded
      let spots = emptySekerhaneSpots()
      while (remaining > 0 && bonusSpins < paidSpins * 40) {
        const bonus = runSekerhaneSpin(wager, random, { bonusMode: true, spots })
        gross += bonus.grossReturn
        spots = bonus.finalSpots
        remaining = remaining - 1 + bonus.freeSpinsAwarded
        bonusSpins += 1
      }
    }
    const rtp = gross / (paidSpins * wager)
    console.info(`Şekerhane 1024 · birleşik RTP %${(rtp * 100).toFixed(2)} · FS ${bonusSpins}`)
    expect(rtp).toBeGreaterThan(.92)
    expect(rtp).toBeLessThan(.99)
  }, 20_000)

  it('100× ve 500× bonus satın alımlarının örnek geri dönüşünü raporlar', () => {
    const wager = 25
    const sessions = 1_000
    const simulateBuy = (superBonus: boolean) => {
      // Paketleri bağımsız örnekle; normal paketin kaç RNG çağrısı yaptığı
      // süper paketin ölçümünü değiştirmesin.
      let state = superBonus ? 0xa54ff53a : 0x3c6ef372
      const random = (max: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state % max
      }
      let gross = 0
      for (let sessionIndex = 0; sessionIndex < sessions; sessionIndex += 1) {
        let spots = superBonus ? superSekerhaneSpots() : emptySekerhaneSpots()
        let remaining = 10
        let safety = 0
        while (remaining > 0 && safety < 200) {
          const result = runSekerhaneSpin(wager, random, { bonusMode: true, superBonus, purchaseMode: superBonus ? 'super' : 'normal', spots })
          gross += result.grossReturn
          spots = result.finalSpots
          remaining = remaining - 1 + result.freeSpinsAwarded
          safety += 1
        }
      }
      return gross / (sessions * wager * (superBonus ? 500 : 100))
    }
    const normalRtp = simulateBuy(false)
    const superRtp = simulateBuy(true)
    console.info(`Şekerhane 1024 · 100× satın alım RTP %${(normalRtp * 100).toFixed(2)} · 500× süper RTP %${(superRtp * 100).toFixed(2)}`)
    expect(normalRtp).toBeGreaterThan(.9)
    expect(normalRtp).toBeLessThan(1.02)
    expect(superRtp).toBeGreaterThan(.9)
    expect(superRtp).toBeLessThan(1.02)
  }, 20_000)
})
