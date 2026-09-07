import {
  getSharedCasinoMeta,
  setCasinoMeta,
  type CasinoGameId,
} from "./casino-database";
import {
  DEFAULT_GAME_MUSIC,
  type GameMusicSettings,
} from "../audio/casino-music";

export type AdminGameSettings = {
  id: CasinoGameId;
  name: string;
  room: string;
  enabled: boolean;
  maintenanceMessage: string;
  minBet: number;
  defaultBet: number;
  targetRtp: number;
  openingPayoutBoost?: number;
  volatility: "düşük" | "orta" | "yüksek" | "çok yüksek";
  autoplay: boolean;
  aiHost: boolean;
  sound: boolean;
  music: GameMusicSettings;
  features: Record<string, boolean>;
  slot?: SlotTuningSettings;
  crash?: CrashTuningSettings;
  mines?: MinesTuningSettings;
  countdown?: CountdownTuningSettings;
  plinko?: PlinkoTuningSettings;
  allah?: AllahTuningSettings;
  mineDrop?: MineDropTuningSettings;
};

export type MineDropTool = "bronze" | "iron" | "gold" | "diamond" | "obsidian";
export type MineDropBlock =
  | "dirt"
  | "stone"
  | "blast"
  | "redstone"
  | "mystery"
  | "gold"
  | "diamond"
  | "obsidian";
export type MineDropMode = "base" | "extra" | "super" | "diamond" | "obsidian";
export type MineDropReelContext = MineDropMode | "bonus-block" | "bonus-super" | "bonus-epic";

export type MineDropTuningSettings = {
  profileName: string;
  maxWinX: number;
  bonusSpins: number;
  modeCosts: Record<MineDropMode, number>;
  bonusCosts: Record<"block" | "super" | "mystery", number>;
  toolDurability: Record<MineDropTool, number>;
  blockRules: Record<MineDropBlock, { hp: number; payoutX: number }>;
  symbolWeights: Record<MineDropReelContext, {
    tool: number;
    eye: number;
    tnt: number;
    book: number;
    maxBook: number;
    empty: number;
  }>;
  toolWeights: Record<MineDropReelContext, Record<MineDropTool, number>>;
  layerWeights: Array<Record<MineDropBlock, number>>;
  mysteryValueWeights: Record<string, number>;
  chestValueWeights: Record<string, number>;
  mysteryOutcomeWeights: Record<"none" | "super" | "epic", number>;
  surfaceProfile: {
    minOpenRows: number;
    maxOpenRows: number;
    maxStep: number;
  };
  premiumOpenRows: Record<"diamond" | "obsidian", number>;
  payoutScales: Record<MineDropMode | "bonus-block" | "bonus-super" | "bonus-epic" | "mystery", number>;
  animation: {
    reelMs: number;
    dropMs: number;
    bounceMs: number;
    hitMs: number;
    breakMs: number;
    blastMs: number;
    chestMs: number;
    countUpMs: number;
    turboScale: number;
  };
};

const mineToolWeights = (
  patch: Partial<Record<MineDropTool, number>> = {},
): Record<MineDropTool, number> => ({
  bronze: 47,
  iron: 29,
  gold: 15,
  diamond: 7,
  obsidian: 2,
  ...patch,
});

const mineSymbolWeights = (
  patch: Partial<MineDropTuningSettings["symbolWeights"][MineDropReelContext]> = {},
) => ({ tool: 10.9, eye: 2, tnt: 2, book: 1, maxBook: 0.15, empty: 83.95, ...patch });

export const DEFAULT_MINE_DROP_TUNING: MineDropTuningSettings = {
  profileName: "baykus-madeni-v3-session-chests-balanced",
  maxWinX: 50_000,
  bonusSpins: 4,
  modeCosts: { base: 1, extra: 3, super: 6, diamond: 250, obsidian: 1_000 },
  bonusCosts: { block: 100, super: 300, mystery: 500 },
  toolDurability: { bronze: 1, iron: 2, gold: 3, diamond: 5, obsidian: 7 },
  blockRules: {
    dirt: { hp: 1, payoutX: 0 }, stone: { hp: 2, payoutX: 0.1 },
    blast: { hp: 2, payoutX: 0.5 }, redstone: { hp: 4, payoutX: 1 },
    mystery: { hp: 4, payoutX: 2.5 }, gold: { hp: 5, payoutX: 3 },
    diamond: { hp: 6, payoutX: 5 }, obsidian: { hp: 7, payoutX: 25 },
  },
  symbolWeights: {
    base: mineSymbolWeights({ eye: 1.6, empty: 84.35 }),
    extra: mineSymbolWeights({ eye: 3.1, empty: 82.85 }),
    super: mineSymbolWeights({ eye: 3.05, empty: 82.9 }),
    diamond: mineSymbolWeights({ tool: 65, eye: 2, tnt: 8, book: 5, maxBook: 2, empty: 18 }),
    obsidian: mineSymbolWeights({ tool: 31, eye: 2, tnt: 8, book: 5, maxBook: 2, empty: 52 }),
    "bonus-block": mineSymbolWeights({ tool: 32.7, eye: 4, tnt: 2, book: 0.3, maxBook: 0.02, empty: 60.98 }),
    "bonus-super": mineSymbolWeights({ tool: 29.7, eye: 4, tnt: 2, book: 0.3, maxBook: 0.02, empty: 63.98 }),
    "bonus-epic": mineSymbolWeights({ tool: 27, eye: 4, tnt: 2, book: 0.3, maxBook: 0.02, empty: 66.68 }),
  },
  toolWeights: {
    base: mineToolWeights(), extra: mineToolWeights(), super: mineToolWeights(),
    diamond: mineToolWeights({ bronze: 0, iron: 0, gold: 0, diamond: 85, obsidian: 15 }),
    obsidian: mineToolWeights({ bronze: 0, iron: 0, gold: 0, diamond: 0, obsidian: 100 }),
    "bonus-block": mineToolWeights(),
    "bonus-super": mineToolWeights({ bronze: 0, iron: 55, gold: 27, diamond: 13, obsidian: 5 }),
    "bonus-epic": mineToolWeights({ bronze: 0, iron: 0, gold: 55, diamond: 32, obsidian: 13 }),
  },
  layerWeights: [
    { dirt: 60, stone: 31, blast: 9, redstone: 0, mystery: 0, gold: 0, diamond: 0, obsidian: 0 },
    { dirt: 35, stone: 45, blast: 10, redstone: 10, mystery: 0, gold: 0, diamond: 0, obsidian: 0 },
    { dirt: 0, stone: 28, blast: 0, redstone: 42, mystery: 8, gold: 22, diamond: 0, obsidian: 0 },
    { dirt: 0, stone: 0, blast: 0, redstone: 30, mystery: 10, gold: 38, diamond: 22, obsidian: 0 },
    { dirt: 0, stone: 0, blast: 0, redstone: 0, mystery: 8, gold: 40, diamond: 37, obsidian: 15 },
    { dirt: 0, stone: 0, blast: 0, redstone: 0, mystery: 8, gold: 24, diamond: 36, obsidian: 32 },
  ],
  mysteryValueWeights: { "2.5": 34, "3": 24, "5": 17, "8": 10, "10": 7, "15": 4, "25": 2.5, "50": 1.2, "100": 0.3 },
  chestValueWeights: { "2": 30, "3": 24, "4": 18, "5": 12, "8": 7, "10": 5, "20": 2.8, "50": 1, "100": 0.2 },
  mysteryOutcomeWeights: { none: 20, super: 52, epic: 28 },
  surfaceProfile: { minOpenRows: 0, maxOpenRows: 2, maxStep: 1 },
  premiumOpenRows: { diamond: 2, obsidian: 4 },
  payoutScales: { base: 1, extra: 1, super: 1, diamond: 1, obsidian: 1, "bonus-block": 1, "bonus-super": 1, "bonus-epic": 1, mystery: 1 },
  animation: { reelMs: 1_080, dropMs: 560, bounceMs: 190, hitMs: 360, breakMs: 280, blastMs: 540, chestMs: 680, countUpMs: 720, turboScale: 0.24 },
};

