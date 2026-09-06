import type { SlotPotentialSettings } from "../../data/casino-admin";
import type { SlotFlowDecision } from "./slot-flow-engine";

export const FISHER_ROWS = 4;
export const FISHER_REELS = 5;
export const FISHER_MATH_PROFILE = "fisher-v6-fish-forward-945";

export type FisherSymbolId =
  | "anchor"
  | "tackle"
  | "buoy"
  | "shell"
  | "bluefish"
  | "orangefish"
  | "tuna"
  | "money-fish"
  | "captain"
  | "scatter";

export type FisherSymbol = {
  id: FisherSymbolId;
  label: string;
  image: string;
  payouts?: [number, number, number];
};

export type FisherCell = {
  id: FisherSymbolId;
  cashMultiplier?: number;
};

export type FisherBonusModifierId =
  | "more-fish"
  | "more-captains"
  | "more-features"
  | "extra-spins"
  | "start-level-two";

export type FisherBonusModifiers = Record<FisherBonusModifierId, boolean>;

export type FisherBonusPickCard = {
  id: string;
  reward: FisherBonusModifierId | "boot";
};

export type FisherBonusFeature = "dynamite" | "hook" | "bazooka";

export type FisherLineWin = {
  line: number;
  symbol: FisherSymbolId;
  count: number;
  multiplier: number;
  payout: number;
  cells: Array<{ row: number; reel: number }>;
};

export type FisherSpinResult = {
  grid: FisherCell[][];
  lineWins: FisherLineWin[];
  scatterCount: number;
  scatterPayout: number;
  bonusSpins: number;
  hookRescue: boolean;
  fishValues: number[];
  fishCells: Array<{ row: number; reel: number; value: number }>;
  captainCount: number;
  captainCells: Array<{ row: number; reel: number }>;
  bonusFeature?: FisherBonusFeature;
  collectionMultiplier: number;
  collectedFishMultiplier: number;
  linePayout: number;
  grossPayout: number;
  net: number;
  potentialCells?: Array<{ row: number; reel: number; value: number }>;
  flowDecision?: SlotFlowDecision;
};

export type FisherBonusState = {
  id: string;
  source: "natural" | "buy";
  spinsRemaining: number;
  spinsPlayed: number;
  totalWin: number;
  captainsCollected: number;
  stage: 0 | 1 | 2 | 3;
  unlockedStage: 0 | 1 | 2 | 3;
  multiplier: number;
  currentBatchRemaining: number;
  queuedBatches: Array<{
    stage: 1 | 2 | 3;
    multiplier: number;
    spins: number;
  }>;
  retriggeredSpins: number;
  modifiers: FisherBonusModifiers;
};

export type FisherMathTuning = {
  maxWinX?: number;
  payoutScale?: number;
  bonusPayoutScale?: number;
  baseScatterRate?: number;
  bonusScatterRate?: number;
  enhancedScatterRate?: number;
  baseSpecialRate?: number;
  bonusSpecialRate?: number;
  basePrizeRate?: number;
  bonusPrizeRate?: number;
  rescueChancePercent?: number;
  captainRescueChancePercent?: number;
  valueWeights?: Record<string, number>;
  bonusSpins?: Record<string, number>;
  retriggerSpins?: number;
  maxBonusSessionSpins?: number;
  stageAwardSpins?: number;
  stageInterval?: number;
  stageMultipliers?: number[];
};

