export const ALLAH_ROWS = 6;
export const ALLAH_REELS = 5;
export const ALLAH_MAX_WIN_X = 500_000;

const allahMultiplierNumber = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** Coin faces are stake multipliers, never wallet-currency amounts. */
export const formatAllahMultiplier = (value: number) => `${allahMultiplierNumber.format(value)}×`;

export type AllahNormalSymbolId =
  | "rosette"
  | "lantern"
  | "crescent"
  | "tree-of-life"
  | "golden-owl"
  | "star-of-david"
  | "gate-of-light"
  | "hand-of-blessing"
  | "ruby-pomegranate"
  | "celestial-key";

/**
 * The fixed symbol tablet shown beneath Odin's Eye. An Eye unlocks one entry
 * on this tablet and only matching symbols on the board become Mystery cells.
 */
export const ALLAH_EYE_SYMBOL_ROSTER: readonly AllahNormalSymbolId[] = [
  "rosette",
  "golden-owl",
  "lantern",
  "star-of-david",
  "crescent",
  "gate-of-light",
  "tree-of-life",
  "hand-of-blessing",
  "ruby-pomegranate",
];

export type AllahEyeVariant = "blue" | "gold" | "emerald";
export type AllahCoinTier =
  | "bronze"
  | "silver"
  | "gold"
  | "sapphire"
  | "ruby"
  | "diamond";
export type AllahBonusTier = "free" | "super" | "legendary" | "mythic";
export type AllahPurchaseMode =
  | "base"
  | "enhancer"
  | "degen"
  | "trickster"
  | "fate"
  | "bonus-buy"
  | "super-bonus-buy";

type CellBase = { id: string; fromMystery?: boolean };
export type AllahCell =
  | (CellBase & { kind: "symbol"; symbol: AllahNormalSymbolId })
  | (CellBase & { kind: "coin"; tier: AllahCoinTier; value: number })
  | (CellBase & { kind: "eye"; variant: AllahEyeVariant })
  | (CellBase & {
      kind: "mystery";
      source?: "random" | "eye" | "collector" | "fate";
    })
  | (CellBase & { kind: "empty" })
  | (CellBase & { kind: "collector"; super: boolean })
  | (CellBase & { kind: "upgrader" })
  | (CellBase & { kind: "redrop" })
  | (CellBase & { kind: "multiplier"; value: number })
  | (CellBase & { kind: "scatter" })
  | (CellBase & { kind: "global-key" })
  | (CellBase & { kind: "max-coin" });

export type AllahGrid = AllahCell[][];

export type AllahLineWin = {
  payline: number;
  symbol: AllahNormalSymbolId;
  count: 3 | 4 | 5;
  multiplier: number;
  cells: AllahCellPosition[];
};

export type AllahCellPosition = { row: number; column: number };

export type AllahFeatureEventType =
  | "spin-commit"
  | "guardian-ack"
  | "column-feed"
  | "reel-impact"
  | "payline-trace"
  | "symbol-pulse"
  | "eye-wake"
  | "eye-look-up"
  | "eye-look-left"
  | "eye-look-right"
  | "eye-look-down-grid"
  | "eye-ray"
  | "eye-slot-fill"
  | "eye-symbol-trigger"
  | "mystery-seed"
  | "mystery-roll"
  | "mystery-reveal"
  | "board-multiplier-anticipation"
  | "board-multiplier-reveal"
  | "key-flight"
  | "key-vault-open"
  | "key-slot-spin"
  | "key-slot-lock"
  | "wheel-anticipation"
  | "wheel-spin"
  | "global-merge"
  | "global-merge-apply"
  | "global-row-charge"
  | "global-row-apply"
  | "global-final"
  | "board-multiplier-wake"
  | "board-multiplier-cast"
  | "board-multiplier-apply"
  | "board-multiplier-wave"
  | "coin-upgrader-charge"
  | "coin-upgrader-apply"
  | "modifier-coin-roll"
  | "modifier-coin-land"
  | "redrop-clear"
  | "redrop-fall"
  | "collector-wake"
  | "coin-flight"
  | "collector-merge"
  | "super-collector-reset"
  | "feature-respin"
  | "scatter-lock"
  | "bonus-portal"
  | "bonus-upgrade"
  | "max-coin-award"
  | "payout-count"
  | "win-tier"
  | "settlement"
  | "return-idle";

export type AllahFeatureEvent = {
  id: string;
  type: AllahFeatureEventType;
  durationNormal: number;
  durationTurbo: number;
  cells: AllahCellPosition[];
  payload: Record<string, string | number | boolean | null>;
  /** Immutable presentation snapshots. The UI never guesses an intermediate board. */
  grid: AllahGrid;
  eyeSlots: AllahNormalSymbolId[];
  globalKeySlots: Array<number | null>;
  minimumCoinTier: number;
  globalMultiplier: number;
  collectorValues: Record<string, number>;
  /** Feature faces that are still physically sealed in this presentation frame. */
  concealedFeatureIds: string[];
  /** Feature sources already consumed by a flight, hidden until their next roll. */
  consumedFeatureIds: string[];
  /** Presentation-only values after the final global multiplier, keyed by cell id. */
  globalAppliedValues: Record<string, number>;
};

export type AllahPersistentState = {
  minimumCoinTier: number;
  globalMultiplier: number;
  eyeSlots: AllahNormalSymbolId[];
  persistentEye?: AllahEyeVariant;
  mythicUpgraderPending: boolean;
};

export type AllahBonusState = {
  tier: AllahBonusTier;
  /** Paid mode that opened/bought this session; controls payout calibration only. */
  payoutMode?: AllahPurchaseMode;
  remaining: number;
  totalSpins: number;
  totalPayout: number;
};

export type AllahSpinRequest = {
  wager: number;
  mode?: AllahPurchaseMode;
  persistent?: Partial<AllahPersistentState>;
  bonus?: AllahBonusState;
  forcedGrid?: AllahGrid;
  runId?: string;
  tuning?: Partial<AllahTuningSettings>;
};

export type AllahSpinResult = {
  runId: string;
  mode: AllahPurchaseMode;
  /** Auditable spin-character selected before an unforced board is composed. */
  scene: AllahSceneId;
  initialGrid: AllahGrid;
  finalGrid: AllahGrid;
  events: AllahFeatureEvent[];
  lineWins: AllahLineWin[];
  lineWinX: number;
  /** Coin values still visible on the settled board and not stored by a Collector. */
  coinWinX: number;
  /** Values already swept into Collector/Super Collector symbols. */
  collectorWinX: number;
  globalMultiplier: number;
  /** Scale used by the presentation layer so every visible coin matches settlement. */
  payoutDisplayScale: number;
  grossMultiplier: number;
  payout: number;
  maxWin: boolean;
  scatterCount: number;
  triggeredBonus?: AllahBonusTier;
  bonusUpgrade?: AllahBonusTier;
  nextBonus?: AllahBonusState;
  persistent: AllahPersistentState;
  collectorValues: Record<string, number>;
  globalAppliedValues: Record<string, number>;
  globalKeySlots: Array<number | null>;
  featureCycles: number;
};

export type AllahRandom = () => number;

export const ALLAH_PURCHASE_COST_X: Record<AllahPurchaseMode, number> = {
  base: 1,
  enhancer: 3,
  degen: 25,
  trickster: 75,
  fate: 5_000,
  "bonus-buy": 200,
  "super-bonus-buy": 1_000,
};

export const ALLAH_SYMBOLS: Record<
  AllahNormalSymbolId,
  { label: string; image: string; pays: Record<3 | 4 | 5, number>; weight: number }