export function migrateMineDropTuning(saved: MineDropTuningSettings | undefined) {
  if (!saved || saved.profileName !== "baykus-madeni-v2-drop-choreography-967") return saved;
  const legacyWeights: Partial<MineDropTuningSettings["symbolWeights"]> = {
    base: mineSymbolWeights(),
    extra: mineSymbolWeights({ eye: 3.5, empty: 82.45 }),
    super: mineSymbolWeights({ eye: 5, empty: 80.95 }),
    diamond: mineSymbolWeights({ tool: 72, eye: 2, tnt: 8, book: 5, maxBook: 2, empty: 11 }),
    obsidian: mineSymbolWeights({ tool: 72, eye: 2, tnt: 8, book: 5, maxBook: 2, empty: 11 }),
    "bonus-block": mineSymbolWeights({ tool: 38, eye: 4, tnt: 7, empty: 49.85 }),
    "bonus-super": mineSymbolWeights({ tool: 38, eye: 4, tnt: 7, empty: 49.85 }),
    "bonus-epic": mineSymbolWeights({ tool: 38, eye: 4, tnt: 7, empty: 49.85 }),
  };
  const symbolWeights = { ...saved.symbolWeights };
  for (const context of Object.keys(legacyWeights) as MineDropReelContext[]) {
    const old = legacyWeights[context]!;
    const current = symbolWeights[context];
    if (!current || Object.entries(old).every(([key, value]) => current[key as keyof typeof current] === value)) {
      symbolWeights[context] = { ...DEFAULT_MINE_DROP_TUNING.symbolWeights[context] };
    }
  }
  return { ...saved, profileName: DEFAULT_MINE_DROP_TUNING.profileName, symbolWeights };
}

export type AllahAdminMode =
  | "base"
  | "enhancer"
  | "degen"
  | "trickster"
  | "fate"
  | "bonus-buy"
  | "super-bonus-buy";

export type AllahAdminBonusTier = "free" | "super" | "legendary" | "mythic";

/** Live math and pacing controls for Allah'ın Lütfu. Percent values are 0..100. */
export type AllahTuningSettings = {
  profileName: string;
  maxWinX: number;
  linePayoutScale: number;
  coinPayoutScale: number;
  globalMultiplierCap: number;
  modeCosts: Record<AllahAdminMode, number>;
  reelEyeChancePercent: Record<AllahAdminMode, number>;
  reelScatterChancePercent: Record<AllahAdminMode, number>;
  bonusFeatureChancePercent: Record<AllahAdminBonusTier, number>;
  bonusScatterChancePercent: Record<AllahAdminBonusTier, number>;
  /** Extra weight applied only when Tricksterspin Mystery reveals roll an Eye. */
  tricksterMysteryEyeMultiplier: number;
  mysteryWeights: {
    coin: number;
    eye: number;
    collector: number;
    upgrader: number;
    redrop: number;
    multiplier: number;
    scatter: number;
    key: number;
    maxCoin: number;
  };
  fateMysteryWeights: AllahTuningSettings["mysteryWeights"];
  superCollectorChancePercent: number;
  coinTierDecay: number;
  eyeTargetsMin: number;
  eyeTargetsMax: number;
  bonusEyeTargetsMin: number;
  bonusEyeTargetsMax: number;
  maxFeatureCycles: number;
  fateMaxFeatureCycles: number;
  bonusSpins: number;
  normalAnimationScale: number;
  turboAnimationScale: number;
};

export const DEFAULT_ALLAH_TUNING: AllahTuningSettings = {
  profileName: "allahin-lutfu-v9-original-paced-features",
  maxWinX: 500_000,
  linePayoutScale: 1,
  coinPayoutScale: 1,
  globalMultiplierCap: 100,
  modeCosts: {
    base: 1,
    enhancer: 3,
    degen: 25,
    trickster: 75,
    fate: 5_000,
    "bonus-buy": 200,
    "super-bonus-buy": 1_000,
  },
  reelEyeChancePercent: {
    base: 0.85,
    enhancer: 1.35,
    degen: 5.5,
    trickster: 14,
    fate: 0,
    "bonus-buy": 0,
    "super-bonus-buy": 0,
  },
  reelScatterChancePercent: {
    base: 1.1,
    enhancer: 2.8,
    degen: 5.2,
    trickster: 2.4,
    fate: 0,
    "bonus-buy": 0,
    "super-bonus-buy": 0,
  },
  bonusFeatureChancePercent: {
    free: 5,
    super: 9,
    legendary: 14,
    mythic: 20,
  },
  bonusScatterChancePercent: {
    free: 0.35,
    super: 0.45,
    legendary: 0.55,
    mythic: 0.65,
  },
  tricksterMysteryEyeMultiplier: 3.5,
  mysteryWeights: {
    coin: 97.87,
    eye: 0.55,
    collector: 0.12,
    upgrader: 0.3,
    redrop: 0.2,
    multiplier: 0.4,
    scatter: 0.5,
    key: 0.06,
    maxCoin: 0.000002,
  },
  fateMysteryWeights: {
    coin: 93.73,
    eye: 0.8,
    collector: 0.54,
    upgrader: 1.82,
    redrop: 0.8,
    multiplier: 1.075,
    scatter: 1,
    key: 0.235,
    maxCoin: 0.000002,
  },
  superCollectorChancePercent: 5,
  coinTierDecay: 16,
  eyeTargetsMin: 4,
  eyeTargetsMax: 7,
  bonusEyeTargetsMin: 5,
  bonusEyeTargetsMax: 9,
  maxFeatureCycles: 12,
  fateMaxFeatureCycles: 18,
  bonusSpins: 10,
  normalAnimationScale: 1,
  turboAnimationScale: 0.28,
};

export type PlinkoTuningSettings = {
  profileName: string;
  minRows: number;
  maxRows: number;
  defaultRows: number;
  maxPayoutX: number;
  animationMs: number;
  maxConcurrentBalls: number;
};

export type CountdownTuningSettings = {
  profileName: string;
  stages: number;
  choiceWindowMs: number;
  finalChoiceWindowMs: number;
  normalRevealMs: number;
  turboRevealMs: number;
  maxPayoutX: number;
};

export type MinesTuningSettings = {
  profileName: string;
  defaultMines: number;
  maxMines: number;
  maxPayoutX: number;
  depthRows: number;
  normalRevealMs: number;
  turboRevealMs: number;
  remainingRevealMs: number;
  autoPickDelayMs: number;
};

export type CrashTuningSettings = {
  profileName: string;
  maxMultiplier: number;
  bettingWindowMs: number;
  resultWindowMs: number;
  curveMs: number;
  livePlayerCount: number;
};

export type SlotMathSettings = {
  profileName: string;
  maxWinX: number;
  payoutScale: number;
  bonusPayoutScale: number;
  baseScatterRate: number;
  bonusScatterRate: number;
  enhancedScatterRate: number;
  baseSpecialRate: number;
  bonusSpecialRate: number;
  basePrizeRate: number;
  bonusPrizeRate: number;
  rescueChancePercent: number;
  captainRescueChancePercent: number;
  cascadeAffinityPercent: number;
  maxCascades: number;
  minimumCluster: number;
  bonusBuyX: number;
  bonusBuySpins: number;
  enhancedBetCostX: number;
  retriggerSpins: number;
  maxBonusSessionSpins: number;
  stageAwardSpins: number;
  stageInterval: number;
  bonusSpins: Record<string, number>;
  stageMultipliers: number[];
};

export type SlotPresentationSettings = {
  anticipation: boolean;
  dynamicAudio: boolean;
  progressHud: boolean;
  collectionBook: boolean;
  normalStepMs: number;
  turboStepMs: number;
  teaseMs: number;
  multiplierRevealMs: number;
  countUpMs: number;
};

export type SlotProgressionSettings = {
  enabled: boolean;
  xpPerSpin: number;
  xpPerWin: number;
  xpPerBonus: number;
  xpPerSpecial: number;
  levelBaseXp: number;
};

