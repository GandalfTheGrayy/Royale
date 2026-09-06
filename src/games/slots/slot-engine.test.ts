import { describe, expect, it } from 'vitest'
import { evaluateSlot, gridFromStops, KIRAZ_REELS, SLOT_PAYLINES } from './slot-engine'

describe('Kiraz Kulübü 77 matematik motoru', () => {
  it('her durakta 3×3 görünür pencere üretir', () => {
    const grid = gridFromStops([0, 0, 0])
    expect(grid).toHaveLength(3)
    expect(grid.every((row) => row.length === 3)).toBe(true)
  })

  it('kazanç satırlarının geri dönüşü toplam geri dönüşle eşleşir', () => {
    for (let a = 0; a < KIRAZ_REELS[0].length; a += 1) {
      for (let b = 0; b < KIRAZ_REELS[1].length; b += 1) {
        for (let c = 0; c < KIRAZ_REELS[2].length; c += 1) {
          const result = evaluateSlot([a, b, c], 25)
          expect(result.grossReturn).toBe(result.wins.reduce((sum, win) => sum + win.returnAmount, 0))
          expect(result.wins.every((win) => win.line >= 0 && win.line < SLOT_PAYLINES.length)).toBe(true)
        }
      }
    }
  })

  it('bağımsız makara duraklarının teorik profilini raporlar', () => {
    let spins = 0
    let gross = 0
    let hits = 0
    let profitable = 0
    let maxReturn = 0
    for (let a = 0; a < KIRAZ_REELS[0].length; a += 1) {
      for (let b = 0; b < KIRAZ_REELS[1].length; b += 1) {
        for (let c = 0; c < KIRAZ_REELS[2].length; c += 1) {
          const result = evaluateSlot([a, b, c], 25)
          spins += 1
          gross += result.grossReturn
          if (result.grossReturn > 0) hits += 1
          if (result.net > 0) profitable += 1
          maxReturn = Math.max(maxReturn, result.grossReturn)
        }
      }
    }
    const rtp = gross / (spins * 25)
    const hitRate = hits / spins
    console.info(`Kiraz 77 · RTP %${(rtp * 100).toFixed(2)} · hit %${(hitRate * 100).toFixed(2)} · artılı spin %${(profitable / spins * 100).toFixed(2)} · maksimum ${maxReturn} PR`)
    expect(rtp).toBeGreaterThan(.7)
    expect(rtp).toBeLessThan(1.2)
    expect(hitRate).toBeGreaterThan(.05)
    expect(hitRate).toBeLessThan(.5)
  })
})
