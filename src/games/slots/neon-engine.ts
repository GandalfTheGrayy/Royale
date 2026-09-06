import type { SlotPotentialSettings } from "../../data/casino-admin";
import type { SlotFlowDecision } from "./slot-flow-engine";

export type NeonSymbolId =
  | "cube"
  | "gem"
  | "orb"
  | "chip"
  | "key"
  | "drone"
  | "mask"
  | "scatter"
  | "power";

export type NeonCell = [row: number, column: number];

export type NeonCluster = {
  symbol: Exclude<NeonSymbolId, "scatter" | "power">;
  cells: NeonCell[];
  baseMultiplier: number;
  returnAmount: number;
};

export type NeonCascade = {
  grid: NeonSymbolId[][];
  powerGrid: number[][];
  clusters: NeonCluster[];
  winningCells: NeonCell[];
  nextGrid: NeonSymbolId[][];
  nextPowerGrid: number[][];
  sourceRows: Array<Array<number | null>>;
  fallRows: number[][];
  baseReturn: number;
  returnAmount: number;
};

export type NeonSpinResult = {
  initialGrid: NeonSymbolId[][];
  initialPowerGrid: number[][];
  cascades: NeonCascade[];
  finalGrid: NeonSymbolId[][];
  finalPowerGrid: number[][];
  baseReturn: number;
  multiplierCells: NeonCell[];
  multiplierValues: number[];
  powerSum: number;
  appliedMultiplier: number;
  grossReturn: number;
  scatterCount: number;
  freeSpinsAwarded: number;
  finalBonusMultiplier: number;
  maxPowerValue: number;
  potentialCells?: Array<{ row: number; column: number; value: number }>;
  flowDecision?: SlotFlowDecision;
};

export type NeonSpinOptions = {
  bonusMode?: boolean;
  bonusMultiplier?: number;
  scatterBoost?: boolean;
  tuning?: NeonMathTuning;
  flow?: SlotFlowDecision;
  potential?: SlotPotentialSettings;
};

export type NeonMathTuning = {
  maxWinX?: number;
  payoutScale?: number;
  bonusPayoutScale?: number;
  baseScatterRate?: number;
  bonusScatterRate?: number;
  enhancedScatterRate?: number;
  baseSpecialRate?: number;
  bonusSpecialRate?: number;
  cascadeAffinityPercent?: number;
  maxCascades?: number;
  minimumCluster?: number;
  valueWeights?: Record<string, number>;
  bonusSpins?: Record<string, number>;
  retriggerSpins?: number;
};

export const NEON_SIZE = 7;
export const NEON_MAX_WIN = 15_000;
export const NEON_MATH_PROFILE = "neon-v4-frequent-flow-948";

export const NEON_SYMBOLS: Record<
  NeonSymbolId,
  {
    label: string;
    image: string;
    weight: number;
    pays: [number, number, number];
  }
> = {
  cube: {
    label: "Veri Küpü",
    image: "/assets/slots/neon-kasasi/data-cube.png",
    weight: 20,
    pays: [0.166, 0.459, 1.424],
  },
  gem: {
    label: "Kuantum Taşı",
    image: "/assets/slots/neon-kasasi/quantum-gem.png",
    weight: 18,
    pays: [0.201, 0.563, 1.688],
  },
  orb: {
    label: "Plazma Küresi",
    image: "/assets/slots/neon-kasasi/plasma-orb.png",
    weight: 17,
    pays: [0.253, 0.735, 2.25],
  },
  chip: {
    label: "Kuantum Çipi",
    image: "/assets/slots/neon-kasasi/quantum-chip.png",
    weight: 16,
    pays: [0.316, 0.895, 2.818],
  },
  key: {
    label: "Siber Anahtar",
    image: "/assets/slots/neon-kasasi/cyber-key.png",
    weight: 13,
    pays: [0.396, 1.234, 3.938],
  },
  drone: {
    label: "Gözcü Drone",
    image: "/assets/slots/neon-kasasi/sentry-drone.png",
    weight: 10,
    pays: [0.563, 1.791, 5.625],
  },
  mask: {
    label: "Hayalet Maske",
    image: "/assets/slots/neon-kasasi/fox-mask.png",
    weight: 8,
    pays: [0.792, 2.543, 8.444],
  },
  scatter: {
    label: "MIRA Scatter",
    image: "/assets/slots/neon-kasasi/mira-scatter-v1.png",
    weight: 1,
    pays: [0, 0, 0],
  },
  power: { label: "Güç Çarpanı", image: "", weight: 0, pays: [0, 0, 0] },
};