export type SlotFlowSettings = {
  enabled: boolean;
  meaningfulWinX: number;
  drySpinSoftLimit: number;
  drySpinEventBoostPercent: number;
  hotWindowChancePercent: number;
  hotWindowSpins: number;
  hotWindowEventBoostPercent: number;
  bonusPressureStartSpins: number;
  bonusPressurePerSpinPercent: number;
  bonusPressureMaxPercent: number;
  retriggerTeasePercent: number;
  retriggerConversionPercent: number;
  lastBreathPercent: number;
  postFeatureEchoPercent: number;
};

export type SlotPotentialSettings = {
  enabled: boolean;
  exposureChancePercent: number;
  strongExposureChancePercent: number;
  teaserConversionPercent: number;
  maxUnpaidStrongTeases: number;
  displayOnlyMinItems: number;
  displayOnlyMaxItems: number;
  displayOnlyHighValueMinX: number;
  displayOnlyHighValueMaxX: number;
  nearMissChancePercent: number;
};

export type SlotTuningSettings = {
  math: SlotMathSettings;
  presentation: SlotPresentationSettings;
  progression: SlotProgressionSettings;
  flow: SlotFlowSettings;
  potential: SlotPotentialSettings;
  valueWeights: Record<string, number>;
};

export type CasinoAdminUser = {
  id: string;
  name: string;
  role: "owner" | "admin" | "player" | "guest";
  status: "active" | "suspended";
  balance: number;
  createdAt: string;
  lastSeenAt: string;
};

export type CasinoAdminSettings = {
  version: 1;
  updatedAt: string;
  general: {
    casinoName: string;
    environmentLabel: string;
    maintenanceMode: boolean;
    aiEnabled: boolean;
    masterSound: boolean;
    musicEnabled: boolean;
    musicVolume: number;
    responsiblePlayNotice: boolean;
    dataRetentionDays: number;
  };
  games: Record<CasinoGameId, AdminGameSettings>;
  users: CasinoAdminUser[];
};

const STORAGE_KEY = "pehlevan-royale-admin-v1";

const slotFlow = (
  patch: Partial<SlotFlowSettings> = {},
): SlotFlowSettings => ({
  enabled: true,
  meaningfulWinX: 1,
  drySpinSoftLimit: 6,
  drySpinEventBoostPercent: 24,
  hotWindowChancePercent: 3,
  hotWindowSpins: 4,
  hotWindowEventBoostPercent: 18,
  bonusPressureStartSpins: 100,
  bonusPressurePerSpinPercent: 0.15,
  bonusPressureMaxPercent: 20,
  retriggerTeasePercent: 20,
  retriggerConversionPercent: 1.5,
  lastBreathPercent: 1.5,
  postFeatureEchoPercent: 30,
  ...patch,
});

const slotPotential = (
  patch: Partial<SlotPotentialSettings> = {},
): SlotPotentialSettings => ({
  enabled: true,
  exposureChancePercent: 14,
  strongExposureChancePercent: 0.3,
  teaserConversionPercent: 10,
  maxUnpaidStrongTeases: 20,
  displayOnlyMinItems: 3,
  displayOnlyMaxItems: 6,
  displayOnlyHighValueMinX: 25,
  displayOnlyHighValueMaxX: 100,
  nearMissChancePercent: 12,
  ...patch,
});

