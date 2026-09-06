export type CascadePhase =
  "idle" | "landing" | "focus" | "bursting" | "cleared" | "falling";

export type CascadeTimings = {
  landing: number;
  focus: number;
  bursting: number;
  cleared: number;
  falling: number;
};

export type CascadeTimingProfile = {
  normal: CascadeTimings;
  turbo: CascadeTimings;
};

export type CascadeIdentity = {
  ids: string[][];
  entering: Set<string>;
};

export type CascadeTimelineHooks<TCascade> = {
  isActive?: () => boolean;
  shouldSkip?: () => boolean;
  onPhase: (
    phase: Exclude<CascadePhase, "idle">,
    cascade?: TCascade,
    index?: number,
  ) => void;
  afterLanding?: () => void | Promise<void>;
  afterFalling?: (cascade: TCascade, index: number) => void | Promise<void>;
  afterComplete?: () => void | Promise<void>;
};

export const DEFAULT_CASCADE_TIMINGS: CascadeTimingProfile = {
  normal: {
    landing: 950,
    focus: 700,
    bursting: 700,
    cleared: 1550,
    falling: 1000,
  },
  // Turbo compresses the rhythm, but keeps every state visually legible.
  turbo: {
    landing: 420,
    focus: 220,
    bursting: 260,
    cleared: 650,
    falling: 430,
  },
};

export function createNumberGrid(rows: number, columns: number, value = 0) {
  return Array.from(
    { length: rows },
    () => Array(columns).fill(value) as number[],
  );
}

export function createInitialFallRows(
  rows: number,
  columns: number,
  extraRows = 1,
) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from(
      { length: columns },
      (_, column) => extraRows + row + (column % 3),
    ),
  );
}

/**
 * Produces an exact CSS grid travel distance. A percentage-only translation
 * ignores the row gap and makes survivors snap a few pixels at every cascade.
 */
export function cascadeGridDistance(
  rows: number,
  gap = "var(--cascade-grid-gap)",
) {
  const travelRows = Math.max(1, Math.round(rows));
  const gaps = Array.from({ length: travelRows }, () => gap).join(" - ");
  return `calc(-${travelRows * 100}% - ${gaps})`;
}

export function createCascadeIdentity(
  rows: number,
  columns: number,
  nextId: () => string,
): CascadeIdentity {
  const ids = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => nextId()),
  );
  return { ids, entering: new Set(ids.flat()) };
}

/**
 * Transfers a surviving symbol's identity from its old row to its new row.
 * Negative and null sources represent symbols entering from above the grid.
 */
export function reconcileCascadeIdentity(
  currentIds: string[][],
  sourceRows: Array<Array<number | null>>,
  nextId: () => string,
): CascadeIdentity {
  const entering = new Set<string>();
  const ids = sourceRows.map((row, rowIndex) =>
    row.map((sourceRow, columnIndex) => {
      if (sourceRow !== null && sourceRow >= 0) {
        const survivor = currentIds[sourceRow]?.[columnIndex];
        if (!survivor) {
          throw new Error(
            `Invalid cascade source at ${rowIndex}:${columnIndex} -> ${sourceRow}`,
          );
        }
        return survivor;
      }
      const id = nextId();
      entering.add(id);
      return id;
    }),
  );
  return { ids, entering };
}

export function cascadeCellDelay(
  row: number,
  column: number,
  entering: boolean,
  turbo: boolean,
) {
  const columnStep = turbo ? 10 : 24;
  const enteringRowStep = turbo ? 12 : 32;
  return column * columnStep + (entering ? row * enteringRowStep : 0);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** A presentation delay that can be fast-forwarded without cancelling the settled result. */
export async function waitForPresentation(
  ms: number,
  shouldSkip: () => boolean = () => false,
) {
  let remaining = Math.max(0, ms);
  while (remaining > 0 && !shouldSkip()) {
    const slice = Math.min(32, remaining);
    await delay(slice);
    remaining -= slice;
  }
}

/** Plays an already-generated cascade result. This function never calls RNG. */
export async function playCascadeTimeline<TCascade>(
  cascades: readonly TCascade[],
  turbo: boolean,
  hooks: CascadeTimelineHooks<TCascade>,
  profile: CascadeTimingProfile = DEFAULT_CASCADE_TIMINGS,
) {
  const timings = turbo ? profile.turbo : profile.normal;
  const active = () => hooks.isActive?.() ?? true;
  const stage = async (
    phase: Exclude<CascadePhase, "idle">,
    duration: number,
    cascade?: TCascade,
    index?: number,
  ) => {
    if (!active()) return false;
    hooks.onPhase(phase, cascade, index);
    await waitForPresentation(duration, hooks.shouldSkip);
    return active();
  };

  if (!(await stage("landing", timings.landing))) return false;
  await hooks.afterLanding?.();
  if (!active()) return false;

  for (let index = 0; index < cascades.length; index += 1) {
    const cascade = cascades[index];
    if (!(await stage("focus", timings.focus, cascade, index))) return false;
    if (!(await stage("bursting", timings.bursting, cascade, index)))
      return false;
    if (!(await stage("cleared", timings.cleared, cascade, index)))
      return false;
    if (!(await stage("falling", timings.falling, cascade, index)))
      return false;
    await hooks.afterFalling?.(cascade, index);
    if (!active()) return false;
  }

  await hooks.afterComplete?.();
  return active();
}