export const FISHER_SYMBOLS: Record<FisherSymbolId, FisherSymbol> = {
  anchor: {
    id: "anchor",
    label: "Osmanlı çapası",
    image: "/assets/fisherman/ottoman-ai/anchor-v1.png",
    payouts: [9.825, 19.65, 65.5],
  },
  tackle: {
    id: "tackle",
    label: "Pirinç olta takımı",
    image: "/assets/fisherman/ottoman-ai/tackle-v1.png",
    payouts: [13.1, 26.2, 85.15],
  },
  buoy: {
    id: "buoy",
    label: "Liman şamandırası",
    image: "/assets/fisherman/ottoman-ai/buoy-v1.png",
    payouts: [16.375, 39.3, 117.9],
  },
  shell: {
    id: "shell",
    label: "Mercan incisi",
    image: "/assets/fisherman/ottoman-ai/coral-v1.png",
    payouts: [19.65, 52.4, 157.2],
  },
  bluefish: {
    id: "bluefish",
    label: "Boğaz lüferi",
    image: "/assets/fisherman/ottoman-ai/bluefish-v1.png",
    payouts: [26.2, 65.5, 196.5],
  },
  orangefish: {
    id: "orangefish",
    label: "Altın çipura",
    image: "/assets/fisherman/ottoman-ai/goldfish-v1.png",
    payouts: [32.75, 98.25, 294.75],
  },
  tuna: {
    id: "tuna",
    label: "Marmara orkinosu",
    image: "/assets/fisherman/ottoman-ai/tuna-v1.png",
    payouts: [52.4, 163.75, 589.5],
  },
  "money-fish": {
    id: "money-fish",
    label: "Hazine balığı",
    image: "/assets/fisherman/ottoman-ai/money-fish-v1.png",
  },
  captain: {
    id: "captain",
    label: "Kaptan Mercan",
    image: "/assets/fisherman/ottoman-ai/captain-medallion-v2.png",
  },
  scatter: {
    id: "scatter",
    label: "Gece feneri",
    image: "/assets/fisherman/ottoman-ai/lighthouse-scatter-v1.png",
  },
};

// Twenty fixed lines across a 5×4 window. Rows are zero based.
export const FISHER_PAYLINES: number[][] = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3],
  [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3],
  [0, 0, 1, 0, 0],
  [3, 3, 2, 3, 3],
  [1, 0, 0, 0, 1],
  [2, 3, 3, 3, 2],
  [1, 2, 3, 2, 1],
  [2, 1, 0, 1, 2],
  [0, 1, 1, 1, 0],
  [3, 2, 2, 2, 3],
  [1, 1, 0, 1, 1],
  [2, 2, 3, 2, 2],
  [0, 2, 0, 2, 0],
  [3, 1, 3, 1, 3],
  [1, 3, 1, 3, 1],
  [2, 0, 2, 0, 2],
];

const BASE_WEIGHTS: Array<[FisherSymbolId, number]> = [
  ["anchor", 16],
  ["tackle", 15],
  ["buoy", 14],
  ["shell", 13],
  ["bluefish", 10],
  ["orangefish", 8],
  ["tuna", 5],
  ["money-fish", 4.2],
  ["captain", 0.5],
  ["scatter", 1.45],
];
const BONUS_WEIGHTS: Array<[FisherSymbolId, number]> = [
  ["anchor", 12],
  ["tackle", 12],
  ["buoy", 11],
  ["shell", 10],
  ["bluefish", 9],
  ["orangefish", 7],
  ["tuna", 4],
  ["money-fish", 5.5],
  ["captain", 0.9],
  ["scatter", 0.75],
];
const ANTE_WEIGHTS: Array<[FisherSymbolId, number]> = BASE_WEIGHTS.map(
  ([id, weight]) => [id, id === "scatter" ? 2.45 : weight],
);
const CASH_VALUES: Array<[number, number]> = [
  [1, 40],
  [2, 30],
  [3, 20],
  [5, 15],
  [10, 7],
  [15, 3],
  [25, 1.5],
  [50, 0.5],
  [100, 0.1],
  [500, 0.01],
  [1000, 0.002],
  [2500, 0.0002],
];

export const EMPTY_FISHER_BONUS_MODIFIERS: FisherBonusModifiers = {
  "more-fish": false,
  "more-captains": false,
  "more-features": false,
  "extra-spins": false,
  "start-level-two": false,
};

export function createFisherBonusPickDeck(
  random: () => number = Math.random,
): FisherBonusPickCard[] {
  const rewards: FisherBonusPickCard["reward"][] = [
    "more-fish",
    "more-captains",
    "more-features",
    "extra-spins",
    "start-level-two",
    "boot",
  ];
  for (let index = rewards.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [rewards[index], rewards[other]] = [rewards[other], rewards[index]];
  }
  return rewards.map((reward, index) => ({
    id: `ferman-${index}-${reward}`,
    reward,
  }));
}