const gameDefaults: Record<CasinoGameId, AdminGameSettings> = {
  blackjack: {
    id: "blackjack",
    name: "Blackjack",
    room: "Vera's Private Table",
    enabled: true,
    maintenanceMessage: "Masa kısa süreliğine hazırlanıyor.",
    minBet: 25,
    defaultBet: 100,
    targetRtp: 99.4,
    volatility: "orta",
    autoplay: false,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC.blackjack,
    features: { sideBets: true, insurance: true, split: true, surrender: true },
  },
  roulette: {
    id: "roulette",
    name: "Canlı Rulet",
    room: "Rouge Salon",
    enabled: true,
    maintenanceMessage: "Çark bakıma alındı.",
    minBet: 25,
    defaultBet: 100,
    targetRtp: 97.3,
    volatility: "yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC.roulette,
    features: {
      surge: true,
      callBets: true,
      neighbours: true,
      statistics: true,
    },
  },
  poker: {
    id: "poker",
    name: "Midnight Poker",
    room: "Leyla's Midnight Room",
    enabled: true,
    maintenanceMessage: "Poker masası kısa süreliğine hazırlanıyor.",
    minBet: 25,
    defaultBet: 100,
    targetRtp: 97.8,
    volatility: "yüksek",
    autoplay: false,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC.poker,
    features: {
      casinoHoldem: true,
      texasHoldem: true,
      botTable: true,
      aaBonus: true,
      onlineAdapter: true,
    },
  },
  "kiraz-77": {
    id: "kiraz-77",
    name: "Kiraz Kulübü 77",
    room: "Royal Reels District",
    enabled: true,
    maintenanceMessage: "Makine şu anda serviste.",
    minBet: 5,
    defaultBet: 25,
    targetRtp: 94.7,
    volatility: "orta",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["kiraz-77"],
    features: { hold: true, turbo: true, gamble: false },
    slot: {
      math: {
        profileName: "kiraz-klasik-v1",
        maxWinX: 1000,
        payoutScale: 1,
        bonusPayoutScale: 1,
        baseScatterRate: 0,
        bonusScatterRate: 0,
        enhancedScatterRate: 0,
        baseSpecialRate: 0,
        bonusSpecialRate: 0,
        basePrizeRate: 0,
        bonusPrizeRate: 0,
        rescueChancePercent: 0,
        captainRescueChancePercent: 0,
        cascadeAffinityPercent: 0,
        maxCascades: 1,
        minimumCluster: 3,
        bonusBuyX: 0,
        bonusBuySpins: 0,
        enhancedBetCostX: 1,
        retriggerSpins: 0,
        maxBonusSessionSpins: 0,
        stageAwardSpins: 0,
        stageInterval: 0,
        bonusSpins: {},
        stageMultipliers: [1],
      },
      presentation: {
        anticipation: true,
        dynamicAudio: true,
        progressHud: true,
        collectionBook: true,
        normalStepMs: 620,
        turboStepMs: 280,
        teaseMs: 900,
        multiplierRevealMs: 420,
        countUpMs: 1400,
      },
      progression: {
        enabled: true,
        xpPerSpin: 2,
        xpPerWin: 5,
        xpPerBonus: 30,
        xpPerSpecial: 8,
        levelBaseXp: 120,
      },
      flow: slotFlow({ enabled: false }),
      potential: slotPotential({ enabled: false }),
      valueWeights: {},
    },
  },
  "neon-kasasi": {
    id: "neon-kasasi",
    name: "Neon Kasası",
    room: "Royal Reels District",
    enabled: true,
    maintenanceMessage: "Kasa protokolü yeniden başlatılıyor.",
    minBet: 5,
    defaultBet: 25,
    targetRtp: 94.8,
    volatility: "çok yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["neon-kasasi"],
    features: {
      bonusBuy: true,
      miraBoost: true,
      turbo: true,
      winTheatre: true,
    },
    slot: {
      math: {
        profileName: "neon-v4-frequent-flow-948",
        maxWinX: 15000,
        payoutScale: 0.553,
        bonusPayoutScale: 0.477,
        baseScatterRate: 134,
        bonusScatterRate: 155,
        enhancedScatterRate: 160,
        baseSpecialRate: 55,
        bonusSpecialRate: 115,
        basePrizeRate: 0,
        bonusPrizeRate: 0,
        rescueChancePercent: 0,
        captainRescueChancePercent: 0,
        cascadeAffinityPercent: 25,
        maxCascades: 16,
        minimumCluster: 4,
        bonusBuyX: 58.5,
        bonusBuySpins: 15,
        enhancedBetCostX: 1.25,
        retriggerSpins: 5,
        maxBonusSessionSpins: 0,
        stageAwardSpins: 0,
        stageInterval: 0,
        bonusSpins: { "4": 15, "5": 20, "6": 25, "7": 30 },
        stageMultipliers: [1],
      },
      presentation: {
        anticipation: true,
        dynamicAudio: true,
        progressHud: true,
        collectionBook: true,
        normalStepMs: 700,
        turboStepMs: 430,
        teaseMs: 1250,
        multiplierRevealMs: 520,
        countUpMs: 1800,
      },
      progression: {
        enabled: true,
        xpPerSpin: 2,
        xpPerWin: 6,
        xpPerBonus: 60,
        xpPerSpecial: 12,
        levelBaseXp: 160,
      },
      flow: slotFlow({
        drySpinSoftLimit: 6,
        hotWindowChancePercent: 3.2,
        hotWindowEventBoostPercent: 20,
        bonusPressureStartSpins: 150,
        bonusPressurePerSpinPercent: 0.05,
        bonusPressureMaxPercent: 10,
        retriggerTeasePercent: 20,
        retriggerConversionPercent: 2,
        lastBreathPercent: 1.5,
      }),
      potential: slotPotential({
        exposureChancePercent: 17,
        strongExposureChancePercent: 0.25,
        teaserConversionPercent: 5,
        maxUnpaidStrongTeases: 50,
        displayOnlyMinItems: 2,
        displayOnlyMaxItems: 5,
        displayOnlyHighValueMinX: 50,
        displayOnlyHighValueMaxX: 500,
      }),
      valueWeights: {
        "2": 440000,
        "3": 285000,
        "4": 145000,
        "5": 80000,
        "10": 33000,
        "15": 11000,
        "25": 4500,
        "50": 1200,
        "100": 250,
        "500": 15,
        "1000": 1,
      },
    },
  },
  "kaptan-mercan": {
    id: "kaptan-mercan",
    name: "Kaptan Mercan",
    room: "Royal Reels · Gece Limanı",
    enabled: true,
    maintenanceMessage: "Tekne kısa süreliğine limanda.",
    minBet: 5,
    defaultBet: 25,
    targetRtp: 94.5,
    volatility: "yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["kaptan-mercan"],
    features: {
      bonusBuy: true,
      lighthouseAnte: true,
      hookRescue: true,
      fishermanCollect: true,
      turbo: true,
      winTheatre: true,
    },
    slot: {
      math: {
        profileName: "fisher-v7-base-collect-955",
        maxWinX: 10000,
        payoutScale: 1.122,
        bonusPayoutScale: 1.05,
        baseScatterRate: 1.45,
        bonusScatterRate: 0.75,
        enhancedScatterRate: 2.45,
        baseSpecialRate: 0.1,
        bonusSpecialRate: 0.52,
        basePrizeRate: 4.2,
        bonusPrizeRate: 1.65,
        rescueChancePercent: 14,
        captainRescueChancePercent: 48,
        cascadeAffinityPercent: 0,
        maxCascades: 1,
        minimumCluster: 3,
        bonusBuyX: 72.5,
        bonusBuySpins: 15,
        enhancedBetCostX: 1.5,
        retriggerSpins: 5,
        maxBonusSessionSpins: 60,
        stageAwardSpins: 10,
        stageInterval: 4,
        bonusSpins: { "3": 10, "4": 15, "5": 20 },
        stageMultipliers: [1, 2, 3, 10],
      },
      presentation: {
        anticipation: true,
        dynamicAudio: true,
        progressHud: true,
        collectionBook: true,
        normalStepMs: 310,
        turboStepMs: 105,
        teaseMs: 1350,
        multiplierRevealMs: 520,
        countUpMs: 1700,
      },
      progression: {
        enabled: true,
        xpPerSpin: 3,
        xpPerWin: 7,
        xpPerBonus: 55,
        xpPerSpecial: 10,
        levelBaseXp: 140,
      },
      flow: slotFlow({
        drySpinSoftLimit: 7,
        drySpinEventBoostPercent: 30,
        hotWindowChancePercent: 3.2,
        hotWindowSpins: 5,
        bonusPressureStartSpins: 85,
        retriggerTeasePercent: 24,
        retriggerConversionPercent: 2.5,
        lastBreathPercent: 2,
      }),
      potential: slotPotential({
        exposureChancePercent: 22,
        strongExposureChancePercent: 0.4,
        teaserConversionPercent: 12,
        displayOnlyMinItems: 5,
        displayOnlyMaxItems: 8,
        displayOnlyHighValueMinX: 50,
        displayOnlyHighValueMaxX: 250,
        nearMissChancePercent: 16,
      }),
      valueWeights: {
        "1": 40,
        "2": 30,
        "3": 20,
        "5": 15,
        "10": 7,
        "15": 3,
        "25": 1.5,
        "50": 0.5,
        "100": 0.1,
        "500": 0.01,
        "1000": 0.002,
        "2500": 0.0002,
      },
    },
  },
  "sekerhane-1024": {
    id: "sekerhane-1024",
    name: "Şekerhane 1024",
    room: "Royal Reels · Gece Şekerhanesi",
    enabled: true,
    maintenanceMessage: "Şekerhane vitrini hazırlanıyor.",
    minBet: 5,
    defaultBet: 25,
    targetRtp: 95.5,
    volatility: "çok yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["sekerhane-1024"],
    features: {
      bonusBuy: true,
      superBonusBuy: true,
      turbo: true,
      winTheatre: true,
      clusterReceipts: true,
      recipeBook: true,
    },
    slot: {
      math: {
        profileName: "sekerhane-v3-candy-flow-955",
        maxWinX: 25000,
        payoutScale: 0.9,
        bonusPayoutScale: 0.95,
        baseScatterRate: 72,
        bonusScatterRate: 95,
        enhancedScatterRate: 95,
        baseSpecialRate: 0,
        bonusSpecialRate: 0,
        basePrizeRate: 0,
        bonusPrizeRate: 0,
        rescueChancePercent: 0,
        captainRescueChancePercent: 0,
        cascadeAffinityPercent: 18,
        maxCascades: 20,
        minimumCluster: 5,
        bonusBuyX: 100,
        bonusBuySpins: 10,
        enhancedBetCostX: 500,
        retriggerSpins: 10,
        maxBonusSessionSpins: 0,
        stageAwardSpins: 0,
        stageInterval: 0,
        bonusSpins: { "3": 10, "4": 12, "5": 15, "6": 20, "7": 30 },
        stageMultipliers: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
      },
      presentation: {
        anticipation: true,
        dynamicAudio: true,
        progressHud: true,
        collectionBook: true,
        normalStepMs: 430,
        turboStepMs: 120,
        teaseMs: 1000,
        multiplierRevealMs: 360,
        countUpMs: 1500,
      },
      progression: {
        enabled: true,
        xpPerSpin: 3,
        xpPerWin: 7,
        xpPerBonus: 65,
        xpPerSpecial: 9,
        levelBaseXp: 150,
      },
      flow: slotFlow({
        drySpinSoftLimit: 5,
        drySpinEventBoostPercent: 28,
        hotWindowChancePercent: 4.5,
        hotWindowEventBoostPercent: 22,
        bonusPressureStartSpins: 95,
        retriggerTeasePercent: 20,
        retriggerConversionPercent: 1,
        lastBreathPercent: 1,
      }),
      potential: slotPotential({
        exposureChancePercent: 19,
        strongExposureChancePercent: 0.3,
        displayOnlyMinItems: 2,
        displayOnlyMaxItems: 5,
        displayOnlyHighValueMinX: 64,
        displayOnlyHighValueMaxX: 256,
        nearMissChancePercent: 18,
      }),
      valueWeights: {
        ayva: 700,
        nar: 850,
        menekse: 1050,
        "antep-yildizi": 1300,
        "gul-ayicigi": 1550,
        "safran-ayicigi": 1800,
        "visne-ayicigi": 2050,
      },
    },
  },
  "allahin-lutfu": {
    id: "allahin-lutfu",
    name: "Allah’ın Lütfu",
    room: "Royal Reels · Nur Divanı",
    enabled: true,
    maintenanceMessage: "Nur Divanı kısa süreliğine hazırlanıyor.",
    minBet: 1,
    defaultBet: 25,
    targetRtp: 96.7,
    volatility: "çok yüksek",
    autoplay: true,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC["allahin-lutfu"],
    features: {
      eyeMeter: true,
      collectors: true,
      globalMultiplier: true,
      bonusBuy: true,
      superBonusBuy: true,
      fateSpin: true,
      turbo: true,
      autoBet: true,
    },
    allah: DEFAULT_ALLAH_TUNING,
  },
  "baykus-madeni": {
    id: "baykus-madeni",
    name: "Baykuş Madeni",
    room: "Royal Reels · Gece Galerisi",
    enabled: true,
    maintenanceMessage: "Maden galerisi kısa süreliğine hazırlanıyor.",
    minBet: 1,
    defaultBet: 5,
    targetRtp: 96.7,
    volatility: "çok yüksek",
    autoplay: false,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC["baykus-madeni"],
    features: {
      blockMining: true,
      persistentBonus: true,
      bonusBuy: true,
      volatilitySwitch: true,
      turbo: true,
    },
    mineDrop: DEFAULT_MINE_DROP_TUNING,
  },
  "altin-rota": {
    id: "altin-rota",
    name: "Altın Rota",
    room: "Anlık Oyunlar · İstanbul Hava Hattı",
    enabled: true,
    maintenanceMessage: "Uçak kısa süreli bakıma alındı.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["altin-rota"],
    features: {
      dualBet: true,
      autoCashout: true,
      autoBet: true,
      liveFeed: true,
      provablyFair: true,
    },
    crash: {
      profileName: "altin-rota-v1-provably-fair-970",
      maxMultiplier: 10_000,
      bettingWindowMs: 7_000,
      resultWindowMs: 4_200,
      curveMs: 6_400,
      livePlayerCount: 24,
    },
  },
  limbo: {
    id: "limbo",
    name: "Owl Oracle Limbo",
    room: "Casino Originals · Kozmik Eşik",
    enabled: true,
    maintenanceMessage: "Oracle kısa süreliğine sessizde.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: true,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC.limbo,
    features: { targetMultiplier: true, winChance: true, provablyFair: true, instantReveal: true, autoBet: true },
  },
  "obsidyen-damari": {
    id: "obsidyen-damari",
    name: "Obsidyen Damarı",
    room: "Anlık Oyunlar · Yeraltı Araştırma İstasyonu",
    enabled: true,
    maintenanceMessage: "Kazı istasyonu kısa süreliğine kapatıldı.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["obsidyen-damari"],
    features: {
      freeDig: true,
      depthLine: true,
      turbo: true,
      autoPick: true,
      provablyFair: true,
      excavationLog: true,
      museum: true,
    },
    mines: {
      profileName: "obsidyen-mines-v1-hmac-970",
      defaultMines: 3,
      maxMines: 24,
      maxPayoutX: 1_000_000,
      depthRows: 12,
      normalRevealMs: 650,
      turboRevealMs: 300,
      remainingRevealMs: 90,
      autoPickDelayMs: 520,
    },
  },
  mines: {
    id: "mines",
    name: "Mines",
    room: "Casino Originals · Yasak Kasa",
    enabled: true,
    maintenanceMessage: "Mines kasası kısa süreliğine kapatıldı.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 99,
    volatility: "yüksek",
    autoplay: true,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC.mines,
    features: { fixedPicks: true, batchResolve: true, persistentSelection: true, provablyFair: true, autoBet: true, fullBoardReveal: true },
    mines: {
      profileName: "casino-mines-v2-hmac-990",
      defaultMines: 3,
      maxMines: 24,
      maxPayoutX: 1_000_000,
      depthRows: 12,
      normalRevealMs: 220,
      turboRevealMs: 120,
      remainingRevealMs: 60,
      autoPickDelayMs: 360,
    },
  },
  keno: {
    id: "keno",
    name: "Owl Star Map Keno",
    room: "Casino Originals · Yıldız Haritası",
    enabled: true,
    maintenanceMessage: "Astronomik mekanizma yeniden hizalanıyor.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: true,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC.keno,
    features: { riskProfiles: true, quickPick: true, paytable: true, provablyFair: true, autoBet: true, payoutPreview: true },
  },
  "son-on": {
    id: "son-on",
    name: "Son On",
    room: "Anlık Oyunlar · Galata Saat Kasası",
    enabled: true,
    maintenanceMessage: "Saat kasası yeniden kuruluyor.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: true,
    aiHost: true,
    sound: true,
    music: DEFAULT_GAME_MUSIC["son-on"],
    features: {
      riskProfiles: true,
      autoBank: true,
      timeoutChoice: true,
      provablyFair: true,
      checkpointDecision: true,
      turbo: true,
    },
    countdown: {
      profileName: "son-on-v1-hmac-970",
      stages: 10,
      choiceWindowMs: 6200,
      finalChoiceWindowMs: 2800,
      normalRevealMs: 720,
      turboRevealMs: 330,
      maxPayoutX: 1_000_000,
    },
  },
  plinko: {
    id: "plinko",
    name: "Pirinç Galeri Plinko",
    room: "Anlık Oyunlar · Pirinç Galeri",
    enabled: true,
    maintenanceMessage: "Plinko tahtası yeniden ayarlanıyor.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: true,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC.plinko,
    features: {
      riskProfiles: true,
      rowSelection: true,
      multiBall: true,
      autoBet: true,
      heatmap: true,
      provablyFair: true,
      winTheatre: true,
    },
    plinko: {
      profileName: "plinko-v1-hmac-970",
      minRows: 8,
      maxRows: 16,
      defaultRows: 12,
      maxPayoutX: 1_000,
      animationMs: 2_650,
      maxConcurrentBalls: 5,
    },
  },
  hilo: {
    id: "hilo",
    name: "Hilo",
    room: "Casino Originals · Yüksek / Düşük",
    enabled: true,
    maintenanceMessage: "Hilo destesi yeniden karılıyor.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 97,
    volatility: "yüksek",
    autoplay: false,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC.hilo,
    features: {
      higherLower: true,
      dynamicOdds: true,
      cashOut: true,
      provablyFair: true,
      exactShoeOdds: true,
    },
  },
  "yedi-cevher": {
    id: "yedi-cevher",
    name: "Yedi Cevher",
    room: "Casino Originals · Baykuşun Mührü",
    enabled: true,
    maintenanceMessage: "Cevher mühürleri yeniden parlatılıyor.",
    minBet: 5,
    defaultBet: 100,
    targetRtp: 98.29237817576009,
    volatility: "yüksek",
    autoplay: true,
    aiHost: false,
    sound: true,
    music: DEFAULT_GAME_MUSIC["yedi-cevher"],
    features: {
      sevenColors: true,
      fiveGemReveal: true,
      combinationPaytable: true,
      instantReveal: true,
      autoBet: true,
      provablyFair: true,
    },
  },
};