const weightedSymbols = Object.entries(NEON_SYMBOLS).flatMap(
  ([symbol, info]) =>
    symbol === "power" || symbol === "scatter"
      ? []
      : Array.from({ length: info.weight }, () => symbol as NeonSymbolId),
);

// 10.000 ağırlık: yüksek değer büyüdükçe görülme ihtimali sert biçimde düşer.
export const POWER_VALUE_WEIGHTS = [
  { value: 2, weight: 440000, sprite: 0 },
  { value: 3, weight: 285000, sprite: 1 },
  { value: 4, weight: 145000, sprite: 2 },
  { value: 5, weight: 80000, sprite: 2 },
  { value: 10, weight: 33000, sprite: 3 },
  { value: 15, weight: 11000, sprite: 4 },
  { value: 25, weight: 4500, sprite: 5 },
  { value: 50, weight: 1200, sprite: 6 },
  { value: 100, weight: 250, sprite: 6 },
  { value: 500, weight: 15, sprite: 7 },
  { value: 1000, weight: 1, sprite: 8 },
] as const;

export const emptyPowerGrid = () =>
  Array.from({ length: NEON_SIZE }, () => Array(NEON_SIZE).fill(0) as number[]);
export const emptyMultiplierGrid = emptyPowerGrid;

function secureIndex(max: number) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % max;
}

export function randomPowerValue(
  randomIndex: (max: number) => number = secureIndex,
  configuredWeights?: Record<string, number>,
) {
  const tiers = POWER_VALUE_WEIGHTS.map((tier) => ({
    ...tier,
    weight: Math.max(0, configuredWeights?.[String(tier.value)] ?? tier.weight),
  }));
  const total = Math.max(
    1,
    Math.ceil(tiers.reduce((sum, tier) => sum + tier.weight, 0)),
  );
  let cursor = randomIndex(total);
  for (const tier of tiers) {
    if (cursor < tier.weight) return tier.value;
    cursor -= tier.weight;
  }
  return 2;
}

export function powerSpriteIndex(value: number) {
  return POWER_VALUE_WEIGHTS.find((tier) => tier.value === value)?.sprite ?? 0;
}

export function randomNeonSymbol(
  randomIndex: (max: number) => number = secureIndex,
) {
  return weightedSymbols[randomIndex(weightedSymbols.length)];
}

function randomLanding(
  randomIndex: (max: number) => number,
  bonusMode: boolean,
  scatterBoost = false,
  tuning: NeonMathTuning = {},
) {
  // Bonus özel reel seti güçleri daha görünür kılar; temel oyun hâlâ daha
  // kuraktır. Mekanik aynı, yalnız reel ağırlığı değişir.
  const powerChancePerTenThousand = bonusMode
    ? (tuning.bonusSpecialRate ?? 115)
    : (tuning.baseSpecialRate ?? 55);
  if (randomIndex(10_000) < powerChancePerTenThousand)
    return {
      symbol: "power" as const,
      power: randomPowerValue(randomIndex, tuning.valueWeights),
    };
  // MIRA bağımsız bir reel olasılığı kullanır; böylece bonus giriş sıklığı
  // ödeme sembollerinin küme dağılımını bozmak zorunda kalmadan ayarlanabilir.
  // 4 MIRA gerektiği için hücre olasılığını 2× yapmak özellik sıklığını yaklaşık
  // 16× büyütür. 128/108 oranı dördüncü kuvvette yaklaşık 2× tetiklenme verir.
  const scatterChance = bonusMode
    ? (tuning.bonusScatterRate ?? 155)
    : scatterBoost
      ? (tuning.enhancedScatterRate ?? 160)
      : (tuning.baseScatterRate ?? 134);
  if (randomIndex(10_000) < scatterChance)
    return { symbol: "scatter" as const, power: 0 };
  return { symbol: randomNeonSymbol(randomIndex), power: 0 };
}