function weighted<T>(options: Array<[T, number]>, random: () => number): T {
  const total = options.reduce((sum, option) => sum + option[1], 0);
  let cursor = random() * total;
  for (const [value, weight] of options) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return options.at(-1)![0];
}

function configuredSymbolWeights(
  bonus: boolean,
  ante: boolean,
  tuning: FisherMathTuning,
) {
  const source = bonus ? BONUS_WEIGHTS : ante ? ANTE_WEIGHTS : BASE_WEIGHTS;
  return source.map(([id, weight]) => {
    if (id === "scatter") {
      const configured = bonus
        ? tuning.bonusScatterRate
        : ante
          ? tuning.enhancedScatterRate
          : tuning.baseScatterRate;
      return [id, Math.max(0, configured ?? weight)] as [
        FisherSymbolId,
        number,
      ];
    }
    if (id === "captain") {
      const configured = bonus
        ? (tuning.bonusSpecialRate ?? 0.52)
        : tuning.baseSpecialRate;
      return [id, Math.max(0, configured ?? weight)] as [
        FisherSymbolId,
        number,
      ];
    }
    if (id === "money-fish") {
      const configured = bonus
        ? (tuning.bonusPrizeRate ?? 1.65)
        : tuning.basePrizeRate;
      return [id, Math.max(0, configured ?? weight)] as [
        FisherSymbolId,
        number,
      ];
    }
    return [id, weight] as [FisherSymbolId, number];
  });
}

function configuredCashValues(tuning: FisherMathTuning) {
  return CASH_VALUES.map(
    ([value, weight]) =>
      [value, Math.max(0, tuning.valueWeights?.[String(value)] ?? weight)] as [
        number,
        number,
      ],
  );
}

function randomCell(
  bonus: boolean,
  random: () => number,
  ante = false,
  tuning: FisherMathTuning = {},
): FisherCell {
  const id = weighted(configuredSymbolWeights(bonus, ante, tuning), random);
  return id === "money-fish"
    ? { id, cashMultiplier: weighted(configuredCashValues(tuning), random) }
    : { id };
}

function randomMoneyFishCell(
  random: () => number,
  tuning: FisherMathTuning,
): FisherCell {
  return {
    id: "money-fish",
    cashMultiplier: weighted(configuredCashValues(tuning), random),
  };
}

function addBonusFeatureFish(
  grid: FisherCell[][],
  random: () => number,
  tuning: FisherMathTuning,
  modifiers: FisherBonusModifiers,
): FisherBonusFeature | undefined {
  const captains = grid.flat().filter((cell) => cell.id === "captain").length;
  const fish = grid.flat().filter((cell) => cell.id === "money-fish").length;
  const configuredChance = Math.max(
    0,
    Math.min(1, (tuning.captainRescueChancePercent ?? 48) / 100),
  );
  const chance = modifiers["more-features"]
    ? Math.min(1, configuredChance * 1.45)
    : configuredChance;
  if (!captains || fish || random() >= chance) return undefined;

  const feature = weighted<FisherBonusFeature>(
    [
      ["hook", 5],
      ["dynamite", 3],
      ["bazooka", 1],
    ],
    random,
  );
  const addCount =
    feature === "hook"
      ? 1 + Math.floor(random() * 2)
      : feature === "dynamite"
        ? 2 + Math.floor(random() * 3)
        : 4 + Math.floor(random() * 4);
  const eligible: Array<{ row: number; reel: number }> = [];
  grid.forEach((row, rowIndex) =>
    row.forEach((cell, reel) => {
      if (cell.id !== "captain" && cell.id !== "scatter")
        eligible.push({ row: rowIndex, reel });
    }),
  );
  for (let index = eligible.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [eligible[index], eligible[other]] = [eligible[other], eligible[index]];
  }
  eligible.slice(0, addCount).forEach(({ row, reel }) => {
    grid[row][reel] = randomMoneyFishCell(random, tuning);
  });
  return feature;
}

