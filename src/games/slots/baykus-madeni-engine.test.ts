import { describe, expect, it } from "vitest";
import {
  MINE_MAX_WIN_X,
  createMine,
  createMineBonusProgress,
  runMineSpin,
  seededMineRandom,
  settleMineBonusSpin,
} from "./baykus-madeni-engine";
import { DEFAULT_MINE_DROP_TUNING } from "../../data/casino-admin";

describe("Baykuş Madeni motoru", () => {
  it("beş sütun, altı blok ve beş sandık oluşturur", () => {
    const mine = createMine(seededMineRandom(42));
    expect(mine.columns).toHaveLength(5);
    expect(mine.columns.every((column) => column.length === 6)).toBe(true);
    expect(mine.chests).toHaveLength(5);
    const surfaceDepths = mine.columns.map((column) => column.findIndex((cell) => cell.hp > 0));
    expect(new Set(surfaceDepths).size).toBeGreaterThan(1);
    expect(surfaceDepths.every((depth) => depth >= 0 && depth <= 2)).toBe(true);
  });

  it("beş gözle epik bonusu tetikler", () => {
    const mine = createMine(seededMineRandom(7));
    const result = runMineSpin({ mine, random: () => 0.12 });
    expect(result.eyeCount).toBe(15);
    expect(result.triggeredBonus).toBe("epic");
  });

  it("bonus sırasında Göz sembolleri ek dönüş vermez", () => {
    const weights = DEFAULT_MINE_DROP_TUNING.symbolWeights["bonus-epic"];
    const result = runMineSpin({
      mine: createMine(seededMineRandom(7)),
      bonusTier: "epic",
      random: () => (weights.tool + weights.eye / 2) / 100,
    });
    expect(result.eyeCount).toBe(15);
    expect(result.addedSpins).toBe(0);
    expect(result.triggeredBonus).toBeUndefined();
  });

  it("Elmas Dönüşte düşük seviye kazma üretmez", () => {
    const result = runMineSpin({
      mine: createMine(seededMineRandom(5)),
      mode: "diamond",
      random: seededMineRandom(99),
    });
    const tools = result.reel.flat().filter((symbol) => symbol.kind === "tool");
    expect(tools.every((symbol) => symbol.kind === "tool" && ["diamond", "obsidian"].includes(symbol.tool))).toBe(true);
  });

  it("normal geliştirme kitabı mevcut Obsidyen kazmayı Elmas seviyesine düşürmez", () => {
    const weights = DEFAULT_MINE_DROP_TUNING.symbolWeights.obsidian;
    const bookSample = (weights.tool + weights.eye + weights.tnt + weights.book / 2) / 100;
    const samples = [0, 0, bookSample, ...Array.from({ length: 13 }, () => 0.99)];
    let cursor = 0;
    const result = runMineSpin({
      mine: createMine(seededMineRandom(51)),
      mode: "obsidian",
      random: () => samples[cursor++] ?? 0.99,
    });
    const tools = result.reel.flat().filter((symbol) => symbol.kind === "tool");
    expect(result.reel.flat().some((symbol) => symbol.kind === "special" && symbol.special === "book")).toBe(true);
    expect(tools.every((symbol) => symbol.kind === "tool" && symbol.tool === "obsidian")).toBe(true);
  });

  it("kazancı 50.000 kat sınırında tutar", () => {
    const result = runMineSpin({
      mine: createMine(seededMineRandom(1)),
      mode: "obsidian",
      random: seededMineRandom(3),
    });
    expect(result.totalWinX).toBeLessThanOrEqual(MINE_MAX_WIN_X);
    expect(result.mine.columns.flat().every((cell) => cell.hp >= 0)).toBe(true);
  });

  it("Obsidyen kazmaların her dayanıklılık puanını ayrı darbe olayına dönüştürür", () => {
    const tuning = structuredClone(DEFAULT_MINE_DROP_TUNING);
    const mine = createMine(seededMineRandom(11), tuning);
    mine.columns.flat().forEach((cell) => { cell.hp = 100; cell.maxHp = 100; });
    const result = runMineSpin({ mine, mode: "obsidian", random: () => 0, tuning });
    const hits = result.events.filter((event) => event.kind === "hit" && event.tool === "obsidian");
    expect(hits).toHaveLength(15 * tuning.toolDurability.obsidian);
    expect(hits.every((event) => event.damage === 1)).toBe(true);
    expect(hits.every((event) => event.column === event.sourceColumn)).toBe(true);
    expect(result.events.filter((event) => event.kind === "drop").every((event) => event.wave === 0)).toBe(true);
    expect(new Set(hits.map((event) => event.wave))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
  });

  it("aynı turda açılan sandıkları blok kazancına sırayla çarpar", () => {
    const tuning = structuredClone(DEFAULT_MINE_DROP_TUNING);
    tuning.symbolWeights.base = { tool: 1, eye: 0, tnt: 0, book: 0, maxBook: 0, empty: 0 };
    tuning.toolWeights.base = { bronze: 1, iron: 0, gold: 0, diamond: 0, obsidian: 0 };
    tuning.blockRules.stone = { hp: 1, payoutX: 2 };
    tuning.chestValueWeights = { "3": 1 };
    const mine = createMine(seededMineRandom(17), tuning);
    mine.columns.forEach((column) => {
      column.forEach((cell) => { cell.hp = 0; });
      column[0] = { ...column[0], type: "stone", hp: 1, maxHp: 1 };
    });
    const result = runMineSpin({ mine, mode: "base", random: () => 0, tuning });
    expect(result.openedChests).toHaveLength(5);
    expect(result.blockWinX).toBe(10);
    expect(result.chestMultiplierX).toBe(243);
    expect(result.totalWinX).toBe(2_430);
  });

  it("premium dönüşler için sandıklara yaklaşan önceden kazılmış saha kurar", () => {
    const diamond = createMine(seededMineRandom(21), DEFAULT_MINE_DROP_TUNING, "diamond");
    const obsidian = createMine(seededMineRandom(22), DEFAULT_MINE_DROP_TUNING, "obsidian");
    expect(diamond.columns.every((column) => column[0].hp === 0)).toBe(true);
    expect(obsidian.columns.every((column) => column.slice(0, 3).every((cell) => cell.hp === 0))).toBe(true);
  });

  it("admin blok dayanıklılığı ve katman ağırlığını yeni duvara uygular", () => {
    const tuning = structuredClone(DEFAULT_MINE_DROP_TUNING);
    tuning.surfaceProfile = { minOpenRows: 0, maxOpenRows: 0, maxStep: 0 };
    tuning.blockRules.dirt.hp = 9;
    tuning.layerWeights[0] = { dirt: 1, stone: 0, blast: 0, redstone: 0, mystery: 0, gold: 0, diamond: 0, obsidian: 0 };
    const mine = createMine(seededMineRandom(31), tuning);
    expect(mine.columns.every((column) => column[0].type === "dirt" && column[0].hp === 9)).toBe(true);
  });

  it("geç açılan sandık önceki ve sonraki bonus kazançlarını çarpar, yalnız farkı öder", () => {
    let progress = { blockWinX: 0, chestMultiplierX: 1, totalWinX: 0 };
    const credits: number[] = [];
    for (const spin of [
      { blockWinX: 10, chestMultiplierX: 1 },
      { blockWinX: 5, chestMultiplierX: 1 },
      { blockWinX: 0, chestMultiplierX: 3 },
      { blockWinX: 2, chestMultiplierX: 2 },
    ]) {
      const settled = settleMineBonusSpin(progress, spin);
      credits.push(settled.creditWinX);
      progress = settled;
    }
    expect(credits).toEqual([10, 5, 30, 57]);
    expect(progress).toMatchObject({ blockWinX: 17, chestMultiplierX: 6, totalWinX: 102 });
    expect(credits.reduce((sum, credit) => sum + credit, 0)).toBe(102);
    expect(settleMineBonusSpin(progress, { blockWinX: 0, chestMultiplierX: 1 }).creditWinX).toBe(0);
  });

  it("bonus ve Gizem ödeme ölçeklerini birikmiş ham kazanca bir kez uygular", () => {
    const first = settleMineBonusSpin({ blockWinX: 0, chestMultiplierX: 1, totalWinX: 0 }, { blockWinX: 10, chestMultiplierX: 2 }, 0.5 * 0.4);
    const second = settleMineBonusSpin(first, { blockWinX: 5, chestMultiplierX: 3 }, 0.5 * 0.4);
    expect(first.totalWinX).toBe(4);
    expect(second.totalWinX).toBe(18);
    expect(second.creditWinX).toBe(14);
  });

  it("azami ödemeyi bütün bonusa uygular ve tetikleyen el için kalan sınırı gözetir", () => {
    const first = settleMineBonusSpin({ blockWinX: 0, chestMultiplierX: 1, totalWinX: 0 }, { blockWinX: 10_000, chestMultiplierX: 2 }, 1, 45_000);
    const second = settleMineBonusSpin(first, { blockWinX: 10_000, chestMultiplierX: 10 }, 1, 45_000);
    const third = settleMineBonusSpin(second, { blockWinX: 1, chestMultiplierX: 2 }, 1, 45_000);
    expect(first.creditWinX + second.creditWinX + third.creditWinX).toBe(45_000);
    expect(third.creditWinX).toBe(0);
  });

  it.each(["block", "super", "epic"] as const)("%s bonusunda aynı sandığı tekrar açmaz, önceki çarpanı sonraki kazanca taşır", (bonusTier) => {
    const tuning = structuredClone(DEFAULT_MINE_DROP_TUNING);
    tuning.symbolWeights[`bonus-${bonusTier}`] = { tool: 1, eye: 0, tnt: 0, book: 0, maxBook: 0, empty: 0 };
    tuning.toolWeights[`bonus-${bonusTier}`] = { bronze: 1, iron: 0, gold: 0, diamond: 0, obsidian: 0 };
    tuning.chestValueWeights = { "3": 1 };
    const mine = createMine(seededMineRandom(17), tuning);
    mine.columns.forEach((column, index) => {
      column.forEach((cell) => { cell.hp = 0; });
      column[0] = { ...column[0], type: "gold", hp: index === 0 ? 1 : 4, maxHp: 4 };
    });
    const initial = createMineBonusProgress(mine);
    const first = runMineSpin({ mine, bonusTier, tuning, random: () => 0 });
    const progress = settleMineBonusSpin(initial, first);
    expect(first.openedChests).toEqual([0]);
    expect(progress.totalWinX).toBe(9);
    const second = runMineSpin({ mine: first.mine, bonusTier, tuning, random: () => 0 });
    const final = settleMineBonusSpin(progress, second);
    expect(second.openedChests).toEqual([1, 2, 3, 4]);
    expect(final.totalWinX).toBe(15 * 3 ** 5);
    expect(progress.totalWinX + final.creditWinX).toBe(final.totalWinX);
    expect(mine.chests.every((chest) => !chest.opened)).toBe(true);
  });

  it("doğal bonusa açık sandığı taşır, tetikleyen elin bloklarını tekrar ödemez", () => {
    const mine = createMine(seededMineRandom(10));
    mine.chests[0] = { opened: true, multiplier: 3 };
    const progress = createMineBonusProgress(mine);
    expect(progress).toEqual({ blockWinX: 0, chestMultiplierX: 3, totalWinX: 0 });
    expect(settleMineBonusSpin(progress, { blockWinX: 5, chestMultiplierX: 1 }).totalWinX).toBe(15);
  });

  it("Obsidyen varsayılanında sık azami ödeme ve sürekli kâr regresyonunu engeller", () => {
    const random = seededMineRandom(76123);
    let total = 0, caps = 0, profits = 0;
    for (let sample = 0; sample < 10_000; sample++) {
      const result = runMineSpin({ mode: "obsidian", random });
      total += result.totalWinX;
      if (result.totalWinX >= MINE_MAX_WIN_X) caps++;
      if (result.totalWinX > DEFAULT_MINE_DROP_TUNING.modeCosts.obsidian) profits++;
    }
    expect(total / (10_000 * DEFAULT_MINE_DROP_TUNING.modeCosts.obsidian)).toBeLessThan(1.3);
    expect(caps).toBeLessThan(100);
    expect(profits).toBeLessThan(2500);
  });
});