export function createNeonGrid(
  randomIndex: (max: number) => number = secureIndex,
  bonusMode = false,
  scatterBoost = false,
  tuning: NeonMathTuning = {},
) {
  const powerGrid = emptyPowerGrid();
  const grid = Array.from({ length: NEON_SIZE }, (_, row) =>
    Array.from({ length: NEON_SIZE }, (_, column) => {
      const landing = randomLanding(
        randomIndex,
        bonusMode,
        scatterBoost,
        tuning,
      );
      powerGrid[row][column] = landing.power;
      return landing.symbol;
    }),
  );
  return { grid, powerGrid };
}

function ensureNeonScatters(
  grid: NeonSymbolId[][],
  powerGrid: number[][],
  count: number,
  randomIndex: (max: number) => number,
) {
  let current = grid.flat().filter((symbol) => symbol === "scatter").length;
  const cells = Array.from({ length: NEON_SIZE ** 2 }, (_, index) => ({
    row: Math.floor(index / NEON_SIZE),
    column: index % NEON_SIZE,
  })).filter(({ row, column }) => grid[row][column] !== "scatter");
  while (current < count && cells.length) {
    const index = randomIndex(cells.length);
    const cell = cells.splice(index, 1)[0];
    grid[cell.row][cell.column] = "scatter";
    powerGrid[cell.row][cell.column] = 0;
    current += 1;
  }
}

function decorateNeonPotential(
  grid: NeonSymbolId[][],
  powerGrid: number[][],
  randomIndex: (max: number) => number,
  potential: SlotPotentialSettings,
  flow: SlotFlowDecision,
  baseReturn: number,
) {
  const potentialCells: Array<{ row: number; column: number; value: number }> = [];
  if (!potential.enabled || !flow.showPotential || baseReturn > 0) return potentialCells;
  const minimum = Math.max(0, Math.round(potential.displayOnlyMinItems));
  const maximum = Math.max(minimum, Math.round(potential.displayOnlyMaxItems));
  const count = minimum + randomIndex(Math.max(1, maximum - minimum + 1));
  const values = POWER_VALUE_WEIGHTS.map((tier) => tier.value).filter(
    (value) =>
      value >= potential.displayOnlyHighValueMinX &&
      value <= potential.displayOnlyHighValueMaxX,
  );
  const candidates = Array.from({ length: NEON_SIZE ** 2 }, (_, index) => ({
    row: Math.floor(index / NEON_SIZE),
    column: index % NEON_SIZE,
  })).filter(({ row, column }) => grid[row][column] !== "scatter");
  for (let item = 0; item < count && candidates.length; item += 1) {
    const index = randomIndex(candidates.length);
    const cell = candidates.splice(index, 1)[0];
    const value = values.length ? values[randomIndex(values.length)] : 50;
    grid[cell.row][cell.column] = "power";
    powerGrid[cell.row][cell.column] = value;
    potentialCells.push({ ...cell, value });
  }
  return potentialCells;
}