export function createFisherGrid(
  bonus = false,
  random: () => number = Math.random,
  ante = false,
  tuning: FisherMathTuning = {},
): FisherCell[][] {
  return Array.from({ length: FISHER_ROWS }, () =>
    Array.from({ length: FISHER_REELS }, () =>
      randomCell(bonus, random, ante, tuning),
    ),
  );
}

function forceScatters(
  grid: FisherCell[][],
  count: number,
  random: () => number,
) {
  const reels = [...Array(FISHER_REELS).keys()];
  for (let index = reels.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [reels[index], reels[other]] = [reels[other], reels[index]];
  }
  reels.slice(0, count).forEach((reel) => {
    grid[Math.floor(random() * FISHER_ROWS)][reel] = { id: "scatter" };
  });
}

export function evaluateFisherGrid(
  grid: FisherCell[][],
  wager: number,
  options: {
    bonus?: boolean;
    bonusMultiplier?: number;
    random?: () => number;
    allowHook?: boolean;
    tuning?: FisherMathTuning;
    bonusFeature?: FisherBonusFeature;
  } = {},
): FisherSpinResult {
  const random = options.random ?? Math.random;
  const tuning = options.tuning ?? {};
  let scatterCount = grid.flat().filter((cell) => cell.id === "scatter").length;
  let hookRescue = false;
  if (
    !options.bonus &&
    options.allowHook !== false &&
    scatterCount === 2 &&
    random() < (tuning.rescueChancePercent ?? 14) / 100
  ) {
    const eligible = [...Array(FISHER_REELS).keys()].filter(
      (reel) => !grid.some((row) => row[reel].id === "scatter"),
    );
    if (eligible.length) {
      const reel = eligible[Math.floor(random() * eligible.length)];
      grid[Math.floor(random() * FISHER_ROWS)][reel] = { id: "scatter" };
      scatterCount += 1;
      hookRescue = true;
    }
  }

  const lineBet = wager / FISHER_PAYLINES.length;
  const lineWins: FisherLineWin[] = [];
  FISHER_PAYLINES.forEach((rows, line) => {
    const cells = rows.map((row, reel) => grid[row][reel]);
    const paying = cells.find((cell) => cell.id !== "captain")?.id;
    if (!paying || paying === "scatter" || paying === "money-fish") return;
    let count = 0;
    for (const cell of cells) {
      if (cell.id === paying || cell.id === "captain") count += 1;
      else break;
    }
    if (count < 3) return;
    const multiplier =
      (FISHER_SYMBOLS[paying].payouts?.[count - 3] ?? 0) *
      Math.max(
        0,
        options.bonus
          ? (tuning.bonusPayoutScale ?? tuning.payoutScale ?? 1.05)
          : (tuning.payoutScale ?? 1.122),
      );
    if (multiplier <= 0) return;
    lineWins.push({
      line,
      symbol: paying,
      count,
      multiplier,
      payout: lineBet * multiplier,
      cells: rows.slice(0, count).map((row, reel) => ({ row, reel })),
    });
  });

  const linePayout = lineWins.reduce((sum, win) => sum + win.payout, 0);
  const scatterMultiplier =
    scatterCount >= 5
      ? 50
      : scatterCount === 4
        ? 12
        : scatterCount === 3
          ? 5
          : 0;
  const scatterPayout = wager * scatterMultiplier;
  const configuredBonusSpins =
    tuning.bonusSpins?.[String(Math.min(5, scatterCount))];
  const bonusSpins =
    scatterCount < 3
      ? 0
      : options.bonus
        ? Math.max(0, Math.round(tuning.retriggerSpins ?? 5))
      : configuredBonusSpins !== undefined
        ? Math.max(0, Math.round(configuredBonusSpins))
        : scatterCount >= 5
          ? 20
          : scatterCount === 4
            ? 15
            : 10;
  const fishCells = grid.flatMap((row, rowIndex) =>
    row.flatMap((cell, reel) =>
      cell.id === "money-fish"
        ? [{ row: rowIndex, reel, value: cell.cashMultiplier ?? 0 }]
        : [],
    ),
  );
  const fishValues = fishCells.map((cell) => cell.value);
  const captainCells = grid.flatMap((row, rowIndex) =>
    row.flatMap((cell, reel) =>
      cell.id === "captain" ? [{ row: rowIndex, reel }] : [],
    ),
  );
  const captainCount = captainCells.length;
  const collectionMultiplier = Math.max(1, options.bonusMultiplier ?? 1);
  // Kaptan ekranda bulunduğu her modda görünür para balıklarını toplar.
  // Temel oyunda çarpan 1x, bonusta aktif sefer çarpanıdır.
  const collectedFishMultiplier =
    captainCount > 0 && fishValues.length > 0
      ? fishValues.reduce((sum, value) => sum + value, 0) *
        collectionMultiplier *
        captainCount
      : 0;
  const maxPayout = wager * Math.max(1, tuning.maxWinX ?? 10_000);
  const grossPayout = Math.min(
    maxPayout,
    Math.round(
      (linePayout + scatterPayout + wager * collectedFishMultiplier) * 100,
    ) / 100,
  );
  return {
    grid,
    lineWins,
    scatterCount,
    scatterPayout,
    bonusSpins,
    hookRescue,
    fishValues,
    fishCells,
    captainCount,
    captainCells,
    bonusFeature: options.bonusFeature,
    collectionMultiplier,
    collectedFishMultiplier,
    linePayout,
    grossPayout,
    net: grossPayout - wager,
    potentialCells: [],
  };
}