const ownerUser: CasinoAdminUser = {
  id: "muharrem-pehlevan",
  name: "Muharrem Pehlevan",
  role: "owner",
  status: "active",
  balance: 5000,
  createdAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
};

export const DEFAULT_ADMIN_SETTINGS: CasinoAdminSettings = {
  version: 1,
  updatedAt: new Date().toISOString(),
  general: {
    casinoName: "Pehlevan Royale",
    environmentLabel: "PRIVATE HOUSE",
    maintenanceMode: false,
    aiEnabled: true,
    masterSound: true,
    musicEnabled: true,
    musicVolume: 0.72,
    responsiblePlayNotice: true,
    dataRetentionDays: 365,
  },
  games: gameDefaults,
  users: [ownerUser],
};

function loadSettings(): CasinoAdminSettings {
  if (typeof localStorage === "undefined") return DEFAULT_ADMIN_SETTINGS;
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<CasinoAdminSettings> | null;
    if (!saved) return DEFAULT_ADMIN_SETTINGS;
    const games = Object.fromEntries(
      Object.entries(gameDefaults).map(([id, defaults]) => {
        const storedGame = saved.games?.[id as CasinoGameId];
        const current = storedGame?.mineDrop ? { ...storedGame, mineDrop: migrateMineDropTuning(storedGame.mineDrop) } : storedGame;
        const legacyFisherProfile =
          id === "kaptan-mercan" &&
          [
            "fisher-v3-engagement-balanced-945",
            "fisher-v4-mission-collect-947",
            "fisher-v5-queued-voyages-948",
            "fisher-v6-fish-forward-945",
          ].includes(current?.slot?.math.profileName ?? "");
        const legacyNeonProfile =
          id === "neon-kasasi" &&
          current?.slot?.math.profileName === "neon-v3-balanced-power-947";
        const legacySekerhaneProfile =
          id === "sekerhane-1024" &&
          ["sekerhane-v1-955", "sekerhane-v2-candy-flow-955"].includes(
            current?.slot?.math.profileName ?? "",
          );
        const legacySlotProfile = legacyFisherProfile || legacyNeonProfile || legacySekerhaneProfile;
        const legacySonOnMusic =
          id === "son-on" && current?.music?.trackId === "forget-me-not";
        const legacyAllahMusic =
          id === "allahin-lutfu" && current?.music?.trackId === "not-that-east";
        const legacyOriginalsMusic =
          ["limbo", "mines", "keno"].includes(id) &&
          current?.music?.source === "catalog" &&
          current?.music?.trackId === "planet-lounge";
        const legacyMinesProfile =
          id === "mines" &&
          current?.mines?.profileName === "casino-mines-v1-hmac-970";
        const currentSlot = legacyNeonProfile || legacySekerhaneProfile
          ? {
              ...(current?.slot ?? {}),
              math: { ...defaults.slot!.math },
              valueWeights: { ...defaults.slot!.valueWeights },
            }
          : legacyFisherProfile
            ? {
                ...(current?.slot ?? {}),
                math: {
                  ...(current?.slot?.math ?? defaults.slot!.math),
                  profileName: defaults.slot!.math.profileName,
                  payoutScale: defaults.slot!.math.payoutScale,
                  bonusPayoutScale: defaults.slot!.math.bonusPayoutScale,
                  baseSpecialRate: defaults.slot!.math.baseSpecialRate,
                  bonusSpecialRate: defaults.slot!.math.bonusSpecialRate,
                  bonusPrizeRate: defaults.slot!.math.bonusPrizeRate,
                  captainRescueChancePercent:
                    defaults.slot!.math.captainRescueChancePercent,
                },
              }
            : current?.slot;
        return [
          id,
          {
            ...defaults,
            ...current,
            targetRtp: legacySlotProfile || legacyMinesProfile
              ? defaults.targetRtp
              : (current?.targetRtp ?? defaults.targetRtp),
            music: legacySonOnMusic || legacyAllahMusic || legacyOriginalsMusic
              ? { ...defaults.music }
              : { ...defaults.music, ...current?.music },
            features: { ...defaults.features, ...current?.features },
            slot:
              defaults.slot && currentSlot
                ? {
                    ...defaults.slot,
                    ...currentSlot,
                    math: { ...defaults.slot.math, ...currentSlot.math },
                    presentation: {
                      ...defaults.slot.presentation,
                      ...currentSlot.presentation,
                    },
                    progression: {
                      ...defaults.slot.progression,
                      ...currentSlot.progression,
                    },
                    flow: {
                      ...defaults.slot.flow,
                      ...currentSlot.flow,
                    },
                    potential: {
                      ...defaults.slot.potential,
                      ...currentSlot.potential,
                    },
                    valueWeights: {
                      ...defaults.slot.valueWeights,
                      ...currentSlot.valueWeights,
                    },
                  }
                : defaults.slot,
            crash: defaults.crash
              ? { ...defaults.crash, ...current?.crash }
              : undefined,
            mines: defaults.mines
              ? legacyMinesProfile
                ? { ...defaults.mines }
                : { ...defaults.mines, ...current?.mines }
              : undefined,
            countdown: defaults.countdown
              ? { ...defaults.countdown, ...current?.countdown }
              : undefined,
            plinko: defaults.plinko
              ? { ...defaults.plinko, ...current?.plinko }
              : undefined,
            allah: defaults.allah
              ? {
                  ...defaults.allah,
                  ...current?.allah,
                  ...(["allahin-lutfu-v7-eye-mystery-reels", "allahin-lutfu-v8-chained-eye-multi-key"].includes(current?.allah?.profileName ?? "")
                    ? {
                        profileName: defaults.allah.profileName,
                        tricksterMysteryEyeMultiplier: defaults.allah.tricksterMysteryEyeMultiplier,
                        normalAnimationScale: defaults.allah.normalAnimationScale,
                      }
                    : {}),
                  modeCosts: { ...defaults.allah.modeCosts, ...current?.allah?.modeCosts },
                  reelEyeChancePercent: {
                    ...defaults.allah.reelEyeChancePercent,
                    ...current?.allah?.reelEyeChancePercent,
                  },
                  reelScatterChancePercent: {
                    ...defaults.allah.reelScatterChancePercent,
                    ...current?.allah?.reelScatterChancePercent,
                  },
                  bonusFeatureChancePercent: {
                    ...defaults.allah.bonusFeatureChancePercent,
                    ...current?.allah?.bonusFeatureChancePercent,
                  },
                  bonusScatterChancePercent: {
                    ...defaults.allah.bonusScatterChancePercent,
                    ...current?.allah?.bonusScatterChancePercent,
                  },
                  mysteryWeights: {
                    ...defaults.allah.mysteryWeights,
                    ...current?.allah?.mysteryWeights,
                    ...(["allahin-lutfu-v7-eye-mystery-reels", "allahin-lutfu-v8-chained-eye-multi-key"].includes(current?.allah?.profileName ?? "")
                      ? {
                          eye: defaults.allah.mysteryWeights.eye,
                          key: defaults.allah.mysteryWeights.key,
                        }
                      : {}),
                  },
                  fateMysteryWeights: {
                    ...defaults.allah.fateMysteryWeights,
                    ...current?.allah?.fateMysteryWeights,
                  },
                }
              : undefined,
            mineDrop: defaults.mineDrop
              ? {
                  ...defaults.mineDrop,
                  ...current?.mineDrop,
                  modeCosts: { ...defaults.mineDrop.modeCosts, ...current?.mineDrop?.modeCosts },
                  bonusCosts: { ...defaults.mineDrop.bonusCosts, ...current?.mineDrop?.bonusCosts },
                  toolDurability: { ...defaults.mineDrop.toolDurability, ...current?.mineDrop?.toolDurability },
                  blockRules: Object.fromEntries(Object.entries(defaults.mineDrop.blockRules).map(([key, rule]) => [key, { ...rule, ...current?.mineDrop?.blockRules?.[key as MineDropBlock] }])) as MineDropTuningSettings["blockRules"],
                  symbolWeights: Object.fromEntries(Object.entries(defaults.mineDrop.symbolWeights).map(([key, weights]) => [key, { ...weights, ...current?.mineDrop?.symbolWeights?.[key as MineDropReelContext] }])) as MineDropTuningSettings["symbolWeights"],
                  toolWeights: Object.fromEntries(Object.entries(defaults.mineDrop.toolWeights).map(([key, weights]) => [key, { ...weights, ...current?.mineDrop?.toolWeights?.[key as MineDropReelContext] }])) as MineDropTuningSettings["toolWeights"],
                  layerWeights: defaults.mineDrop.layerWeights.map((weights, index) => ({ ...weights, ...current?.mineDrop?.layerWeights?.[index] })),
                  mysteryValueWeights: { ...defaults.mineDrop.mysteryValueWeights, ...current?.mineDrop?.mysteryValueWeights },
                  chestValueWeights: { ...defaults.mineDrop.chestValueWeights, ...current?.mineDrop?.chestValueWeights },
                  mysteryOutcomeWeights: { ...defaults.mineDrop.mysteryOutcomeWeights, ...current?.mineDrop?.mysteryOutcomeWeights },
                  surfaceProfile: { ...defaults.mineDrop.surfaceProfile, ...current?.mineDrop?.surfaceProfile },
                  premiumOpenRows: { ...defaults.mineDrop.premiumOpenRows, ...current?.mineDrop?.premiumOpenRows },
                  payoutScales: { ...defaults.mineDrop.payoutScales, ...current?.mineDrop?.payoutScales },
                  animation: { ...defaults.mineDrop.animation, ...current?.mineDrop?.animation },
                }
              : undefined,
          },
        ];
      }),
    ) as Record<CasinoGameId, AdminGameSettings>;
    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...saved,
      general: { ...DEFAULT_ADMIN_SETTINGS.general, ...saved.general },
      games,
      users: saved.users?.length ? saved.users : DEFAULT_ADMIN_SETTINGS.users,
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

let currentSettings = loadSettings();
const listeners = new Set<() => void>();
const sharedAdminKey = "account:pehlivan:admin-settings-v1";
let sharedAdminReady = false;

function isOwnerBrowser() {
  return (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  );
}

export async function syncAdminSettings() {
  const shared = await getSharedCasinoMeta<CasinoAdminSettings>(sharedAdminKey);
  if (shared) {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shared));
    currentSettings = loadSettings();
    listeners.forEach((listener) => listener());
  } else if (isOwnerBrowser()) {
    await setCasinoMeta(sharedAdminKey, currentSettings);
  }
  sharedAdminReady = true;
}