export function findNeonClusters(grid: NeonSymbolId[][], minimumCluster = 5) {
  const visited = new Set<string>();
  const clusters: Array<{
    symbol: Exclude<NeonSymbolId, "scatter" | "power">;
    cells: NeonCell[];
  }> = [];
  for (let row = 0; row < NEON_SIZE; row += 1) {
    for (let column = 0; column < NEON_SIZE; column += 1) {
      const symbol = grid[row][column];
      const key = `${row}-${column}`;
      if (symbol === "scatter" || symbol === "power" || visited.has(key))
        continue;
      const queue: NeonCell[] = [[row, column]];
      const cells: NeonCell[] = [];
      visited.add(key);
      while (queue.length) {
        const [currentRow, currentColumn] = queue.shift()!;
        cells.push([currentRow, currentColumn]);
        const neighbours: NeonCell[] = [
          [currentRow - 1, currentColumn],
          [currentRow + 1, currentColumn],
          [currentRow, currentColumn - 1],
          [currentRow, currentColumn + 1],
        ];
        neighbours.forEach(([nextRow, nextColumn]) => {
          const nextKey = `${nextRow}-${nextColumn}`;
          if (
            nextRow < 0 ||
            nextRow >= NEON_SIZE ||
            nextColumn < 0 ||
            nextColumn >= NEON_SIZE ||
            visited.has(nextKey)
          )
            return;
          if (grid[nextRow][nextColumn] !== symbol) return;
          visited.add(nextKey);
          queue.push([nextRow, nextColumn]);
        });
      }
      if (cells.length >= Math.max(3, minimumCluster))
        clusters.push({
          symbol: symbol as Exclude<NeonSymbolId, "scatter" | "power">,
          cells,
        });
    }
  }
  return clusters;
}

function clusterPayTier(size: number) {
  if (size >= 12) return 2;
  if (size >= 8) return 1;
  return 0;
}

function cascadeSymbol(
  candidates: NeonSymbolId[],
  randomIndex: (max: number) => number,
  bonusMode: boolean,
  scatterBoost: boolean,
  tuning: NeonMathTuning,
) {
  const usable = candidates.filter(
    (symbol) => symbol !== "scatter" && symbol !== "power",
  );
  if (usable.length && randomIndex(100) < (tuning.cascadeAffinityPercent ?? 25))
    return { symbol: usable[randomIndex(usable.length)], power: 0 };
  return randomLanding(randomIndex, bonusMode, scatterBoost, tuning);
}

function collapseGrid(
  grid: NeonSymbolId[][],
  powerGrid: number[][],
  removed: Set<string>,
  randomIndex: (max: number) => number,
  bonusMode: boolean,
  scatterBoost: boolean,
  tuning: NeonMathTuning,
) {
  const nextGrid = Array.from(
    { length: NEON_SIZE },
    () => Array(NEON_SIZE).fill(undefined) as unknown as NeonSymbolId[],
  );
  const nextPowerGrid = emptyPowerGrid();
  const sourceRows = Array.from(
    { length: NEON_SIZE },
    () => Array(NEON_SIZE).fill(null) as Array<number | null>,
  );
  const fallRows = emptyPowerGrid();
  for (let column = 0; column < NEON_SIZE; column += 1) {
    const survivors: Array<{
      symbol: NeonSymbolId;
      power: number;
      sourceRow: number;
    }> = [];
    for (let row = NEON_SIZE - 1; row >= 0; row -= 1) {
      if (!removed.has(`${row}-${column}`))
        survivors.push({
          symbol: grid[row][column],
          power: powerGrid[row][column],
          sourceRow: row,
        });
    }
    for (
      let row = NEON_SIZE - 1, index = 0;
      index < survivors.length;
      row -= 1, index += 1
    ) {
      const survivor = survivors[index];
      nextGrid[row][column] = survivor.symbol;
      nextPowerGrid[row][column] = survivor.power;
      sourceRows[row][column] = survivor.sourceRow;
      fallRows[row][column] = row - survivor.sourceRow;
    }
    const newCount = NEON_SIZE - survivors.length;
    for (let row = newCount - 1; row >= 0; row -= 1) {
      const candidates: NeonSymbolId[] = [];
      if (row + 1 < NEON_SIZE && nextGrid[row + 1][column])
        candidates.push(nextGrid[row + 1][column]);
      if (column > 0 && nextGrid[row][column - 1])
        candidates.push(nextGrid[row][column - 1]);
      const landing = cascadeSymbol(
        candidates,
        randomIndex,
        bonusMode,
        scatterBoost,
        tuning,
      );
      nextGrid[row][column] = landing.symbol;
      nextPowerGrid[row][column] = landing.power;
      fallRows[row][column] = newCount + 1 + ((row + column) % 2);
    }
  }
  return { nextGrid, nextPowerGrid, sourceRows, fallRows };
}