function decorateFisherPotential(
  result: FisherSpinResult,
  random: () => number,
  potential: SlotPotentialSettings,
  flow: SlotFlowDecision,
) {
  if (
    !potential.enabled ||
    !flow.showPotential ||
    result.captainCount > 0
  )
    return result;
  const minimum = Math.max(0, Math.round(potential.displayOnlyMinItems));
  const maximum = Math.max(minimum, Math.round(potential.displayOnlyMaxItems));
  const count = minimum + Math.floor(random() * Math.max(1, maximum - minimum + 1));
  const highValues = CASH_VALUES.map(([value]) => value).filter(
    (value) =>
      value >= potential.displayOnlyHighValueMinX &&
      value <= potential.displayOnlyHighValueMaxX,
  );
  const winning = new Set(
    result.lineWins.flatMap((win) =>
      win.cells.map((cell) => `${cell.row}-${cell.reel}`),
    ),
  );
  const candidates = Array.from({ length: FISHER_ROWS * FISHER_REELS }, (_, index) => ({
    row: Math.floor(index / FISHER_REELS),
    reel: index % FISHER_REELS,
  })).filter(
    ({ row, reel }) =>
      !winning.has(`${row}-${reel}`) && result.grid[row][reel].id !== "scatter",
  );
  const added: Array<{ row: number; reel: number; value: number }> = [];
  for (let item = 0; item < count && candidates.length; item += 1) {
    const index = Math.floor(random() * candidates.length);
    const cell = candidates.splice(index, 1)[0];
    const value = highValues.length
      ? highValues[Math.floor(random() * highValues.length)]
      : 50;
    result.grid[cell.row][cell.reel] = {
      id: "money-fish",
      cashMultiplier: value,
    };
    added.push({ ...cell, value });
  }
  result.potentialCells = added;
  result.fishCells = [
    ...result.fishCells,
    ...added.map(({ row, reel, value }) => ({ row, reel, value })),
  ];
  result.fishValues = result.fishCells.map((cell) => cell.value);
  result.flowDecision = flow;
  return result;
}

