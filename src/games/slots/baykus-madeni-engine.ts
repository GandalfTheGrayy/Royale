import {
  DEFAULT_MINE_DROP_TUNING,
  type MineDropReelContext,
  type MineDropTuningSettings,
} from "../../data/casino-admin";

export type MineTool = "bronze" | "iron" | "gold" | "diamond" | "obsidian";
export type MineBlock = "dirt" | "stone" | "blast" | "redstone" | "mystery" | "gold" | "diamond" | "obsidian";
export type MineSpecial = "tnt" | "book" | "max-book" | "eye" | "empty";
export type MineReelSymbol = { kind: "tool"; tool: MineTool } | { kind: "special"; special: MineSpecial };
export type MineBonusTier = "block" | "super" | "epic";
export type MinePaidMode = "base" | "extra" | "super" | "diamond" | "obsidian";

export type MineCell = { id: string; type: MineBlock; hp: number; maxHp: number };
export type MineState = { columns: MineCell[][]; chests: Array<{ opened: boolean; multiplier?: number }> };
export type MineSpinEvent = {
  kind: "drop" | "hit" | "break" | "blast" | "chest" | "upgrade";
  wave?: number;
  column?: number;
  row?: number;
  sourceColumn?: number;
  sourceRow?: number;
  targetRow?: number;
  tool?: MineTool;
  special?: Exclude<MineSpecial, "empty"> | "blast-ore";
  damage?: number;
  hpAfter?: number;
  maxHp?: number;
  label: string;
  valueX?: number;
};
export type MineSpinResult = {
  reel: MineReelSymbol[][];
  initialMine: MineState;
  mine: MineState;
  eyeCount: number;
  triggeredBonus?: MineBonusTier;
  addedSpins: number;
  blockWinX: number;
  chestMultiplierX: number;
  totalWinX: number;
  openedChests: number[];
  events: MineSpinEvent[];
};

export const MINE_MAX_WIN_X = DEFAULT_MINE_DROP_TUNING.maxWinX;
export const TOOL_DURABILITY = DEFAULT_MINE_DROP_TUNING.toolDurability;
export const BLOCK_RULES = DEFAULT_MINE_DROP_TUNING.blockRules;

export type MineBonusProgress = {
  blockWinX: number;
  chestMultiplierX: number;
  totalWinX: number;
};

export function createMineBonusProgress(mine: MineState): MineBonusProgress {
  return {
    blockWinX: 0,
    chestMultiplierX: mine.chests.reduce((product, chest) => product * (chest.opened ? chest.multiplier ?? 1 : 1), 1),
    totalWinX: 0,
  };
}

// Revalue the accumulated, unmultiplied block bank. Never multiply an already
// multiplied payout again, and only credit the increase over the previous total.
export function settleMineBonusSpin(
  previous: MineBonusProgress,
  spin: Pick<MineSpinResult, "blockWinX" | "chestMultiplierX">,
  scale = 1,
  maxWinX = MINE_MAX_WIN_X,
) {
  const blockWinX = previous.blockWinX + spin.blockWinX;
  const chestMultiplierX = previous.chestMultiplierX * spin.chestMultiplierX;
  const totalWinX = Math.min(Math.max(0, maxWinX), blockWinX * chestMultiplierX * scale);
  return { blockWinX, chestMultiplierX, totalWinX, creditWinX: Math.max(0, totalWinX - previous.totalWinX) };
}

function browserRandom() {
  const sample = new Uint32Array(1);
  crypto.getRandomValues(sample);
  return sample[0] / 0x1_0000_0000;
}

function weighted<T>(values: readonly T[], weights: readonly number[], random: () => number) {
  const safe = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const total = safe.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return values[values.length - 1];
  let cursor = random() * total;
  for (let index = 0; index < values.length; index += 1) {
    const weight = safe[index] ?? 0;
    if (cursor < weight) return values[index];
    cursor -= weight;
  }
  return values[values.length - 1];
}

function weightedRecord<T extends string>(record: Record<T, number>, random: () => number): T {
  const values = Object.keys(record) as T[];
  return weighted(values, values.map((value) => record[value]), random);
}