> = {
  rosette: {
    label: "Turkuaz Rozet",
    image: "/assets/slots/allahin-lutfu/symbols/rosette.png",
    pays: { 3: 0.1, 4: 0.2, 5: 0.4 },
    weight: 22,
  },
  lantern: {
    label: "Kandil",
    image: "/assets/slots/allahin-lutfu/symbols/lantern.png",
    pays: { 3: 0.1, 4: 0.2, 5: 0.5 },
    weight: 20,
  },
  crescent: {
    label: "Hilal",
    image: "/assets/slots/allahin-lutfu/symbols/crescent.png",
    pays: { 3: 0.1, 4: 0.2, 5: 0.7 },
    weight: 18,
  },
  "tree-of-life": {
    label: "Hayat Ağacı",
    image: "/assets/slots/allahin-lutfu/symbols/tree-of-life.png",
    pays: { 3: 0.2, 4: 0.5, 5: 1 },
    weight: 15,
  },
  "golden-owl": {
    label: "Altın Baykuş",
    image: "/assets/slots/allahin-lutfu/symbols/golden-owl.png",
    pays: { 3: 1, 4: 2, 5: 3 },
    weight: 10,
  },
  "star-of-david": {
    label: "Davut Yıldızı",
    image: "/assets/slots/allahin-lutfu/symbols/star-of-david.png",
    pays: { 3: 1, 4: 2, 5: 4 },
    weight: 8,
  },
  "gate-of-light": {
    label: "Nur Kapısı",
    image: "/assets/slots/allahin-lutfu/symbols/gate-of-light.png",
    pays: { 3: 1, 4: 2, 5: 5 },
    weight: 6,
  },
  "hand-of-blessing": {
    label: "Bereket Eli",
    image: "/assets/slots/allahin-lutfu/symbols/hand-of-blessing.png",
    pays: { 3: 2, 4: 3, 5: 10 },
    weight: 4,
  },
  "ruby-pomegranate": {
    label: "Yakut Nar",
    image: "/assets/slots/allahin-lutfu/symbols/ruby-pomegranate.png",
    pays: { 3: 2.2, 4: 5, 5: 15 },
    weight: 3,
  },
  "celestial-key": {
    label: "Semavi Anahtar",
    image: "/assets/slots/allahin-lutfu/symbols/celestial-key.png",
    pays: { 3: 2.5, 4: 10, 5: 25 },
    // This asset is the Global Multiplier Key. Keeping the legacy paytable id
    // readable preserves old telemetry, but a second key must never be drawn
    // as a regular symbol on the live reel strip.
    weight: 0,
  },
};

export const ALLAH_PAYLINES: number[][] = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4],
  [5, 5, 5, 5, 5],
  [0, 1, 2, 1, 0],
  [5, 4, 3, 4, 5],
  [0, 0, 1, 0, 0],
  [5, 5, 4, 5, 5],
  [1, 2, 3, 2, 1],
  [4, 3, 2, 3, 4],
  [0, 1, 1, 1, 0],
  [5, 4, 4, 4, 5],
  [2, 1, 0, 1, 2],
  [3, 4, 5, 4, 3],
  [0, 2, 4, 2, 0],
  [5, 3, 1, 3, 5],
  [2, 2, 1, 2, 2],
  [3, 3, 4, 3, 3],
  [1, 0, 1, 2, 3],
  [4, 5, 4, 3, 2],
  [0, 1, 2, 3, 4],
  [5, 4, 3, 2, 1],
  [1, 2, 1, 0, 1],
  [4, 3, 4, 5, 4],
  [2, 3, 4, 3, 2],
  [3, 2, 1, 2, 3],
];

export const ALLAH_COIN_VALUES: Record<AllahCoinTier, number[]> = {
  bronze: [1, 2, 3, 4],
  silver: [5, 10, 15],
  gold: [25, 50, 100],
  sapphire: [150, 200, 250, 500],
  ruby: [750, 1_000, 2_500, 5_000],
  diamond: [10_000, 25_000, 50_000],
};

export const ALLAH_COIN_TIERS = Object.keys(
  ALLAH_COIN_VALUES,
) as AllahCoinTier[];

/**
 * Reel math profile v5.
 *
 * The regular reels and a Mystery reveal are deliberately separate strips.
 * Coin and modifier symbols belong to the Mystery feature strip; they cannot
 * leak onto an ordinary initial drop or a Redrop replacement. Ordinary reels
 * contain only pay symbols, the Eye and Scatter. Enhanced modes tune Eye and
 * Scatter independently; Tricksterspin raises Eye frequency with a bounded
 * one/two/rare-three Eye rhythm.
 */
const normalDurations: Record<AllahFeatureEventType, [number, number]> = {
  "spin-commit": [80, 30],
  "guardian-ack": [800, 120],
  "column-feed": [240, 65],
  "reel-impact": [85, 35],
  "payline-trace": [650, 125],
  "symbol-pulse": [460, 100],
  "eye-wake": [620, 110],
  "eye-look-up": [340, 90],
  "eye-look-left": [340, 90],
  "eye-look-right": [340, 90],
  "eye-look-down-grid": [340, 90],
  "eye-ray": [480, 110],
  "eye-slot-fill": [560, 130],
  "eye-symbol-trigger": [1_300, 220],
  "mystery-seed": [680, 45],
  "mystery-roll": [480, 60],
  "mystery-reveal": [420, 45],
  "board-multiplier-anticipation": [720, 170],
  "board-multiplier-reveal": [880, 210],
  "key-flight": [720, 160],
  "key-vault-open": [620, 150],
  "key-slot-spin": [540, 130],
  "key-slot-lock": [260, 70],
  "wheel-anticipation": [760, 180],
  "wheel-spin": [980, 300],
  "global-merge": [480, 150],
  "global-merge-apply": [620, 160],
  "global-row-charge": [360, 100],
  "global-row-apply": [640, 180],
  "global-final": [2_400, 780],
  "board-multiplier-wake": [420, 110],
  "board-multiplier-cast": [340, 85],
  "board-multiplier-apply": [260, 65],
  "board-multiplier-wave": [620, 180],
  "coin-upgrader-charge": [760, 220],
  "coin-upgrader-apply": [260, 70],
  "modifier-coin-roll": [430, 95],
  "modifier-coin-land": [460, 65],
  "redrop-clear": [480, 140],
  "redrop-fall": [820, 220],
  "collector-wake": [580, 120],
  "coin-flight": [220, 48],
  "collector-merge": [100, 36],
  "super-collector-reset": [400, 120],
  "feature-respin": [680, 90],
  "scatter-lock": [700, 180],
  "bonus-portal": [1_200, 380],
  "bonus-upgrade": [1_150, 360],
  "max-coin-award": [1_850, 520],
  "payout-count": [1_100, 330],
  "win-tier": [3_600, 1_400],
  settlement: [120, 50],
  "return-idle": [80, 30],
};

let forcedCellSerial = 0;

export function allahSymbolCell(
  symbol: AllahNormalSymbolId,
  id = `forced-symbol-${forcedCellSerial++}`,
): AllahCell {
  return { id, kind: "symbol", symbol };
}

export function allahCoinCell(
  tier: AllahCoinTier,
  value = ALLAH_COIN_VALUES[tier][0],
  id = `forced-coin-${forcedCellSerial++}`,
): AllahCell {
  return { id, kind: "coin", tier, value };
}

export function allahFeatureCell(
  kind: Exclude<AllahCell["kind"], "symbol" | "coin">,
  id = `forced-feature-${forcedCellSerial++}`,
): AllahCell {
  if (kind === "eye") return { id, kind, variant: "blue" };
  if (kind === "collector") return { id, kind, super: false };
  if (kind === "multiplier") return { id, kind, value: 2 };
  return { id, kind } as AllahCell;
}

export function createAllahGrid(
  factory: (row: number, column: number) => AllahCell = (row, column) =>
    allahSymbolCell("rosette", `grid-${row}-${column}`),
): AllahGrid {
  return Array.from({ length: ALLAH_ROWS }, (_, row) =>
    Array.from({ length: ALLAH_REELS }, (_, column) => factory(row, column)),
  );
}