export function spinFisher(
  wager: number,
  options: {
    bonus?: boolean;
    bonusMultiplier?: number;
    random?: () => number;
    forceScatters?: number;
    ante?: boolean;
    tuning?: FisherMathTuning;
    bonusModifiers?: FisherBonusModifiers;
    flow?: SlotFlowDecision;
    potential?: SlotPotentialSettings;
  } = {},
) {
  const random = options.random ?? Math.random;
  const modifiers = {
    ...EMPTY_FISHER_BONUS_MODIFIERS,
    ...options.bonusModifiers,
  };
  const tuning: FisherMathTuning | undefined = options.bonus
    ? {
        ...options.tuning,
        bonusSpecialRate:
          (options.tuning?.bonusSpecialRate ?? 0.52) *
          (modifiers["more-captains"] ? 1.32 : 1),
        bonusPrizeRate:
          (options.tuning?.bonusPrizeRate ?? 1.65) *
          (modifiers["more-fish"] ? 1.34 : 1),
      }
    : options.tuning;
  const activeTuning: FisherMathTuning = { ...(tuning ?? {}) };
  if (options.flow) {
    if (options.bonus) {
      activeTuning.bonusScatterRate =
        (activeTuning.bonusScatterRate ?? 0.75) * options.flow.bonusWeightMultiplier;
      activeTuning.bonusPrizeRate =
        (activeTuning.bonusPrizeRate ?? 1.65) * options.flow.eventWeightMultiplier;
      activeTuning.bonusSpecialRate =
        (activeTuning.bonusSpecialRate ?? 0.52) * options.flow.eventWeightMultiplier;
    } else {
      activeTuning.baseScatterRate =
        (activeTuning.baseScatterRate ?? 1.45) * options.flow.bonusWeightMultiplier;
      activeTuning.basePrizeRate =
        (activeTuning.basePrizeRate ?? 4.2) * options.flow.eventWeightMultiplier;
      activeTuning.baseSpecialRate =
        (activeTuning.baseSpecialRate ?? 0.55) * options.flow.eventWeightMultiplier;
    }
  }
  const grid = createFisherGrid(options.bonus, random, options.ante, activeTuning);
  if (options.forceScatters) forceScatters(grid, options.forceScatters, random);
  else if (options.flow?.strongTease)
    forceScatters(grid, options.flow.convertTease ? 3 : 2, random);
  const bonusFeature = options.bonus
    ? addBonusFeatureFish(grid, random, activeTuning, modifiers)
    : undefined;
  const result = evaluateFisherGrid(grid, wager, {
    ...options,
    tuning: activeTuning,
    bonusFeature,
    random,
    allowHook: !options.forceScatters,
  });
  result.flowDecision = options.flow;
  return options.flow && options.potential
    ? decorateFisherPotential(result, random, options.potential, options.flow)
    : result;
}

const stageMultipliers = [1, 2, 3, 10] as const;

export function createFisherBonus(
  id: string,
  spins: number,
  source: "natural" | "buy",
  modifiers: Partial<FisherBonusModifiers> = {},
  tuning: FisherMathTuning = {},
): FisherBonusState {
  const activeModifiers = {
    ...EMPTY_FISHER_BONUS_MODIFIERS,
    ...modifiers,
  };
  const configuredStages = tuning.stageMultipliers?.length
    ? tuning.stageMultipliers.slice(0, 4).map((value) => Math.max(1, value))
    : [...stageMultipliers];
  const interval = Math.max(1, Math.round(tuning.stageInterval ?? 4));
  const startsAtLevelTwo = activeModifiers["start-level-two"];
  return {
    id,
    source,
    spinsRemaining: spins + (activeModifiers["extra-spins"] ? 2 : 0),
    spinsPlayed: 0,
    totalWin: 0,
    captainsCollected: startsAtLevelTwo ? interval : 0,
    stage: startsAtLevelTwo ? 1 : 0,
    unlockedStage: startsAtLevelTwo ? 1 : 0,
    multiplier: startsAtLevelTwo ? (configuredStages[1] ?? 2) : 1,
    currentBatchRemaining: spins + (activeModifiers["extra-spins"] ? 2 : 0),
    queuedBatches: [],
    retriggeredSpins: 0,
    modifiers: activeModifiers,
  };
}