export function freeSpinsFor(
  scatterCount: number,
  tuning: NeonMathTuning = {},
) {
  if (scatterCount < 4) return 0;
  const configured = tuning.bonusSpins?.[String(Math.min(7, scatterCount))];
  if (configured !== undefined) return Math.max(0, Math.round(configured));
  if (scatterCount === 4) return 15;
  if (scatterCount === 5) return 20;
  if (scatterCount === 6) return 25;
  return 30;
}

export function bonusFreeSpinsFor(
  scatterCount: number,
  tuning: NeonMathTuning = {},
) {
  return scatterCount >= 3
    ? Math.max(0, Math.round(tuning.retriggerSpins ?? 5))
    : 0;
}

export function runNeonSpin(
  wager: number,
  randomIndex: (max: number) => number = secureIndex,
  options: NeonSpinOptions = {},
): NeonSpinResult {
  const tuning: NeonMathTuning = { ...(options.tuning ?? {}) };
  if (options.flow) {
    tuning.cascadeAffinityPercent = Math.min(
      100,
      (tuning.cascadeAffinityPercent ?? 25) * options.flow.eventWeightMultiplier,
    );
    if (options.bonusMode)
      tuning.bonusScatterRate =
        (tuning.bonusScatterRate ?? 155) * options.flow.bonusWeightMultiplier;
    else
      tuning.baseScatterRate =
        (tuning.baseScatterRate ?? 134) * options.flow.bonusWeightMultiplier;
    const specialKey = options.bonusMode ? "bonusSpecialRate" : "baseSpecialRate";
    const specialFallback = options.bonusMode ? 115 : 55;
    tuning[specialKey] =
      (tuning[specialKey] ?? specialFallback) * options.flow.eventWeightMultiplier;
  }
  const initial = createNeonGrid(
    randomIndex,
    Boolean(options.bonusMode),
    Boolean(options.scatterBoost),
    tuning,
  );
  if (options.flow?.strongTease) {
    ensureNeonScatters(
      initial.grid,
      initial.powerGrid,
      options.flow.convertTease
        ? options.bonusMode
          ? 3
          : 4
        : options.bonusMode
          ? 2
          : 3,
      randomIndex,
    );
  }
  let grid = initial.grid.map((row) => [...row]);
  let powerGrid = initial.powerGrid.map((row) => [...row]);
  const bonusMultiplierBefore = options.bonusMode
    ? Math.max(0, options.bonusMultiplier ?? 0)
    : 0;
  const cascades: NeonCascade[] = [];
  let baseReturn = 0;
  let maxPowerValue = Math.max(0, ...powerGrid.flat());
  const maxReturn = wager * Math.max(1, tuning.maxWinX ?? NEON_MAX_WIN);
  const cascadeLimit = Math.max(1, Math.round(tuning.maxCascades ?? 16));
  for (
    let cascadeIndex = 0;
    cascadeIndex < cascadeLimit && baseReturn < maxReturn;
    cascadeIndex += 1
  ) {
    const rawClusters = findNeonClusters(
      grid,
      Math.round(tuning.minimumCluster ?? 4),
    );
    if (!rawClusters.length) break;
    const clusters: NeonCluster[] = rawClusters.map((cluster) => {
      const baseMultiplier =
        NEON_SYMBOLS[cluster.symbol].pays[
          clusterPayTier(cluster.cells.length)
        ] *
        Math.max(
          0,
          options.bonusMode
            ? (tuning.bonusPayoutScale ?? tuning.payoutScale ?? 0.477)
            : (tuning.payoutScale ?? 0.553),
        );
      return {
        ...cluster,
        baseMultiplier,
        returnAmount: wager * baseMultiplier,
      };
    });
    const winningCells = clusters.flatMap((cluster) => cluster.cells);
    const cascadeBaseReturn = Math.min(
      clusters.reduce((sum, cluster) => sum + cluster.returnAmount, 0),
      maxReturn - baseReturn,
    );
    // Güç sembolleri tumble sırasında kaybolmaz. Kazanan semboller patlar,
    // güçler ve scatter'lar yerinde kalır; yenileri açılan boşluklardan inebilir.
    const removed = new Set(
      winningCells.map(([row, column]) => `${row}-${column}`),
    );
    const collapsed = collapseGrid(
      grid,
      powerGrid,
      removed,
      randomIndex,
      Boolean(options.bonusMode),
      Boolean(options.scatterBoost),
      tuning,
    );
    cascades.push({
      grid: grid.map((row) => [...row]),
      powerGrid: powerGrid.map((row) => [...row]),
      clusters,
      winningCells,
      nextGrid: collapsed.nextGrid.map((row) => [...row]),
      nextPowerGrid: collapsed.nextPowerGrid.map((row) => [...row]),
      sourceRows: collapsed.sourceRows.map((row) => [...row]),
      fallRows: collapsed.fallRows.map((row) => [...row]),
      baseReturn: cascadeBaseReturn,
      returnAmount: cascadeBaseReturn,
    });
    baseReturn += cascadeBaseReturn;
    grid = collapsed.nextGrid;
    powerGrid = collapsed.nextPowerGrid;
    maxPowerValue = Math.max(maxPowerValue, ...powerGrid.flat());
  }
  const multiplierCells: NeonCell[] = [];
  powerGrid.forEach((row, rowIndex) =>
    row.forEach((value, columnIndex) => {
      if (value > 0) multiplierCells.push([rowIndex, columnIndex]);
    }),
  );
  // Çarpan yalnız kazanan bir spin sonunda çalışır. Bütün tumble kazançları
  // önce toplanır, son ekrandaki güçler sonra tek bir darbede uygulanır.
  const multiplierValues =
    baseReturn > 0
      ? multiplierCells.map(([row, column]) => powerGrid[row][column])
      : [];
  const powerSum = multiplierValues.reduce((sum, value) => sum + value, 0);
  const finalBonusMultiplier =
    options.bonusMode && powerSum
      ? bonusMultiplierBefore + powerSum
      : bonusMultiplierBefore;
  const appliedMultiplier = powerSum
    ? options.bonusMode
      ? Math.max(1, finalBonusMultiplier)
      : powerSum
    : 1;
  const grossReturn = Math.min(baseReturn * appliedMultiplier, maxReturn);
  // Scatter'lar kazanan kümeye dahil olmaz; cascade sırasında yukarıdan yeni
  // MIRA inerse ekranda kalır ve turun sonundaki 4+ sayımına katılır.
  const scatterCount = grid
    .flat()
    .filter((symbol) => symbol === "scatter").length;
  const potentialCells = options.flow && options.potential
    ? decorateNeonPotential(
        grid,
        powerGrid,
        randomIndex,
        options.potential,
        options.flow,
        baseReturn,
      )
    : [];
  if (cascades.length && potentialCells.length) {
    cascades.at(-1)!.nextGrid = grid.map((row) => [...row]);
    cascades.at(-1)!.nextPowerGrid = powerGrid.map((row) => [...row]);
  }
  if (!cascades.length && potentialCells.length) {
    grid.forEach((row, rowIndex) => { initial.grid[rowIndex] = [...row]; });
    powerGrid.forEach((row, rowIndex) => {
      initial.powerGrid[rowIndex] = [...row];
    });
  }
  maxPowerValue = Math.max(maxPowerValue, 0, ...powerGrid.flat());
  return {
    initialGrid: initial.grid,
    initialPowerGrid: initial.powerGrid,
    cascades,
    finalGrid: grid,
    finalPowerGrid: powerGrid,
    baseReturn,
    multiplierCells,
    multiplierValues,
    powerSum,
    appliedMultiplier,
    grossReturn,
    scatterCount,
    freeSpinsAwarded: options.bonusMode
      ? bonusFreeSpinsFor(scatterCount, tuning)
      : freeSpinsFor(scatterCount, tuning),
    finalBonusMultiplier,
    maxPowerValue,
    potentialCells,
    flowDecision: options.flow,
  };
}