export function createSeededAllahRandom(seed: number): AllahRandom {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function defaultAllahPersistentState(): AllahPersistentState {
  return {
    minimumCoinTier: 0,
    globalMultiplier: 1,
    eyeSlots: [],
    mythicUpgraderPending: false,
  };
}

export function evaluateAllahPaylines(grid: AllahGrid): AllahLineWin[] {
  const wins: AllahLineWin[] = [];
  ALLAH_PAYLINES.forEach((line, payline) => {
    const first = grid[line[0]][0];
    if (first.kind !== "symbol") return;
    let count = 1;
    for (let column = 1; column < ALLAH_REELS; column += 1) {
      const cell = grid[line[column]][column];
      if (cell.kind !== "symbol" || cell.symbol !== first.symbol) break;
      count += 1;
    }
    if (count < 3) return;
    const paidCount = Math.min(5, count) as 3 | 4 | 5;
    wins.push({
      payline,
      symbol: first.symbol,
      count: paidCount,
      multiplier: ALLAH_SYMBOLS[first.symbol].pays[paidCount],
      cells: Array.from({ length: paidCount }, (_, column) => ({
        row: line[column],
        column,
      })),
    });
  });
  return wins;
}

export function allahPurchaseCost(
  wager: number,
  mode: AllahPurchaseMode,
  modeCosts: Partial<Record<AllahPurchaseMode, number>> = ALLAH_PURCHASE_COST_X,
) {
  return roundMoney(
    Math.max(0, wager) * Math.max(0, modeCosts[mode] ?? ALLAH_PURCHASE_COST_X[mode]),
  );
}

function resolveAllahTuning(patch?: Partial<AllahTuningSettings>): AllahTuningSettings {
  const sceneWeights = Object.fromEntries(
    (Object.keys(DEFAULT_ALLAH_TUNING.sceneWeights) as AllahPurchaseMode[]).map((mode) => [
      mode,
      {
        ...DEFAULT_ALLAH_TUNING.sceneWeights[mode],
        ...patch?.sceneWeights?.[mode],
      },
    ]),
  ) as AllahTuningSettings["sceneWeights"];
  return {
    ...DEFAULT_ALLAH_TUNING,
    ...patch,
    sceneWeights,
    characterModePayoutScales: {
      ...DEFAULT_ALLAH_TUNING.characterModePayoutScales,
      ...patch?.characterModePayoutScales,
    },
    scenePayoutScales: { ...DEFAULT_ALLAH_TUNING.scenePayoutScales, ...patch?.scenePayoutScales },
    sceneMaxCostMultipliers: {
      ...DEFAULT_ALLAH_TUNING.sceneMaxCostMultipliers,
      ...patch?.sceneMaxCostMultipliers,
    },
    modeCosts: { ...DEFAULT_ALLAH_TUNING.modeCosts, ...patch?.modeCosts },
    modePayoutScales: { ...DEFAULT_ALLAH_TUNING.modePayoutScales, ...patch?.modePayoutScales },
    reelEyeChancePercent: {
      ...DEFAULT_ALLAH_TUNING.reelEyeChancePercent,
      ...patch?.reelEyeChancePercent,
    },
    reelScatterChancePercent: {
      ...DEFAULT_ALLAH_TUNING.reelScatterChancePercent,
      ...patch?.reelScatterChancePercent,
    },
    bonusFeatureChancePercent: {
      ...DEFAULT_ALLAH_TUNING.bonusFeatureChancePercent,
      ...patch?.bonusFeatureChancePercent,
    },
    bonusScatterChancePercent: {
      ...DEFAULT_ALLAH_TUNING.bonusScatterChancePercent,
      ...patch?.bonusScatterChancePercent,
    },
    mysteryWeights: { ...DEFAULT_ALLAH_TUNING.mysteryWeights, ...patch?.mysteryWeights },
    fateMysteryWeights: {
      ...DEFAULT_ALLAH_TUNING.fateMysteryWeights,
      ...patch?.fateMysteryWeights,
    },
  };
}

function cloneGrid(grid: AllahGrid): AllahGrid {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function boundedRandom(random: AllahRandom) {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999999, Math.max(0, value));
}

function pick<T>(values: readonly T[], random: AllahRandom): T {
  return values[Math.floor(boundedRandom(random) * values.length)];
}

function weightedPick<T>(
  values: Array<{ value: T; weight: number }>,
  random: AllahRandom,
): T {
  const total = values.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let target = boundedRandom(random) * total;
  for (const item of values) {
    target -= Math.max(0, item.weight);
    if (target <= 0) return item.value;
  }
  return values[values.length - 1].value;
}

type AllahMysteryOutcome =
  | "coin"
  | "eye"
  | "collector"
  | "upgrader"
  | "redrop"
  | "multiplier"
  | "scatter"
  | "global-key"
  | "max-coin";

type AllahSceneRuntime = {
  id: AllahSceneId;
  featureQueue: AllahMysteryOutcome[];
};

const sceneHasFeature = (scene: AllahSceneId) => scene !== "quiet" && scene !== "line";

function pickAllahScene(
  mode: AllahPurchaseMode,
  bonusTier: AllahBonusTier | undefined,
  tuning: AllahTuningSettings,
  random: AllahRandom,
): AllahSceneId {
  const source = tuning.sceneWeights[mode] ?? tuning.sceneWeights.base;
  const bonusIntensity = bonusTier
    ? ({ free: 1.25, super: 1.7, legendary: 2.25, mythic: 3 } as const)[bonusTier]
    : 1;
  return weightedPick(
    (Object.entries(source) as Array<[AllahSceneId, number]>).map(([value, weight]) => ({
      value,
      weight: bonusTier
        ? weight * (value === "quiet" || value === "line" ? 1 / bonusIntensity : bonusIntensity)
        : weight,
    })),
    random,
  );
}

function buildSceneFeatureQueue(scene: AllahSceneId, random: AllahRandom): AllahMysteryOutcome[] {
  if (!sceneHasFeature(scene)) return [];
  const queue: AllahMysteryOutcome[] = Array(30).fill("coin");
  const variant = boundedRandom(random) < 0.5;
  const place = (kind: AllahMysteryOutcome, ...indices: number[]) => {
    for (const index of indices) if (index < queue.length) queue[index] = kind;
  };
  if (scene === "eye-spark") place("multiplier", variant ? 3 : 5);
  if (scene === "collector-parade") place("collector", variant ? 1 : 0, variant ? 3 : 2);
  if (scene === "multiplier-pressure") place("multiplier", variant ? 1 : 0, 3, 7);
  if (scene === "global-tension") {
    place("global-key", variant ? 1 : 0);
    place("multiplier", variant ? 5 : 4);
  }
  if (scene === "climb") {
    place("upgrader", variant ? 0 : 1);
    place("redrop", variant ? 2 : 4);
    place("collector", variant ? 4 : 5);
  }
  if (scene === "synergy") {
    place("upgrader", variant ? 0 : 2);
    place("multiplier", variant ? 2 : 1, 7);
    place("collector", variant ? 4 : 5, 12);
    place("global-key", variant ? 6 : 8);
  }
  if (scene === "dream") {
    place("upgrader", 0, variant ? 3 : 2);
    place("multiplier", variant ? 2 : 4, 9);
    place("collector", variant ? 5 : 6, 13);
    place("global-key", variant ? 7 : 8);
  }
  return queue;
}

function pickNormalSymbol(random: AllahRandom): AllahNormalSymbolId {
  return weightedPick(
    (Object.entries(ALLAH_SYMBOLS) as Array<
      [AllahNormalSymbolId, (typeof ALLAH_SYMBOLS)[AllahNormalSymbolId]]
    >).map(([value, info]) => ({ value, weight: info.weight })),
    random,
  );
}

function pickCoin(
  id: string,
  minimumTier: number,
  random: AllahRandom,
  tuning: AllahTuningSettings,
): AllahCell {
  const tierIndex = weightedPick(
    ALLAH_COIN_TIERS.slice(Math.min(5, Math.max(0, minimumTier))).map(
      (tier, index) => ({
        value: minimumTier + index,
        weight: 36 / Math.max(1, tuning.coinTierDecay) ** index,
      }),
    ),
    random,
  );
  const safeIndex = Math.min(5, Math.max(minimumTier, tierIndex));
  const tier = ALLAH_COIN_TIERS[safeIndex];
  return { id, kind: "coin", tier, value: pick(ALLAH_COIN_VALUES[tier], random) };
}

function pickBoardMultiplier(random: AllahRandom) {
  return weightedPick(
    [
      { value: 2 as const, weight: 50 },
      { value: 3 as const, weight: 25 },
      { value: 4 as const, weight: 12 },
      { value: 5 as const, weight: 7 },
      { value: 10 as const, weight: 4 },
      { value: 15 as const, weight: 1.5 },
      { value: 20 as const, weight: 0.5 },
    ],
    random,
  );
}

function pickGlobalSlotValue(random: AllahRandom) {
  return weightedPick(
    [
      { value: 1 as const, weight: 36 },
      { value: 2 as const, weight: 30 },
      { value: 3 as const, weight: 18 },
      { value: 4 as const, weight: 8 },
      { value: 5 as const, weight: 5 },
      { value: 10 as const, weight: 2 },
      { value: 15 as const, weight: 0.7 },
      { value: 20 as const, weight: 0.3 },
    ],
    random,
  );
}

function mysteryFeatureWeights(
  mode: AllahPurchaseMode,
  tuning: AllahTuningSettings,
  bonusTier?: AllahBonusTier,
) {
  if (mode === "fate") return tuning.fateMysteryWeights;
  const intensity = bonusTier
    ? ({ free: 1.2, super: 1.6, legendary: 2.2, mythic: 3 } as const)[bonusTier]
    : ({ base: 1, enhancer: 1.3, degen: 2.1, trickster: 3 } as const)[
        mode === "bonus-buy" || mode === "super-bonus-buy" ? "base" : mode
      ];
  return Object.fromEntries(
    Object.entries(tuning.mysteryWeights).map(([key, weight]) => [
      key,
      key === "coin"
        ? weight
        : key === "maxCoin"
          ? weight * (bonusTier ? 0.001 : 1)
        : weight *
          intensity *
          (mode === "trickster" && key === "eye"
            ? Math.max(0, tuning.tricksterMysteryEyeMultiplier)
            : 1) *
          (bonusTier && key === "scatter" ? 0.1 : 1),
    ]),
  ) as AllahTuningSettings["mysteryWeights"];
}

function createRandomCell(
  id: string,
  mode: AllahPurchaseMode,
  persistent: AllahPersistentState,
  random: AllahRandom,
  tuning: AllahTuningSettings,
  mysteryResolution = false,
  bonusTier?: AllahBonusTier,
  sceneRuntime?: AllahSceneRuntime,
): AllahCell {
  // FU Spin: the public rules and recorded gameplay both show a full Mystery board.
  if (mode === "fate" && !mysteryResolution)
    return { id, kind: "mystery", source: "fate" };

  if (!mysteryResolution) {
    // The base reel is not a coin reel. Coins only exist after Eye/FU/Collector
    // has created a Mystery position and that position resolves. Keep Eye and
    // Scatter on separate probabilities so enhancer modes can favour the
    // mechanic they actually advertise without accidentally spawning coins.
    const eyeChance = Math.max(0, bonusTier
      ? tuning.bonusFeatureChancePercent[bonusTier]
      : tuning.reelEyeChancePercent[mode]) / 100;
    const scatterChance = Math.max(0, bonusTier
      ? tuning.bonusScatterChancePercent[bonusTier]
      : tuning.reelScatterChancePercent[mode]) / 100;
    const roll = boundedRandom(random);
    if (roll < Math.min(1, scatterChance)) return { id, kind: "scatter" };
    if (roll < Math.min(1, scatterChance + eyeChance)) {
      const variant = pick<AllahEyeVariant>(
        persistent.persistentEye
          ? [persistent.persistentEye]
          : ["blue", "blue", "blue", "gold", "emerald"],
        random,
      );
      return { id, kind: "eye", variant };
    }
    return { id, kind: "symbol", symbol: pickNormalSymbol(random) };
  }

  // Keep the Mystery outcome set physically separate from the reel outcome
  // set. A zero weight is not enough protection here: this list makes it
  // impossible for later weighting edits to reintroduce pay symbols or a
  // nested Mystery into a reveal by accident.
  const mysteryWeights = mysteryFeatureWeights(mode, tuning, bonusTier);
  const queuedKind = sceneRuntime?.featureQueue.shift();
  const kind = queuedKind ?? weightedPick<Exclude<AllahCell["kind"], "empty" | "symbol" | "mystery">>(
      [
        { value: "coin", weight: mysteryWeights.coin },
        { value: "eye", weight: mysteryWeights.eye },
        { value: "collector", weight: mysteryWeights.collector },
        { value: "upgrader", weight: mysteryWeights.upgrader },
        { value: "redrop", weight: mysteryWeights.redrop },
        { value: "multiplier", weight: mysteryWeights.multiplier },
        { value: "scatter", weight: mysteryWeights.scatter },
        { value: "global-key", weight: mysteryWeights.key },
        { value: "max-coin", weight: mysteryWeights.maxCoin },
      ],
      random,
    );

  if (kind === "coin") return pickCoin(id, persistent.minimumCoinTier, random, tuning);
  if (kind === "eye") {
    const variant = pick<AllahEyeVariant>(
      persistent.persistentEye
        ? [persistent.persistentEye]
        : ["blue", "blue", "blue", "gold", "emerald"],
      random,
    );
    return { id, kind, variant };
  }
  if (kind === "collector")
    return {
      id,
      kind,
      super: boundedRandom(random) < tuning.superCollectorChancePercent / 100,
    };
  if (kind === "multiplier")
    return {
      id,
      kind,
      value: pickBoardMultiplier(random),
    };
  return { id, kind } as AllahCell;
}

function shapeInitialGridForScene(
  grid: AllahGrid,
  scene: AllahSceneId,
  mode: AllahPurchaseMode,
  bonusTier: AllahBonusTier | undefined,
  random: AllahRandom,
  tuning: AllahTuningSettings,
) {
  if (mode === "fate") return;
  const configuredEyeChance = bonusTier
    ? tuning.bonusFeatureChancePercent[bonusTier]
    : tuning.reelEyeChancePercent[mode];
  // Extreme admin overrides remain exact diagnostic tools.
  if (configuredEyeChance >= 99.999) return;

  const desiredEyes = sceneHasFeature(scene) && configuredEyeChance > 0
    ? scene === "dream"
      ? boundedRandom(random) < 0.25 ? 3 : 2
      : scene === "synergy" ? 2 : 1
    : 0;
  const eyePositions = readingOrder(positionsOf(grid, (cell) => cell.kind === "eye"));
  for (const position of eyePositions.slice(desiredEyes)) {
    const current = grid[position.row][position.column];
    grid[position.row][position.column] = {
      id: current.id,
      kind: "symbol",
      symbol: pickNormalSymbol(random),
    };
  }
  const keptEyes = eyePositions.slice(0, desiredEyes);
  while (keptEyes.length < desiredEyes) {
    const candidates = readingOrder(positionsOf(grid, (cell) => cell.kind === "symbol"));
    if (!candidates.length) break;
    const target = pick(candidates, random);
    const current = grid[target.row][target.column];
    grid[target.row][target.column] = {
      id: current.id,
      kind: "eye",
      variant: scene === "dream" ? "emerald" : scene === "synergy" ? "gold" : "blue",
    };
    keptEyes.push(target);
  }

  if (scene === "line") {
    const payline = pick(ALLAH_PAYLINES, random);
    const symbol = pick<AllahNormalSymbolId>(["rosette", "lantern", "crescent", "tree-of-life"], random);
    for (let column = 0; column < 3; column += 1) {
      const row = payline[column];
      const current = grid[row][column];
      if (current.kind === "scatter" || current.kind === "eye") continue;
      grid[row][column] = { id: current.id, kind: "symbol", symbol };
    }
  }
}

function positionsOf(grid: AllahGrid, predicate: (cell: AllahCell) => boolean) {
  const positions: AllahCellPosition[] = [];
  grid.forEach((row, rowIndex) =>
    row.forEach((cell, column) => {
      if (predicate(cell)) positions.push({ row: rowIndex, column });
    }),
  );
  return positions;
}

function readingOrder(positions: AllahCellPosition[]) {
  return positions
    .map((position) => ({ ...position }))
    .sort((left, right) => left.column - right.column || left.row - right.row);
}

/** Coin artwork follows the face value after multipliers are applied. */
export function allahCoinTierForValue(value: number): AllahCoinTier {
  if (value >= 10_000) return "diamond";
  if (value >= 750) return "ruby";
  if (value >= 150) return "sapphire";
  if (value >= 25) return "gold";
  if (value >= 5) return "silver";
  return "bronze";
}

function eventPayloadCell(grid: AllahGrid, position: AllahCellPosition) {
  return grid[position.row][position.column];
}

function featurePosition(grid: AllahGrid, id: string) {
  return positionsOf(grid, (cell) => cell.id === id)[0];
}

function scatterPatternTier(grid: AllahGrid) {
  const scatters = positionsOf(grid, (cell) => cell.kind === "scatter");
  if (scatters.length < 3) return undefined;
  if (scatters.length < 4) return "free" as const;
  if (scatters.length < 5) return "super" as const;
  const scatterSet = new Set(scatters.map(({ row, column }) => `${row}-${column}`));
  const mythicPatterns = [
    ...Array.from({ length: ALLAH_ROWS }, (_, row) => [row, row, row, row, row]),
    [0, 1, 2, 1, 0],
    [5, 4, 3, 4, 5],
    [0, 2, 4, 2, 0],
    [5, 3, 1, 3, 5],
  ];
  const mythic = mythicPatterns.some((pattern) =>
    pattern.every((row, column) => scatterSet.has(`${row}-${column}`)),
  );
  return mythic ? ("mythic" as const) : ("legendary" as const);
}

function nextBonusTier(tier: AllahBonusTier): AllahBonusTier {
  if (tier === "free") return "super";
  if (tier === "super") return "legendary";
  return "mythic";
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundX(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export function runAllahSpin(
  request: AllahSpinRequest,
  random: AllahRandom = Math.random,
): AllahSpinResult {
  const mode = request.mode ?? "base";
  const tuning = resolveAllahTuning(request.tuning);
  const payoutMode: AllahPurchaseMode = request.bonus?.payoutMode ?? (request.bonus
    ? request.bonus.tier === "free" ? "bonus-buy" : "super-bonus-buy"
    : mode);
  const sceneMode: AllahPurchaseMode = mode === "fate"
    ? "fate"
    : request.bonus?.payoutMode ?? (request.bonus
      ? request.bonus.tier === "free" ? "bonus-buy" : "super-bonus-buy"
      : mode);
  const scene: AllahSceneId = request.forcedGrid || !tuning.characterScenesEnabled
    ? "quiet"
    : pickAllahScene(sceneMode, request.bonus?.tier, tuning, random);
  const sceneRuntime: AllahSceneRuntime | undefined = request.forcedGrid || !tuning.characterScenesEnabled
    ? undefined
    : { id: scene, featureQueue: buildSceneFeatureQueue(scene, random) };
  const modePayoutScale = Math.max(0, tuning.modePayoutScales[payoutMode] ?? 1);
  const scenePayoutScale = sceneRuntime ? Math.max(0, tuning.scenePayoutScales[scene]) : 1;
  const characterModePayoutScale = sceneRuntime
    ? Math.max(0, tuning.characterModePayoutScales[sceneMode] ?? 1)
    : 1;
  const effectivePayoutScale = modePayoutScale * scenePayoutScale * characterModePayoutScale;
  const valueCapX = Math.max(1, tuning.maxWinX);
  const sceneCapX = sceneRuntime
    ? Math.min(
        valueCapX,
        Math.max(1, tuning.modeCosts[sceneMode] * tuning.sceneMaxCostMultipliers[scene]),
      )
    : valueCapX;
  const runId = request.runId ?? `allah-${Date.now()}-${Math.floor(boundedRandom(random) * 1e9)}`;
  const state: AllahPersistentState = {
    ...defaultAllahPersistentState(),
    ...request.persistent,
    eyeSlots: [...(request.persistent?.eyeSlots ?? [])],
  };
  if (request.bonus && !state.persistentEye) state.eyeSlots = [];
  const serial = { value: 0 };
  // Forced boards are deterministic fixtures and must not consume the random
  // stream before their feature sequence starts.
  const initialGrid = request.forcedGrid
    ? cloneGrid(request.forcedGrid)
    : createAllahGrid((row, column) =>
        createRandomCell(
          `${runId}-${row}-${column}-${serial.value++}`,
          mode,
          state,
          random,
          tuning,
          false,
          request.bonus?.tier,
          sceneRuntime,
        ),
      );
  if (!request.forcedGrid && tuning.characterScenesEnabled)
    shapeInitialGridForScene(initialGrid, scene, mode, request.bonus?.tier, random, tuning);

  const grid = cloneGrid(initialGrid);
  const events: AllahFeatureEvent[] = [];
  const collectorValues: Record<string, number> = {};
  const globalAppliedValues: Record<string, number> = {};
  const collectedCoinIds = new Set<string>();
  const revealedFeatureIds = new Set<string>();
  const consumedFeatureIds = new Set<string>();
  let globalKeySlots: Array<number | null> = state.globalMultiplier > 1
    ? [state.globalMultiplier, null, null]
    : [null, null, null];
  let globalKeyRounds = 0;
  let eventSerial = 0;
  const emit = (
    type: AllahFeatureEventType,
    cells: AllahCellPosition[] = [],
    payload: AllahFeatureEvent["payload"] = {},
  ) => {
    const [durationNormal, durationTurbo] = normalDurations[type];
    events.push({
      id: `${runId}-event-${eventSerial++}`,
      type,
      durationNormal,
      durationTurbo,
      cells: cells.map((cell) => ({ ...cell })),
      payload: { ...payload },
      grid: cloneGrid(grid),
      eyeSlots: [...state.eyeSlots],
      globalKeySlots: [...globalKeySlots],
      minimumCoinTier: state.minimumCoinTier,
      globalMultiplier: state.globalMultiplier,
      collectorValues: { ...collectorValues },
      concealedFeatureIds: grid.flat()
        .filter((cell) => cell.kind === "multiplier" && !revealedFeatureIds.has(cell.id))
        .map((cell) => cell.id),
      consumedFeatureIds: [...consumedFeatureIds],
      globalAppliedValues: { ...globalAppliedValues },
    });
  };

  emit("spin-commit", [], { mode, wager: request.wager, scene });
  emit("guardian-ack");
  for (let column = 0; column < ALLAH_REELS; column += 1) {
    const cells = Array.from({ length: ALLAH_ROWS }, (_, row) => ({ row, column }));
    emit("column-feed", cells, { column });
    emit("reel-impact", cells, { column });
  }

  const lineWins: AllahLineWin[] = [];
  const paidLineStages = new Set<string>();
  const captureLineWins = () => {
    for (const win of evaluateAllahPaylines(grid)) {
      const stageKey = `${win.payline}:${win.cells.map(({ row, column }) => grid[row][column].id).join(",")}`;
      if (paidLineStages.has(stageKey)) continue;
      paidLineStages.add(stageKey);
      lineWins.push(win);
      emit("payline-trace", win.cells, {
        payline: win.payline + 1,
        symbol: win.symbol,
        multiplier: win.multiplier,
        payout: roundMoney(Math.max(0, request.wager) * win.multiplier * tuning.linePayoutScale * effectivePayoutScale),
      });
      emit("symbol-pulse", win.cells, { symbol: win.symbol });
    }
  };
  captureLineWins();

  const processed = new Set<string>();
  const collectorPasses = new Map<string, number>();
  const createAllowedFeatureCell = (
    id: string,
    mysteryResolution = false,
    generationMode: AllahPurchaseMode = mode,
  ) => {
    const candidate = createRandomCell(
      id,
      generationMode,
      state,
      random,
      tuning,
      mysteryResolution,
      request.bonus?.tier,
      sceneRuntime,
    );
    return candidate;
  };
  const activateUpgrader = (position: AllahCellPosition) => {
    const upgrader = eventPayloadCell(grid, position);
    if (upgrader.kind !== "upgrader" || processed.has(upgrader.id)) return;
    processed.add(upgrader.id);
    const previousMinimumTier = state.minimumCoinTier;
    const nextMinimumTier = Math.min(
      ALLAH_COIN_TIERS.length - 1,
      previousMinimumTier + 1,
    );
    const removedTier = ALLAH_COIN_TIERS[previousMinimumTier];
    emit("coin-upgrader-charge", [position], {
      removedTier,
      previousTier: removedTier,
      nextTier: ALLAH_COIN_TIERS[nextMinimumTier],
      upgradeLevel: nextMinimumTier,
    });
    state.minimumCoinTier = nextMinimumTier;
    // Existing coins keep their face value. Every cell generated after this
    // exact point in reading order sees the new minimum immediately.
    emit("coin-upgrader-apply", [position], {
      removedTier,
      minimumTier: ALLAH_COIN_TIERS[state.minimumCoinTier],
      upgradeLevel: state.minimumCoinTier,
      upgraded: 0,
      complete: true,
    });
  };
  const revealMysteries = (
    mysteryPositions: AllahCellPosition[],
    source: string,
    extraPayload: AllahFeatureEvent["payload"] = {},
  ) => {
    const ordered = readingOrder(mysteryPositions);
    ordered.forEach((position, index) => {
      const mystery = eventPayloadCell(grid, position);
      if (mystery.kind !== "mystery") return;
      emit("mystery-roll", [position], {
        source,
        index: index + 1,
        total: ordered.length,
        ...extraPayload,
      });
      processed.add(mystery.id);
      const id = `${runId}-revealed-${serial.value++}`;
      const revealed = request.bonus?.tier === "mythic" && state.mythicUpgraderPending
        ? ({ id, kind: "upgrader" } as AllahCell)
        : createAllowedFeatureCell(id, true);
      if (request.bonus?.tier === "mythic" && state.mythicUpgraderPending)
        state.mythicUpgraderPending = false;
      grid[position.row][position.column] = {
        ...revealed,
        fromMystery: true,
      };
      emit("mystery-reveal", [position], {
        source,
        index: index + 1,
        total: ordered.length,
        revealedKind: grid[position.row][position.column].kind,
        ...extraPayload,
      });
      // Mystery cells resolve in reading order. An Upgrader changes the
      // generator floor before the next Mystery cell is generated, so a coin
      // immediately after the staff can no longer use the removed tier.
      if (grid[position.row][position.column].kind === "upgrader")
        activateUpgrader(position);
    });
  };

  const seedEyeMatches = (
    selected: AllahNormalSymbolId,
    sourcePosition?: AllahCellPosition,
    persistent = false,
  ) => {
    const slot = ALLAH_EYE_SYMBOL_ROSTER.indexOf(selected);
    const targets = readingOrder(positionsOf(
      grid,
      (cell) => cell.kind === "symbol" && cell.symbol === selected,
    ));
    if (persistent && targets.length)
      emit("eye-symbol-trigger", targets, {
        selected,
        slot,
        persistent: true,
        count: targets.length,
      });
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      if (sourcePosition)
        emit("eye-ray", [sourcePosition, target], {
          selected,
          slot,
          targetColumn: target.column,
          targetRow: target.row,
          index: index + 1,
          total: targets.length,
        });
      grid[target.row][target.column] = {
        id: `${runId}-eye-mystery-${serial.value++}`,
        kind: "mystery",
        source: "eye",
      };
      emit("mystery-seed", [target], {
        source: "eye",
        selected,
        slot,
        persistent,
        index: index + 1,
        total: targets.length,
      });
    }
    return targets;
  };

  // Golden and emerald Eyes keep previously unlocked tablet symbols active
  // during the bonus. Each new board converts only those exact matches.
  if (request.bonus && state.persistentEye && state.eyeSlots.length) {
    for (const selected of state.eyeSlots) seedEyeMatches(selected, undefined, true);
  }
  let featureCycles = 0;
  const maxCycles = Math.max(
    1,
    Math.floor(mode === "fate" ? tuning.fateMaxFeatureCycles : tuning.maxFeatureCycles),
  );

  while (featureCycles < maxCycles) {
    const pending = positionsOf(
      grid,
      (cell) => ["mystery", "eye", "multiplier", "upgrader", "redrop", "global-key", "collector"].includes(cell.kind) && !processed.has(cell.id),
    );
    if (!pending.length) break;
    featureCycles += 1;

    const mysteries = positionsOf(grid, (cell) => cell.kind === "mystery" && !processed.has(cell.id));
    if (mysteries.length) {
      const source = mysteries.some((position) => {
        const cell = grid[position.row][position.column];
        return cell.kind === "mystery" && cell.source === "fate";
      }) ? "fate" : "random";
      emit("mystery-seed", mysteries, { source, count: mysteries.length });
      revealMysteries(mysteries, source);
      captureLineWins();
    }

    const eyes = readingOrder(positionsOf(grid, (cell) => cell.kind === "eye" && !processed.has(cell.id)));
    for (const position of eyes) {
      const eye = eventPayloadCell(grid, position);
      if (eye.kind !== "eye") continue;
      processed.add(eye.id);
      const desiredMin = Math.max(1, Math.floor(request.bonus
        ? tuning.bonusEyeTargetsMin
        : tuning.eyeTargetsMin));
      const desiredMax = Math.max(desiredMin, Math.floor(request.bonus
        ? tuning.bonusEyeTargetsMax
        : tuning.eyeTargetsMax));
      const visibleCounts = new Map<AllahNormalSymbolId, number>();
      for (const cell of grid.flat())
        if (cell.kind === "symbol") visibleCounts.set(cell.symbol, (visibleCounts.get(cell.symbol) ?? 0) + 1);
      const visibleUnopened = ALLAH_EYE_SYMBOL_ROSTER.filter(
        (symbol) => !state.eyeSlots.includes(symbol) && (visibleCounts.get(symbol) ?? 0) > 0,
      );
      const inTargetRange = visibleUnopened.filter((symbol) => {
        const count = visibleCounts.get(symbol) ?? 0;
        return count >= desiredMin && count <= desiredMax;
      });
      const targetMiddle = (desiredMin + desiredMax) / 2;
      const nearestDistance = visibleUnopened.reduce(
        (best, symbol) => Math.min(best, Math.abs((visibleCounts.get(symbol) ?? 0) - targetMiddle)),
        Number.POSITIVE_INFINITY,
      );
      const nearestVisible = visibleUnopened.filter(
        (symbol) => Math.abs((visibleCounts.get(symbol) ?? 0) - targetMiddle) === nearestDistance,
      );
      const unopened = ALLAH_EYE_SYMBOL_ROSTER.filter(
        (symbol) => !state.eyeSlots.includes(symbol),
      );
      const selected = pick(
        inTargetRange.length
          ? inTargetRange
          : nearestVisible.length
            ? nearestVisible
            : unopened.length
              ? unopened
              : ALLAH_EYE_SYMBOL_ROSTER,
        random,
      );
      emit("eye-wake", [position], { variant: eye.variant });
      emit("eye-look-left", [position], { variant: eye.variant, targetColumn: Math.max(0, position.column - 1) });
      emit("eye-look-right", [position], { variant: eye.variant, targetColumn: Math.min(ALLAH_REELS - 1, position.column + 1) });
      emit("eye-look-up", [position], { variant: eye.variant, targetColumn: position.column });
      emit("eye-look-down-grid", [position], { variant: eye.variant, targetColumn: position.column });
      if (!state.eyeSlots.includes(selected)) state.eyeSlots = [...state.eyeSlots, selected];
      emit("eye-slot-fill", [position], {
        variant: eye.variant,
        selected,
        slot: ALLAH_EYE_SYMBOL_ROSTER.indexOf(selected),
      });

      const seeded = seedEyeMatches(selected, position);
      revealMysteries(seeded, "eye", { selected, variant: eye.variant });
      captureLineWins();
    }

    const multipliers = positionsOf(grid, (cell) => cell.kind === "multiplier" && !processed.has(cell.id));
    for (const position of multipliers) {
      const multiplier = eventPayloadCell(grid, position);
      if (multiplier.kind !== "multiplier") continue;
      processed.add(multiplier.id);
      const affected = readingOrder(positionsOf(
        grid,
        (cell) => cell.kind === "coin" || (cell.kind === "collector" && (collectorValues[cell.id] ?? 0) > 0),
      ).filter(
        (cell) => Math.abs(cell.row - position.row) <= 1 && Math.abs(cell.column - position.column) <= 1,
      ));
      if (!affected.length) {
        revealedFeatureIds.add(multiplier.id);
        emit("board-multiplier-reveal", [position], {
          value: multiplier.value,
          affected: 0,
          dormant: true,
        });
        continue;
      }
      emit("board-multiplier-anticipation", [position], {
        affected: affected.length,
      });
      revealedFeatureIds.add(multiplier.id);
      emit("board-multiplier-reveal", [position], {
        value: multiplier.value,
        affected: affected.length,
      });
      emit("board-multiplier-wake", [position], {
        value: multiplier.value,
        affected: affected.length,
      });
      for (let index = 0; index < affected.length; index += 1) {
        const target = affected[index];
        const targetCell = eventPayloadCell(grid, target);
        const before = targetCell.kind === "coin"
          ? targetCell.value
          : collectorValues[targetCell.id] ?? 0;
        emit("board-multiplier-cast", [position, target], {
          value: multiplier.value,
          before,
          index: index + 1,
          total: affected.length,
          targetKind: targetCell.kind,
        });
        const after = Math.min(
          valueCapX,
          roundX(before * multiplier.value),
        );
        if (targetCell.kind === "coin") {
          targetCell.value = after;
          targetCell.tier = allahCoinTierForValue(after);
        } else if (targetCell.kind === "collector") {
          collectorValues[targetCell.id] = after;
        }
        emit("board-multiplier-apply", [target], {
          value: multiplier.value,
          before,
          after,
          index: index + 1,
          total: affected.length,
          targetKind: targetCell.kind,
        });
      }
      emit("board-multiplier-wave", [position, ...affected], {
        value: multiplier.value,
        affected: affected.length,
      });
    }

    const upgraders = positionsOf(grid, (cell) => cell.kind === "upgrader" && !processed.has(cell.id));
    for (const position of upgraders) activateUpgrader(position);

    const redrops = positionsOf(grid, (cell) => cell.kind === "redrop" && !processed.has(cell.id));
    for (const position of redrops) {
      processed.add(eventPayloadCell(grid, position).id);
      const cleared = positionsOf(grid, (cell) => cell.kind === "symbol");
      emit("redrop-clear", cleared, { count: cleared.length });
      for (const target of cleared)
        grid[target.row][target.column] = { id: `${runId}-empty-${serial.value++}`, kind: "empty" };
      for (let column = 0; column < ALLAH_REELS; column += 1) {
        const columnTargets = cleared.filter((target) => target.column === column);
        for (const target of columnTargets)
          grid[target.row][target.column] = createAllowedFeatureCell(
            `${runId}-redrop-${serial.value++}`,
            false,
            mode === "base" ? "enhancer" : mode,
          );
        if (columnTargets.length)
          emit("redrop-fall", columnTargets, { sourceRow: -1, column });
      }
      emit("feature-respin", cleared, { source: "redrop", cycle: featureCycles });
      captureLineWins();
    }

    const keys = readingOrder(positionsOf(
      grid,
      (cell) => cell.kind === "global-key" && !processed.has(cell.id),
    ));
    for (const position of keys) {
      const key = eventPayloadCell(grid, position);
      processed.add(key.id);
      globalKeyRounds += 1;
      const side = boundedRandom(random) < 0.5 ? "might" : "mercy";
      emit("key-flight", [position], { side, keyRound: globalKeyRounds });
      consumedFeatureIds.add(key.id);
      emit("wheel-anticipation", [], { side, keyRound: globalKeyRounds });
      emit("key-vault-open", [], { side, slots: 3, keyRound: globalKeyRounds });
      let roundTotal = 0;
      for (let slot = 0; slot < 3; slot += 1) {
        emit("key-slot-spin", [], { side, slot, keyRound: globalKeyRounds });
        const value = pickGlobalSlotValue(random);
        roundTotal += value;
        globalKeySlots[slot] = (globalKeySlots[slot] ?? 0) + value;
        emit("key-slot-lock", [], {
          side,
          slot,
          value,
          total: globalKeySlots[slot] ?? value,
          keyRound: globalKeyRounds,
        });
      }
      const keyTotal = globalKeySlots.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      emit("wheel-spin", [], {
        side,
        value: roundTotal,
        total: keyTotal,
        keyRound: globalKeyRounds,
      });
      const previousGlobalMultiplier = state.globalMultiplier;
      const nextGlobalMultiplier = Math.min(
        Math.max(1, tuning.globalMultiplierCap),
        Math.max(1, keyTotal),
      );
      emit("global-merge", [], {
        before: previousGlobalMultiplier,
        value: nextGlobalMultiplier,
        added: roundTotal,
        total: keyTotal,
        side,
        keyRound: globalKeyRounds,
      });
      state.globalMultiplier = nextGlobalMultiplier;
      emit("global-merge-apply", [], {
        before: previousGlobalMultiplier,
        value: state.globalMultiplier,
        added: roundTotal,
        total: keyTotal,
        side,
        keyRound: globalKeyRounds,
      });
    }

    // Collector resolves last. Nested Mystery/Eye results must finish first;
    // otherwise a bag could replace a feature that has not acted yet.
    const unreadNonCollectors = positionsOf(
      grid,
      (cell) =>
        ["mystery", "eye", "multiplier", "upgrader", "redrop", "global-key"].includes(cell.kind) &&
        !processed.has(cell.id),
    );
    if (unreadNonCollectors.length) continue;

    // Mystery-born action symbols are temporary. After the whole reveal board
    // has been read and each action is complete, they roll once more into a
    // coin. Coin and Collector/Super Collector are stable token outcomes.
    // Scatter and Max Coin retain their separate settlement behaviour.
    const spentModifiers = readingOrder(positionsOf(
      grid,
      (cell) =>
        cell.fromMystery === true &&
        ["eye", "multiplier", "upgrader", "redrop", "global-key"].includes(cell.kind) &&
        processed.has(cell.id),
    ));
    for (let index = 0; index < spentModifiers.length; index += 1) {
      const position = spentModifiers[index];
      const modifier = eventPayloadCell(grid, position);
      emit("modifier-coin-roll", [position], {
        previousKind: modifier.kind,
        index: index + 1,
        total: spentModifiers.length,
      });
      const coin = pickCoin(
        `${runId}-spent-modifier-coin-${serial.value++}`,
        state.minimumCoinTier,
        random,
        tuning,
      );
      grid[position.row][position.column] = { ...coin, fromMystery: true };
      emit("modifier-coin-land", [position], {
        previousKind: modifier.kind,
        tier: coin.kind === "coin" ? coin.tier : "bronze",
        value: coin.kind === "coin" ? coin.value : 0,
        index: index + 1,
        total: spentModifiers.length,
      });
    }

    const collectors = readingOrder(positionsOf(
      grid,
      (cell) => cell.kind === "collector" && !processed.has(cell.id),
    ));
    for (const position of collectors) {
      const collector = eventPayloadCell(grid, position);
      if (collector.kind !== "collector") continue;
      const pass = collectorPasses.get(collector.id) ?? 0;
      const totalPasses = collector.super ? 2 : 1;
      if (pass > 0) emit("super-collector-reset", [position], { collectorId: collector.id, pass: pass + 1 });
      emit("collector-wake", [position], { collectorId: collector.id, super: collector.super, pass: pass + 1 });
      const coins = positionsOf(grid, (cell) => cell.kind === "coin");
      const otherCollectors = positionsOf(
        grid,
        (cell) => cell.kind === "collector" && cell.id !== collector.id && (collectorValues[cell.id] ?? 0) > 0,
      );
      const sources = readingOrder([...coins, ...otherCollectors]);
      collectorValues[collector.id] = collectorValues[collector.id] ?? 0;
      let passValue = 0;
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        const sourceCell = eventPayloadCell(grid, source);
        const sourceValue = sourceCell.kind === "coin"
          ? sourceCell.value
          : collectorValues[sourceCell.id] ?? 0;
        if (sourceCell.kind === "coin") collectedCoinIds.add(sourceCell.id);
        emit("coin-flight", [source, position], {
          collectorId: collector.id,
          pass: pass + 1,
          value: sourceValue,
          index: index + 1,
          total: sources.length,
          sourceKind: sourceCell.kind,
        });
        passValue = Math.min(valueCapX, roundX(passValue + sourceValue));
        collectorValues[collector.id] = Math.min(
          valueCapX,
          roundX((collectorValues[collector.id] ?? 0) + sourceValue),
        );
        emit("collector-merge", [position], {
          collectorId: collector.id,
          pass: pass + 1,
          added: sourceValue,
          total: collectorValues[collector.id],
          index: index + 1,
          sources: sources.length,
        });
      }
      emit("collector-merge", [...otherCollectors, position], {
        collectorId: collector.id,
        pass: pass + 1,
        total: collectorValues[collector.id],
        passValue,
        complete: true,
      });
      collectorPasses.set(collector.id, pass + 1);
      if (pass + 1 >= totalPasses) processed.add(collector.id);

      if (featureCycles < maxCycles) {
        // Collector restarts only the positions that belong to the active
        // Mystery feature. Ordinary reel symbols and direct reel coins stay
        // untouched; on a full-board FU spin every revealed position naturally
        // has this origin, while an Eye feature rerolls only its own targets.
        const refillCandidates = readingOrder(positionsOf(
          grid,
          (cell) => cell.fromMystery === true && cell.kind !== "collector",
        ));
        for (const target of refillCandidates)
          grid[target.row][target.column] = {
            id: `${runId}-collector-mystery-${serial.value++}`,
            kind: "mystery",
            source: "collector",
          };
        if (refillCandidates.length) {
          emit("mystery-seed", refillCandidates, {
            source: collector.super ? "super-collector" : "collector",
            pass: pass + 1,
            count: refillCandidates.length,
          });
          revealMysteries(
            refillCandidates,
            collector.super ? "super-collector" : "collector",
            { pass: pass + 1 },
          );
          emit("feature-respin", refillCandidates, { source: "collector", cycle: featureCycles });
          captureLineWins();
        }
      }
    }
  }

  const scatterPositions = readingOrder(positionsOf(grid, (cell) => cell.kind === "scatter"));
  scatterPositions.forEach((position, index) => emit("scatter-lock", [position], {
    count: scatterPositions.length,
    index: index + 1,
  }));
  const maxCoinPositions = readingOrder(positionsOf(grid, (cell) => cell.kind === "max-coin"));
  if (maxCoinPositions.length) emit("max-coin-award", maxCoinPositions, {
    payout: roundMoney(Math.max(0, request.wager) * valueCapX),
  });
  const naturalTier = scatterPatternTier(grid);
  let triggeredBonus = naturalTier;
  let bonusUpgrade: AllahBonusTier | undefined;
  if (request.bonus && scatterPositions.length) {
    bonusUpgrade = nextBonusTier(request.bonus.tier);
    triggeredBonus = undefined;
    if (bonusUpgrade === "mythic") state.mythicUpgraderPending = true;
    state.persistentEye = bonusUpgrade === "mythic" ? "emerald" : "gold";
    emit("bonus-upgrade", scatterPositions, { from: request.bonus.tier, to: bonusUpgrade });
  } else if (naturalTier) {
    if (naturalTier !== "free") state.persistentEye = naturalTier === "mythic" ? "emerald" : "gold";
    state.mythicUpgraderPending = naturalTier === "mythic";
    emit("bonus-portal", scatterPositions, { tier: naturalTier, spins: tuning.bonusSpins });
  }

  const lineWinX = roundX(
    lineWins.reduce((sum, win) => sum + win.multiplier, 0) * tuning.linePayoutScale * effectivePayoutScale,
  );
  // A Collector extends the feature; it is not the switch that makes coins
  // payable. Coins swept on an earlier board live in collectorValues, while
  // coins left on the final board that were never swept settle directly. A
  // direct reel coin may remain visible when only active Mystery positions
  // respin, so collectedCoinIds keeps that already-awarded value from being
  // counted again at settlement.
  const coinWinX = Math.min(
    valueCapX,
    roundX(
      grid.flat().reduce(
        (sum, cell) => sum + (cell.kind === "coin" && !collectedCoinIds.has(cell.id) ? cell.value : 0),
        0,
      ) * tuning.coinPayoutScale * effectivePayoutScale,
    ),
  );
  const collectorWinX = Math.min(
    valueCapX,
    roundX(
      Object.values(collectorValues).reduce((sum, value) => sum + value, 0) *
        tuning.coinPayoutScale * effectivePayoutScale,
    ),
  );
  const maxCoin =
    positionsOf(initialGrid, (cell) => cell.kind === "max-coin").length > 0 ||
    positionsOf(grid, (cell) => cell.kind === "max-coin").length > 0 ||
    events.some(
      (event) =>
        event.type === "mystery-reveal" && event.payload.revealedKind === "max-coin",
    );
  const grossMultiplier = maxCoin
    ? valueCapX
    : Math.min(
        sceneCapX,
        (lineWinX + coinWinX + collectorWinX) * state.globalMultiplier,
      );
  const payout = roundMoney(Math.max(0, request.wager) * grossMultiplier);
  // The money calculation above already applies the global factor exactly once.
  // Reveal that same factor row by row without modifying payable grid values.
  // Swept coins are represented by their collector, not awarded a second time.
  if (state.globalMultiplier > 1 && !maxCoin) {
    for (let row = 0; row < ALLAH_ROWS; row += 1) {
      const cells = grid[row].flatMap((cell, column) =>
        (cell.kind === "coin" && !collectedCoinIds.has(cell.id) && cell.value > 0) ||
        (cell.kind === "collector" && (collectorValues[cell.id] ?? 0) > 0)
          ? [{ row, column }] : [],
      );
      if (!cells.length) continue;
      const before = roundX(cells.reduce((sum, { column }) => {
        const cell = grid[row][column];
        return sum + (cell.kind === "coin" ? cell.value : collectorValues[cell.id] ?? 0);
      }, 0));
      const payload = { row, multiplier: state.globalMultiplier, before, after: roundX(before * state.globalMultiplier) };
      emit("global-row-charge", cells, payload);
      for (const { column } of cells) {
        const cell = grid[row][column];
        const value = cell.kind === "coin" ? cell.value : collectorValues[cell.id] ?? 0;
        globalAppliedValues[cell.id] = roundX(value * state.globalMultiplier);
      }
      emit("global-row-apply", cells, payload);
    }
  }
  if (state.globalMultiplier > 1 && !maxCoin) {
    const baseMultiplier = roundX(lineWinX + coinWinX + collectorWinX);
    emit("global-final", [], {
      baseMultiplier,
      basePayout: roundMoney(Math.max(0, request.wager) * baseMultiplier),
      multiplier: state.globalMultiplier,
      finalPayout: payout,
    });
  }
  emit("payout-count", [], {
    lineWinX,
    coinWinX,
    collectorWinX,
    globalMultiplier: state.globalMultiplier,
    payoutDisplayScale: effectivePayoutScale,
    grossMultiplier,
  });
  if (grossMultiplier >= 5) {
    const tier = grossMultiplier >= 1_000
      ? "divine"
      : grossMultiplier >= 500
        ? "insane"
        : grossMultiplier >= 100
          ? "epic"
          : grossMultiplier >= 25
            ? "great"
            : "nice";
    emit("win-tier", [], { tier, grossMultiplier, payout });
  }
  emit("settlement", [], { payout, grossMultiplier, maxWin: grossMultiplier >= valueCapX });
  emit("return-idle");

  const nextBonus = request.bonus
    ? {
        ...request.bonus,
        tier: bonusUpgrade ?? request.bonus.tier,
        remaining: Math.max(0, request.bonus.remaining - 1),
        totalSpins: request.bonus.totalSpins + 1,
        totalPayout: roundMoney(request.bonus.totalPayout + payout),
      }
    : undefined;

  if (!request.bonus && !triggeredBonus) {
    state.eyeSlots = [];
    state.persistentEye = undefined;
    state.mythicUpgraderPending = false;
  }

  return {
    runId,
    mode,
    scene,
    initialGrid,
    finalGrid: grid,
    events,
    lineWins,
    lineWinX,
    coinWinX,
    collectorWinX,
    globalMultiplier: state.globalMultiplier,
    grossMultiplier,
    payoutDisplayScale: effectivePayoutScale,
    payout,
    maxWin: grossMultiplier >= valueCapX,
    scatterCount: scatterPositions.length,
    triggeredBonus,
    bonusUpgrade,
    nextBonus,
    persistent: state,
    collectorValues,
    globalAppliedValues,
    globalKeySlots,
    featureCycles,
  };
}

/** Shared live/lab boundary: only bonus eye state survives a spin. */
export function prepareAllahSpinPersistent(
  persistent: AllahPersistentState,
  bonus?: AllahBonusState,
): AllahPersistentState {
  return {
    ...persistent,
    minimumCoinTier: 0,
    globalMultiplier: 1,
    eyeSlots: bonus && persistent.persistentEye ? [...persistent.eyeSlots] : [],
    persistentEye: bonus ? persistent.persistentEye : undefined,
  };
}
import {
  DEFAULT_ALLAH_TUNING,
  type AllahSceneId,
  type AllahTuningSettings,
} from "../../data/casino-admin";
