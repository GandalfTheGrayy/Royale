import { describe, expect, it } from 'vitest'
import { minePresentationDuration, planMineActorLanes } from './baykus-presentation'

describe('Baykuş Madeni sunumu', () => {
  it('aynı sütundaki iki ve üç kazmayı farklı, kararlı şeritlere yerleştirir', () => {
    const lanes = planMineActorLanes([
      { column: 2, sourceRow: 2, tool: 'gold' },
      { column: 2, sourceRow: 0, tool: 'bronze' },
      { column: 2, sourceRow: 1, tool: 'iron' },
    ])
    const values = [...lanes.values()].sort((left, right) => left.laneIndex - right.laneIndex)
    expect(values.map((lane) => lane.offsetPx)).toEqual([-16, 0, 16])
    expect(values.map((lane) => lane.staggerMs)).toEqual([0, 70, 140])
  })

  it('Turbo modda önemli evreleri okunabilir alt sürenin üstünde tutar', () => {
    expect(minePresentationDuration(1_080, true, .24, 380)).toBe(486)
    expect(minePresentationDuration(190, true, .24, 120)).toBe(120)
    expect(minePresentationDuration(560, false, .24, 260)).toBe(560)
  })
})