export function cloneMine(mine: MineState): MineState {
  return {
    columns: mine.columns.map((column) => column.map((cell) => ({ ...cell }))),
    chests: mine.chests.map((chest) => ({ ...chest })),
  };
}

function layerBlock(row: number, random: () => number, tuning: MineDropTuningSettings): MineBlock {
  const weights = tuning.layerWeights[Math.max(0, Math.min(tuning.layerWeights.length - 1, row))];
  return weightedRecord(weights, random) as MineBlock;
}

function createSurfaceProfile(random: () => number, tuning: MineDropTuningSettings) {
  const minimum = Math.max(0, Math.min(5, Math.round(tuning.surfaceProfile.minOpenRows)));
  const maximum = Math.max(minimum, Math.min(5, Math.round(tuning.surfaceProfile.maxOpenRows)));
  const maxStep = Math.max(0, Math.min(5, Math.round(tuning.surfaceProfile.maxStep)));
  const sampleDepth = () => minimum + Math.floor(random() * (maximum - minimum + 1));
  const profile: number[] = [];
  let previous = sampleDepth();
  for (let column = 0; column < 5; column += 1) {
    const sampled = column === 0 ? previous : sampleDepth();
    const lower = Math.max(minimum, previous - maxStep);
    const upper = Math.min(maximum, previous + maxStep);
    const depth = Math.max(lower, Math.min(upper, sampled));
    profile.push(depth);
    previous = depth;
  }
  if (maximum > minimum && profile.every((depth) => depth === profile[0])) {
    const edge = random() < 0.5 ? 0 : profile.length - 1;
    profile[edge] = profile[edge] < maximum ? profile[edge] + 1 : profile[edge] - 1;
  }
  return profile;
}

export function createMine(
  random: () => number = browserRandom,
  tuning: MineDropTuningSettings = DEFAULT_MINE_DROP_TUNING,
  premiumMode?: "diamond" | "obsidian",
): MineState {
  const surfaceProfile = createSurfaceProfile(random, tuning);
  const mine: MineState = {
    columns: Array.from({ length: 5 }, (_, column) =>
      Array.from({ length: 6 }, (_, row) => {
        const type = layerBlock(row, random, tuning);
        const hp = Math.max(1, tuning.blockRules[type].hp);
        return { id: `${column}-${row}-${Math.floor(random() * 1e9)}`, type, hp, maxHp: hp };
      }),
    ),
    chests: Array.from({ length: 5 }, () => ({ opened: false })),
  };
  mine.columns.forEach((column, columnIndex) => {
    let openRows = surfaceProfile[columnIndex];
    if (premiumMode) {
      const baseDepth = Math.max(0, Math.min(5, Math.round(tuning.premiumOpenRows[premiumMode])));
      const stagger = columnIndex % 2 === 0 ? 0 : random() < 0.55 ? 1 : 0;
      openRows = Math.max(openRows, Math.max(0, baseDepth - stagger));
    }
    for (let row = 0; row < openRows; row += 1) column[row].hp = 0;
  });
  return mine;
}

function contextFor(mode: MinePaidMode, bonusTier?: MineBonusTier): MineDropReelContext {
  return bonusTier ? `bonus-${bonusTier}` : mode;
}

function rollTool(context: MineDropReelContext, random: () => number, tuning: MineDropTuningSettings): MineTool {
  return weightedRecord(tuning.toolWeights[context], random) as MineTool;
}

function rollReelSymbol(context: MineDropReelContext, random: () => number, tuning: MineDropTuningSettings): MineReelSymbol {
  const weights = tuning.symbolWeights[context];
  const kind = weighted(
    ["tool", "eye", "tnt", "book", "max-book", "empty"] as const,
    [weights.tool, weights.eye, weights.tnt, weights.book, weights.maxBook, weights.empty],
    random,
  );
  return kind === "tool" ? { kind: "tool", tool: rollTool(context, random, tuning) } : { kind: "special", special: kind };
}

export function rollMysteryOutcome(
  random: () => number = browserRandom,
  tuning: MineDropTuningSettings = DEFAULT_MINE_DROP_TUNING,
) {
  return weightedRecord(tuning.mysteryOutcomeWeights, random) as "none" | "super" | "epic";
}

