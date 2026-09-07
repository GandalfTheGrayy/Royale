export type MineActorSource = {
  column: number
  sourceColumn?: number
  sourceRow?: number
  tool?: string
  special?: string
}

export type MineActorLane = {
  key: string
  laneIndex: number
  laneCount: number
  offsetPx: number
  staggerMs: number
}

export const mineActorKey = (source: MineActorSource) => [
  source.sourceColumn ?? source.column,
  source.sourceRow ?? -1,
  source.special ?? source.tool ?? 'unknown',
].join(':')

/**
 * Reserves visual lanes by source symbol rather than by impact event. A durable
 * pickaxe therefore keeps its position throughout every wave of a round.
 */
export const planMineActorLanes = (sources: MineActorSource[]): Map<string, MineActorLane> => {
  const byColumn = new Map<number, MineActorSource[]>()
  for (const source of sources) {
    const column = source.sourceColumn ?? source.column
    const group = byColumn.get(column) ?? []
    if (!group.some((candidate) => mineActorKey(candidate) === mineActorKey(source))) group.push(source)
    byColumn.set(column, group)
  }

  const lanes = new Map<string, MineActorLane>()
  for (const group of byColumn.values()) {
    group.sort((left, right) => (left.sourceRow ?? -1) - (right.sourceRow ?? -1) || mineActorKey(left).localeCompare(mineActorKey(right)))
    const laneCount = group.length
    const step = laneCount >= 3 ? 16 : 18
    group.forEach((source, laneIndex) => {
      const centered = laneIndex - (laneCount - 1) / 2
      lanes.set(mineActorKey(source), {
        key: mineActorKey(source),
        laneIndex,
        laneCount,
        offsetPx: centered * step,
        staggerMs: laneIndex * 70,
      })
    })
  }
  return lanes
}

/** Turbo keeps the semantic beats visible instead of applying an unreadable global multiplier. */
export const minePresentationDuration = (milliseconds: number, turbo: boolean, configuredScale: number, turboFloor: number) => (
  turbo ? Math.max(turboFloor, Math.round(milliseconds * Math.max(.45, configuredScale))) : milliseconds
)