function persist(next: CasinoAdminSettings) {
  currentSettings = { ...next, updatedAt: new Date().toISOString() };
  if (typeof localStorage !== "undefined")
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  if (sharedAdminReady)
    void setCasinoMeta(sharedAdminKey, currentSettings);
  listeners.forEach((listener) => listener());
}

export function getAdminSettings() {
  return currentSettings;
}

export function subscribeAdminSettings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateGeneralSettings(
  patch: Partial<CasinoAdminSettings["general"]>,
) {
  persist({
    ...currentSettings,
    general: { ...currentSettings.general, ...patch },
  });
}

export function updateAdminGame(
  game: CasinoGameId,
  patch: Partial<AdminGameSettings>,
) {
  const current = currentSettings.games[game];
  persist({
    ...currentSettings,
    games: {
      ...currentSettings.games,
      [game]: {
        ...current,
        ...patch,
        music: { ...current.music, ...patch.music },
        features: { ...current.features, ...patch.features },
        slot:
          current.slot && patch.slot
            ? {
                ...current.slot,
                ...patch.slot,
                math: { ...current.slot.math, ...patch.slot.math },
                presentation: {
                  ...current.slot.presentation,
                  ...patch.slot.presentation,
                },
                progression: {
                  ...current.slot.progression,
                  ...patch.slot.progression,
                },
                flow: {
                  ...current.slot.flow,
                  ...patch.slot.flow,
                },
                potential: {
                  ...current.slot.potential,
                  ...patch.slot.potential,
                },
                valueWeights: {
                  ...current.slot.valueWeights,
                  ...patch.slot.valueWeights,
                },
              }
            : current.slot,
        crash:
          current.crash && patch.crash
            ? { ...current.crash, ...patch.crash }
            : current.crash,
        mines:
          current.mines && patch.mines
            ? { ...current.mines, ...patch.mines }
            : current.mines,
        countdown:
          current.countdown && patch.countdown
            ? { ...current.countdown, ...patch.countdown }
            : current.countdown,
        allah:
          current.allah && patch.allah
            ? {
                ...current.allah,
                ...patch.allah,
                modeCosts: { ...current.allah.modeCosts, ...patch.allah.modeCosts },
                reelEyeChancePercent: {
                  ...current.allah.reelEyeChancePercent,
                  ...patch.allah.reelEyeChancePercent,
                },
                reelScatterChancePercent: {
                  ...current.allah.reelScatterChancePercent,
                  ...patch.allah.reelScatterChancePercent,
                },
                bonusFeatureChancePercent: {
                  ...current.allah.bonusFeatureChancePercent,
                  ...patch.allah.bonusFeatureChancePercent,
                },
                bonusScatterChancePercent: {
                  ...current.allah.bonusScatterChancePercent,
                  ...patch.allah.bonusScatterChancePercent,
                },
                mysteryWeights: { ...current.allah.mysteryWeights, ...patch.allah.mysteryWeights },
                fateMysteryWeights: {
                  ...current.allah.fateMysteryWeights,
                  ...patch.allah.fateMysteryWeights,
                },
              }
            : current.allah,
        mineDrop:
          current.mineDrop && patch.mineDrop
            ? {
                ...current.mineDrop,
                ...patch.mineDrop,
                modeCosts: { ...current.mineDrop.modeCosts, ...patch.mineDrop.modeCosts },
                bonusCosts: { ...current.mineDrop.bonusCosts, ...patch.mineDrop.bonusCosts },
                toolDurability: { ...current.mineDrop.toolDurability, ...patch.mineDrop.toolDurability },
                blockRules: { ...current.mineDrop.blockRules, ...patch.mineDrop.blockRules },
                symbolWeights: { ...current.mineDrop.symbolWeights, ...patch.mineDrop.symbolWeights },
                toolWeights: { ...current.mineDrop.toolWeights, ...patch.mineDrop.toolWeights },
                layerWeights: patch.mineDrop.layerWeights ?? current.mineDrop.layerWeights,
                mysteryValueWeights: { ...current.mineDrop.mysteryValueWeights, ...patch.mineDrop.mysteryValueWeights },
                chestValueWeights: { ...current.mineDrop.chestValueWeights, ...patch.mineDrop.chestValueWeights },
                mysteryOutcomeWeights: { ...current.mineDrop.mysteryOutcomeWeights, ...patch.mineDrop.mysteryOutcomeWeights },
                surfaceProfile: { ...current.mineDrop.surfaceProfile, ...patch.mineDrop.surfaceProfile },
                premiumOpenRows: { ...current.mineDrop.premiumOpenRows, ...patch.mineDrop.premiumOpenRows },
                payoutScales: { ...current.mineDrop.payoutScales, ...patch.mineDrop.payoutScales },
                animation: { ...current.mineDrop.animation, ...patch.mineDrop.animation },
              }
            : current.mineDrop,
      },
    },
  });
}

