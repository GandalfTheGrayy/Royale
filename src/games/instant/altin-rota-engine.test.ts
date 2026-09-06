import { describe, expect, it } from 'vitest'
import {
  crashPointFromDigest,
  canCashOut,
  adjustBetAmount,
  adaptiveBetStep,
  buildCrashChart,
  createFairCrashRound,
  flightDurationFor,
  multiplierAt,
  verifyFairCrashRound,
} from './altin-rota-engine'

const settings = { targetRtp: 97, maxMultiplier: 10_000, curveMs: 6_400 }

describe('Altın Rota adil crash motoru', () => {
  it('aynı seed ve nonce için aynı sonucu üretir ve doğrular', async () => {
    const a = await createFairCrashRound(settings, 'muharrem-test', 42, 'sunucu-test-seedi')
    const b = await createFairCrashRound(settings, 'muharrem-test', 42, 'sunucu-test-seedi')
    expect(a.crashPoint).toBe(b.crashPoint)
    expect(a.commitment).toBe(b.commitment)
    expect(await verifyFairCrashRound(a, settings)).toBe(true)
  })

  it('çarpanı 1x ile yönetici limitleri arasında tutar', () => {
    expect(crashPointFromDigest('0'.repeat(64), settings)).toBe(1)
    expect(crashPointFromDigest('f'.repeat(64), settings)).toBe(10_000)
  })

  it('uçuş eğrisini tersine çevirebilir', () => {
    for (const target of [1, 1.5, 2, 10, 100]) {
      expect(multiplierAt(flightDurationFor(target, settings.curveMs), settings.curveMs)).toBeCloseTo(target, 8)
    }
  })

  it('çöküş karesinde nakit çıkışa izin vermez', () => {
    expect(canCashOut(1.99, 2)).toBe(true)
    expect(canCashOut(2, 2)).toBe(false)
    expect(canCashOut(2.01, 2)).toBe(false)
  })

  it('uçak ile çizgiyi aynı gerçek çarpan noktasında bitirir', () => {
    const chart = buildCrashChart(7.25, settings.curveMs)
    const last = chart.points.at(-1)!
    expect(last).toEqual(chart.endpoint)
    expect(last.multiplier).toBe(7.25)
    expect(chart.polyline.endsWith(`${last.x.toFixed(2)},${last.y.toFixed(2)}`)).toBe(true)
    for (let index = 1; index < chart.points.length; index += 1) {
      expect(chart.points[index].x).toBeGreaterThanOrEqual(chart.points[index - 1].x)
      expect(chart.points[index].y).toBeLessThanOrEqual(chart.points[index - 1].y)
    }
  })

  it('uçak takip bölgesine ulaştığında grid ölçeğini kesintisiz küçültür', () => {
    const early = buildCrashChart(1.5, settings.curveMs)
    const later = buildCrashChart(8, settings.curveMs)
    const high = buildCrashChart(500, settings.curveMs)
    expect(early.gridZoomX).toBe(1)
    expect(early.gridZoomY).toBe(1)
    expect(later.gridZoomX).toBeGreaterThanOrEqual(early.gridZoomX)
    expect(later.gridZoomY).toBeGreaterThan(early.gridZoomY)
    expect(high.gridZoomX).toBeGreaterThanOrEqual(later.gridZoomX)
    expect(high.gridZoomY).toBeGreaterThan(later.gridZoomY)
    expect(high.gridZoomY).toBeGreaterThan(100)
    expect(later.endpoint.x).toBeLessThanOrEqual(later.width)
    expect(later.endpoint.y).toBeGreaterThanOrEqual(0)
  })

  it('bahsi tutara göre onluk, yüzlük ve binlik basamaklarla değiştirir', () => {
    expect(adaptiveBetStep(50)).toBe(10)
    expect(adaptiveBetStep(500)).toBe(100)
    expect(adaptiveBetStep(5_000)).toBe(1_000)
    expect(adjustBetAmount(90, 1, 25, 10_000)).toBe(100)
    expect(adjustBetAmount(100, -1, 25, 10_000)).toBe(90)
    expect(adjustBetAmount(900, 1, 25, 10_000)).toBe(1_000)
  })

  it('sabit çıkış hedeflerinde yaklaşık yüzde 97 uzun dönem dönüş üretir', () => {
    const samples = 100_000
    for (const target of [1.5, 2, 5, 10]) {
      let returned = 0
      for (let index = 0; index < samples; index += 1) {
        const value = Math.floor(((index + .5) / samples) * 4_503_599_627_370_496)
        const digest = value.toString(16).padStart(13, '0').padEnd(64, '0')
        if (crashPointFromDigest(digest, settings) >= target) returned += target
      }
      expect(returned / samples).toBeGreaterThan(.958)
      expect(returned / samples).toBeLessThan(.975)
    }
  })
})