export function runMineSpin(options: {
  mine?: MineState;
  mode?: MinePaidMode;
  bonusTier?: MineBonusTier;
  random?: () => number;
  tuning?: MineDropTuningSettings;
} = {}): MineSpinResult {
  const random = options.random ?? browserRandom;
  const tuning = options.tuning ?? DEFAULT_MINE_DROP_TUNING;
  const mode = options.mode ?? "base";
  const context = contextFor(mode, options.bonusTier);
  const sourceMine = options.mine ?? createMine(random, tuning, mode === "diamond" || mode === "obsidian" ? mode : undefined);
  const initialMine = cloneMine(sourceMine);
  const mine = cloneMine(sourceMine);
  const events: MineSpinEvent[] = [];
  const reel = Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => rollReelSymbol(context, random, tuning)));

  let flat = reel.flat();
  const eyesBeforePromotion = flat.filter((symbol) => symbol.kind === "special" && symbol.special === "eye").length;
  if (mode === "super" && !options.bonusTier && eyesBeforePromotion === 3) {
    const replacement = flat.findIndex((symbol) => symbol.kind === "special" && symbol.special !== "eye");
    if (replacement >= 0) reel[Math.floor(replacement / 5)][replacement % 5] = { kind: "special", special: "eye" };
  }
  flat = reel.flat();
  const hasMaxBook = flat.some((symbol) => symbol.kind === "special" && symbol.special === "max-book");
  const hasBook = flat.some((symbol) => symbol.kind === "special" && symbol.special === "book");
  const upgradeTo: MineTool | undefined = hasMaxBook ? "obsidian" : hasBook ? "diamond" : undefined;
  if (upgradeTo) {
    const toolRank: Record<MineTool, number> = { bronze: 0, iron: 1, gold: 2, diamond: 3, obsidian: 4 };
    for (const row of reel) {
      for (let column = 0; column < row.length; column += 1) {
        const symbol = row[column];
        if (symbol.kind === "tool" && toolRank[symbol.tool] < toolRank[upgradeTo]) row[column] = { kind: "tool", tool: upgradeTo };
      }
    }
    events.push({
      kind: "upgrade",
      special: upgradeTo === "obsidian" ? "max-book" : "book",
      label: upgradeTo === "obsidian" ? "MAX kitap: tüm kazmalar Obsidyen" : "Geliştirme kitabı: tüm kazmalar Elmas",
    });
  }

  let blockWinX = 0;
  let chestMultiplierX = 1;
  const openedChests: number[] = [];
  const exploded = new Set<string>();
  const rollValue = (record: Record<string, number>) => Number(weightedRecord(record, random));

  const maybeOpenChest = (column: number, wave?: number) => {
    if (mine.chests[column].opened || !mine.columns[column].every((cell) => cell.hp <= 0)) return;
    const multiplier = rollValue(tuning.chestValueWeights);
    mine.chests[column] = { opened: true, multiplier };
    chestMultiplierX *= multiplier;
    openedChests.push(column);
    events.push({ kind: "chest", column, wave, label: `Sandık ${multiplier}×`, valueX: multiplier });
  };

  const damageCell = (
    column: number,
    row: number,
    damage: number,
    source: Pick<MineSpinEvent, "tool" | "special" | "sourceColumn" | "sourceRow" | "wave"> = {},
  ) => {
    const cell = mine.columns[column]?.[row];
    if (!cell || cell.hp <= 0 || damage <= 0) return;
    const applied = Math.min(cell.hp, damage);
    cell.hp -= applied;
    events.push({ kind: "hit", column, row, damage: applied, hpAfter: cell.hp, maxHp: cell.maxHp, label: `${cell.type} -${applied}`, ...source });
    if (cell.hp > 0) return;
    const valueX = cell.type === "mystery" ? rollValue(tuning.mysteryValueWeights) : tuning.blockRules[cell.type].payoutX;
    blockWinX += valueX;
    events.push({ kind: "break", column, row, hpAfter: 0, maxHp: cell.maxHp, label: `${cell.type} kırıldı`, valueX, ...source });
    if (cell.type === "blast" && !exploded.has(cell.id)) {
      exploded.add(cell.id);
      events.push({ kind: "blast", column, row, targetRow: row, wave: source.wave, special: "blast-ore", label: "Patlayıcı cevher zinciri" });
      for (let dc = -1; dc <= 1; dc += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          if (dc || dr) damageCell(column + dc, row + dr, 1, { special: "blast-ore" });
        }
      }
    }
    maybeOpenChest(column, source.wave);
  };

  const toolDrops: Array<{ column: number; sourceRow: number; tool: MineTool; durability: number }> = [];
  const tntDrops: Array<{ column: number; sourceRow: number }> = [];
  for (let reelRow = 2; reelRow >= 0; reelRow -= 1) {
    for (let column = 0; column < 5; column += 1) {
      const symbol = reel[reelRow][column];
      if (symbol.kind === "tool") {
        const targetRow = mine.columns[column].findIndex((cell) => cell.hp > 0);
        const durability = Math.max(0, Math.round(tuning.toolDurability[symbol.tool]));
        toolDrops.push({ column, sourceRow: reelRow, tool: symbol.tool, durability });
        events.push({ kind: "drop", wave: 0, column, sourceColumn: column, sourceRow: reelRow, targetRow, tool: symbol.tool, label: `${symbol.tool} kazma düşüyor` });
      } else if (symbol.special === "tnt") tntDrops.push({ column, sourceRow: reelRow });
    }
  }

  // Bütün kazmalar aynı darbe dalgasında birer kez vurur. Böylece görsel sunum
  // kazmaları seri oynatmak yerine beraber düşürüp beraber sektirebilir.
  let strikeWave = 1;
  while (toolDrops.some((drop) => drop.durability > 0)) {
    let struck = false;
    for (const drop of toolDrops) {
      if (drop.durability <= 0) continue;
      const row = mine.columns[drop.column].findIndex((cell) => cell.hp > 0);
      if (row < 0) {
        drop.durability = 0;
        continue;
      }
      damageCell(drop.column, row, 1, { wave: strikeWave, tool: drop.tool, sourceColumn: drop.column, sourceRow: drop.sourceRow });
      drop.durability -= 1;
      struck = true;
    }
    if (!struck) break;
    strikeWave += 1;
  }

  const tntDropWave = strikeWave;
  const tntBlastWave = strikeWave + 1;
  for (const tnt of tntDrops) {
    const targetRow = mine.columns[tnt.column].findIndex((cell) => cell.hp > 0);
    if (targetRow < 0) continue;
    events.push({ kind: "drop", wave: tntDropWave, column: tnt.column, sourceColumn: tnt.column, sourceRow: tnt.sourceRow, targetRow, special: "tnt", label: "TNT düşüyor" });
    events.push({ kind: "blast", wave: tntBlastWave, column: tnt.column, row: targetRow, targetRow, special: "tnt", label: "TNT 3×3 alanı vurdu" });
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) damageCell(tnt.column + dc, targetRow + dr, 2, { wave: tntBlastWave, special: "tnt", sourceColumn: tnt.column, sourceRow: tnt.sourceRow });
    }
  }
  for (let column = 0; column < 5; column += 1) maybeOpenChest(column, tntBlastWave);

  const eyeCount = reel.flat().filter((symbol) => symbol.kind === "special" && symbol.special === "eye").length;
  const triggeredBonus = options.bonusTier
    ? undefined
    : eyeCount >= 5 ? "epic" : eyeCount >= 4 || (mode === "super" && eyeCount >= 3) ? "super" : eyeCount === 3 ? "block" : undefined;
  // Bonus turları sabittir; Göz sembolleri bonus sırasında yeni tur eklemez.
  const addedSpins = 0;
  const scale = tuning.payoutScales[context];
  return {
    reel,
    initialMine,
    mine,
    eyeCount,
    triggeredBonus,
    addedSpins,
    blockWinX,
    chestMultiplierX,
    totalWinX: Math.min(tuning.maxWinX, blockWinX * chestMultiplierX * scale),
    openedChests,
    events,
  };
}

export function seededMineRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