export type AllahPresetId = "kontrollu" | "dengeli" | "hareketli" | "kaotik";

export const ALLAH_PRESET_COPY: Record<AllahPresetId, { name: string; summary: string }> = {
  kontrollu: {
    name: "Kontrollü",
    summary: "Daha seyrek özellik, kısa zincir ve sıkı üst coin dağılımı.",
  },
  dengeli: {
    name: "Eğlenceli dengeli",
    summary: "Test edilen yaklaşık %96,7 hedefli varsayılan canlı profil.",
  },
  hareketli: {
    name: "Hareketli",
    summary: "Daha sık Göz, Mystery ve redrop; ödeme ölçeği kontrollü.",
  },
  kaotik: {
    name: "Kaotik vitrin",
    summary: "Sık ve uzun özel zincirler; yüksek seyrekliği korunur.",
  },
};

export function applyAdminAllahPreset(preset: AllahPresetId) {
  const base = DEFAULT_ALLAH_TUNING;
  const next: AllahTuningSettings = preset === "kontrollu"
    ? {
        ...base,
        profileName: "allahin-lutfu-v6-controlled",
        reelEyeChancePercent: { ...base.reelEyeChancePercent, base: 0.58, enhancer: 0.9 },
        reelScatterChancePercent: { ...base.reelScatterChancePercent, base: 0.85, enhancer: 2.1 },
        bonusFeatureChancePercent: { free: 3.8, super: 10, legendary: 18, mythic: 27 },
        eyeTargetsMin: 3,
        eyeTargetsMax: 5,
        maxFeatureCycles: 9,
        coinTierDecay: 19,
        normalAnimationScale: 1.1,
      }
    : preset === "hareketli"
      ? {
          ...base,
          profileName: "allahin-lutfu-v6-lively",
          coinPayoutScale: 0.78,
          reelEyeChancePercent: { ...base.reelEyeChancePercent, base: 1.15, enhancer: 1.8 },
          reelScatterChancePercent: { ...base.reelScatterChancePercent, base: 1.35, enhancer: 3.4 },
          bonusFeatureChancePercent: { free: 6.5, super: 15, legendary: 26, mythic: 38 },
          mysteryWeights: { ...base.mysteryWeights, eye: 0.38, collector: 0.17, redrop: 0.34 },
          eyeTargetsMin: 5,
          eyeTargetsMax: 8,
          maxFeatureCycles: 15,
          coinTierDecay: 19,
          normalAnimationScale: 0.95,
        }
      : preset === "kaotik"
        ? {
            ...base,
            profileName: "allahin-lutfu-v6-chaos-showcase",
            coinPayoutScale: 0.58,
            reelEyeChancePercent: { ...base.reelEyeChancePercent, base: 1.6, enhancer: 2.5, trickster: 18 },
            reelScatterChancePercent: { ...base.reelScatterChancePercent, base: 1.7, enhancer: 4.1, degen: 6.5 },
            bonusFeatureChancePercent: { free: 8.5, super: 20, legendary: 34, mythic: 48 },
            mysteryWeights: {
              ...base.mysteryWeights,
              eye: 0.55,
              collector: 0.24,
              upgrader: 0.46,
              redrop: 0.5,
              multiplier: 0.62,
              key: 0.085,
            },
            eyeTargetsMin: 6,
            eyeTargetsMax: 10,
            maxFeatureCycles: 19,
            fateMaxFeatureCycles: 24,
            coinTierDecay: 22,
            normalAnimationScale: 0.82,
          }
        : { ...base };
  updateAdminGame("allahin-lutfu", { allah: next });
}