export function advanceFisherBonus(
  state: FisherBonusState,
  result: FisherSpinResult,
  tuning: FisherMathTuning = {},
): {
  state: FisherBonusState;
  stagesAdvanced: number;
  extraSpins: number;
  scatterExtra: number;
  sessionCapped: boolean;
  unlockedMultiplier?: number;
  batchActivated: boolean;
} {
  const configuredStages = tuning.stageMultipliers?.length
    ? tuning.stageMultipliers.slice(0, 4).map((value) => Math.max(1, value))
    : [...stageMultipliers];
  const interval = Math.max(1, Math.round(tuning.stageInterval ?? 4));
  const maximumStage = Math.min(3, configuredStages.length - 1);
  const captainsCollected = Math.min(
    interval * maximumStage,
    state.captainsCollected + result.captainCount,
  );
  const nextUnlockedStage = Math.min(
    maximumStage,
    Math.floor(captainsCollected / interval),
  ) as 0 | 1 | 2 | 3;
  const stagesAdvanced = Math.max(0, nextUnlockedStage - state.unlockedStage);
  const stageSpins =
    Math.max(0, Math.round(tuning.stageAwardSpins ?? 10)) +
    (state.modifiers["extra-spins"] ? 2 : 0);
  const scatterExtra =
    result.scatterCount >= 3
      ? Math.max(0, Math.round(tuning.retriggerSpins ?? 5))
      : 0;
  const newlyQueued = Array.from({ length: stagesAdvanced }, (_, index) => {
    const stage = (state.unlockedStage + index + 1) as 1 | 2 | 3;
    return {
      stage,
      multiplier: configuredStages[stage] ?? 1,
      spins: stageSpins,
    };
  });
  let currentBatchRemaining =
    Math.max(0, state.currentBatchRemaining - 1) + scatterExtra;
  const queuedBatches = [...state.queuedBatches, ...newlyQueued];
  let activeStage = state.stage;
  let activeMultiplier = state.multiplier;
  let batchActivated = false;
  if (currentBatchRemaining <= 0 && queuedBatches.length) {
    const nextBatch = queuedBatches.shift()!;
    currentBatchRemaining = nextBatch.spins;
    activeStage = nextBatch.stage;
    activeMultiplier = nextBatch.multiplier;
    batchActivated = true;
  }
  const spinsRemaining =
    currentBatchRemaining +
    queuedBatches.reduce((sum, batch) => sum + batch.spins, 0);
  const spinsPlayed = state.spinsPlayed + 1;
  const sessionLimit = Math.max(
    1,
    Math.round(tuning.maxBonusSessionSpins ?? 60),
  );
  const cappedSpinsRemaining = Math.min(
    spinsRemaining,
    Math.max(0, sessionLimit - spinsPlayed),
  );
  const sessionCapped = spinsRemaining > cappedSpinsRemaining;
  if (currentBatchRemaining > cappedSpinsRemaining) {
    currentBatchRemaining = cappedSpinsRemaining;
    queuedBatches.length = 0;
  } else {
    let queuedCapacity = cappedSpinsRemaining - currentBatchRemaining;
    for (let index = 0; index < queuedBatches.length; index += 1) {
      const allowed = Math.min(queuedBatches[index].spins, queuedCapacity);
      queuedBatches[index] = { ...queuedBatches[index], spins: allowed };
      queuedCapacity -= allowed;
    }
    for (let index = queuedBatches.length - 1; index >= 0; index -= 1) {
      if (queuedBatches[index].spins <= 0) queuedBatches.splice(index, 1);
    }
  }
  const remainingBeforeAwards = Math.max(0, state.spinsRemaining - 1);
  const actualExtraSpins = Math.max(0, cappedSpinsRemaining - remainingBeforeAwards);
  const actualScatterExtra = Math.min(scatterExtra, actualExtraSpins);
  return {
    state: {
      ...state,
      spinsRemaining: cappedSpinsRemaining,
      spinsPlayed,
      totalWin: state.totalWin + result.grossPayout,
      captainsCollected,
      stage: activeStage,
      unlockedStage: nextUnlockedStage,
      multiplier: activeMultiplier,
      currentBatchRemaining,
      queuedBatches,
      retriggeredSpins: state.retriggeredSpins + actualExtraSpins,
    },
    stagesAdvanced,
    extraSpins: actualExtraSpins,
    scatterExtra: actualScatterExtra,
    sessionCapped,
    unlockedMultiplier: stagesAdvanced
      ? (configuredStages[nextUnlockedStage] ?? 1)
      : undefined,
    batchActivated,
  };
}