export type SlotPresetId =
  | "ilk-giris"
  | "temkinli"
  | "dengeli"
  | "comert"
  | "gosterisli";

export const SLOT_PRESET_COPY: Record<
  SlotPresetId,
  { name: string; summary: string }
> = {
  "ilk-giris": {
    name: "İlk giriş · Açılış şöleni",
    summary: "Ödeme ölçeği +%15, bonus ödemesi +%10 ve daha hareketli akış. Seçili oyunda herkes için sonraki turlara uygulanır; otomatik süre sonu yoktur.",
  },
  temkinli: {
    name: "Temkinli ödeme",
    summary: "Ödeme ölçeğini düşürür; görünür potansiyeli korur.",
  },
  dengeli: {
    name: "Dengeli fabrika",
    summary: "Oyunun test edilmiş başlangıç değerlerine döner.",
  },
  comert: {
    name: "Cömert akış",
    summary: "Gerçek ödeme, sıcak pencere ve bonus baskısını yükseltir.",
  },
  gosterisli: {
    name: "Gösterişli vitrin",
    summary: "Ödemeyi korur; yüksek değer ve yakın sonuç görünümünü artırır.",
  },
};

export function applyAdminSlotPreset(
  game: CasinoGameId,
  preset: SlotPresetId,
) {
  const defaults = gameDefaults[game];
  if (!defaults.slot) return;
  const base = defaults.slot;
  const payoutFactor = preset === "ilk-giris" ? 1.15 : preset === "temkinli" ? 0.9 : preset === "comert" ? 1.1 : 1;
  const bonusFactor = preset === "ilk-giris" ? 1.1 : preset === "temkinli" ? 0.92 : preset === "comert" ? 1.07 : 1;
  const flowFactor = preset === "ilk-giris" ? 1.4 : preset === "comert" ? 1.3 : preset === "temkinli" ? 0.82 : 1;
  const spectacle = preset === "gosterisli";
  updateAdminGame(game, {
    targetRtp:
      preset === "temkinli"
        ? Math.max(1, defaults.targetRtp - 2)
        : preset === "comert"
          ? Math.min(100, defaults.targetRtp + 1.5)
          : defaults.targetRtp,
    slot: {
      ...base,
      math: {
        ...base.math,
        profileName: `${base.math.profileName}-${preset}`,
        payoutScale: Number((base.math.payoutScale * payoutFactor).toFixed(4)),
        bonusPayoutScale: Number(
          (base.math.bonusPayoutScale * bonusFactor).toFixed(4),
        ),
      },
      flow: {
        ...base.flow,
        drySpinEventBoostPercent: Number(
          (base.flow.drySpinEventBoostPercent * flowFactor).toFixed(2),
        ),
        hotWindowChancePercent: Number(
          (base.flow.hotWindowChancePercent * flowFactor).toFixed(2),
        ),
        bonusPressurePerSpinPercent: Number(
          (base.flow.bonusPressurePerSpinPercent * flowFactor).toFixed(3),
        ),
      },
      potential: spectacle
        ? {
            ...base.potential,
            exposureChancePercent: Math.min(
              100,
              base.potential.exposureChancePercent * 1.75,
            ),
            strongExposureChancePercent: Math.min(
              100,
              base.potential.strongExposureChancePercent * 1.7,
            ),
            displayOnlyMinItems: Math.min(
              base.potential.displayOnlyMaxItems,
              base.potential.displayOnlyMinItems + 1,
            ),
            nearMissChancePercent: Math.min(
              100,
              base.potential.nearMissChancePercent * 1.6,
            ),
          }
        : { ...base.potential },
    },
  });
}

export type GamePresetId = "dengeli" | "hareketli" | "comert" | "ilk-giris";
export const GAME_PRESET_COPY: Record<GamePresetId, { name: string; summary: string }> = {
  dengeli: { name: "Dengeli", summary: "Fabrika matematiğine geri dön." },
  hareketli: { name: "Hareketli", summary: "Slotlarda daha sık özellik; diğer oyunlarda daha yüksek hedef dönüş." },
  comert: { name: "Cömert", summary: "Varsayılana göre daha yüksek ödeme." },
  "ilk-giris": { name: "İlk giriş · Açılış şöleni", summary: "Slotlarda +%15 ödeme ölçeği ve daha sık özellik. Diğer oyunlarda %99,5 hedef dönüş; masa oyunlarında net kazanç üzerine +%15 açılış ödülü." },
};

export function applyAdminGamePreset(game: CasinoGameId, preset: GamePresetId) {
  const base = gameDefaults[game];
  const lively = preset === "hareketli" || preset === "ilk-giris";
  const factor = preset === "ilk-giris" ? 1.15 : preset === "comert" ? 1.1 : 1;
  if (base.slot) {
    applyAdminSlotPreset(game, preset === "hareketli" ? "comert" : preset);
    return;
  }
  if (base.mineDrop) {
    const mineDrop = structuredClone(base.mineDrop);
    mineDrop.profileName = `${base.mineDrop.profileName}-${preset}`;
    for (const key of Object.keys(mineDrop.payoutScales) as Array<keyof typeof mineDrop.payoutScales>) mineDrop.payoutScales[key] *= factor;
    if (lively) for (const weights of Object.values(mineDrop.symbolWeights)) {
      weights.tool *= 1.15;
      weights.eye *= 1.1;
      weights.tnt *= 1.1;
    }
    updateAdminGame(game, { mineDrop });
    return;
  }
  if (base.allah) {
    const allah = structuredClone(base.allah);
    allah.profileName = `${base.allah.profileName}-${preset}`;
    allah.coinPayoutScale *= factor;
    if (lively) {
      allah.reelEyeChancePercent.base *= 1.2;
      allah.reelScatterChancePercent.base *= 1.15;
    }
    updateAdminGame(game, { allah });
    return;
  }
  const table = ["blackjack", "roulette", "poker"].includes(game);
  updateAdminGame(game, {
    targetRtp: table || preset === "dengeli" ? base.targetRtp : preset === "ilk-giris" ? 99.5 : Math.min(99.5, base.targetRtp + (preset === "comert" ? 2 : 1)),
    openingPayoutBoost: table ? factor - 1 : 0,
  });
}

export function upsertAdminUser(user: CasinoAdminUser) {
  const exists = currentSettings.users.some(
    (candidate) => candidate.id === user.id,
  );
  const users = exists
    ? currentSettings.users.map((candidate) =>
        candidate.id === user.id ? user : candidate,
      )
    : [...currentSettings.users, user];
  persist({ ...currentSettings, users });
}

export function removeAdminUser(id: string) {
  if (id === "muharrem-pehlevan") return;
  persist({
    ...currentSettings,
    users: currentSettings.users.filter((user) => user.id !== id),
  });
}

export function resetAdminSettings() {
  persist({ ...DEFAULT_ADMIN_SETTINGS, users: currentSettings.users });
}
