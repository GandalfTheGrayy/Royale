import { describe, expect, it } from "vitest";
import {
  MINE_MAX_WIN_X,
  accrueMineBonusSpin,
  createMine,
  createMineBonusProgress,
  runMineSpin,
  seededMineRandom,
  settleMineBonusFinal,
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

  it("geliştirme kitabı animasyonunun dönüştüreceği her kazmayı kaynak seviyesiyle verir", () => {
    const tuning = structuredClone(DEFAULT_MINE_DROP_TUNING);
    tuning.symbolWeights.base = { tool: 1, eye: 0, tnt: 0, book: 1, maxBook: 0, empty: 0 };
    tuning.toolWeights.base = { bronze: 1, iron: 0, gold: 0, diamond: 0, obsidian: 0 };
    const samples = [0.1, 0.1, 0.75, ...Array.from({ length: 13 }, () => [0.1, 0.1]).flat()];
    let cursor = 0;
    const result = runMineSpin({ mine: createMine(seededMineRandom(19), tuning), random: () => samples[cursor++] ?? 0.1, tuning });
    const upgrade = result.events.find((event) => event.kind === "upgrade");
    expect(upgrade?.special).toBe("book");
    expect(upgrade?.upgradeTargets).toHaveLength(14);
    expect(upgrade?.upgradeTargets?.every((target) => target.from === "bronze" && target.to === "diamond")).toBe(true);
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

  it("aynı turda açılan sandıkları tek global çarpanda toplar", () => {
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
    expect(result.chestMultiplierX).toBe(15);
    expect(result.totalWinX).toBe(150);
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

  it("bonus sandıklarını biriktirir ve bütün blok kasasını yalnız finalde öder", () => {
    let progress = { blockWinX: 0, chestMultiplierX: 0, totalWinX: 0 };
    const credits: number[] = [];
    for (const spin of [
      { blockWinX: 10, chestAddX: 0 },
      { blockWinX: 5, chestAddX: 0 },
      { blockWinX: 0, chestAddX: 3 },
      { blockWinX: 2, chestAddX: 2 },
    ]) {
      const settled = accrueMineBonusSpin(progress, spin);
      credits.push(settled.creditWinX);
      progress = settled;
    }
    expect(credits).toEqual([0, 0, 0, 0]);
    expect(progress).toMatchObject({ blockWinX: 17, chestMultiplierX: 5, totalWinX: 0 });
    expect(settleMineBonusFinal(progress)).toMatchObject({ totalWinX: 85, creditWinX: 85 });
  });

  it("2× ve 5× sandığı gizli başlangıç değeri eklemeden 7× yapar", () => {
    const first = accrueMineBonusSpin(
      { blockWinX: 0, chestMultiplierX: 0, totalWinX: 0 },
      { blockWinX: 4, chestAddX: 2 },
    );
    const second = accrueMineBonusSpin(first, { blockWinX: 6, chestAddX: 5 });
    expect(second).toMatchObject({ blockWinX: 10, chestMultiplierX: 7, totalWinX: 0, creditWinX: 0 });
    expect(settleMineBonusFinal(second)).toMatchObject({ chestMultiplierX: 7, totalWinX: 70, creditWinX: 70 });
  });

  it("bonus ve Gizem ödeme ölçeklerini finaldeki ham kazanca bir kez uygular", () => {
    const first = accrueMineBonusSpin({ blockWinX: 0, chestMultiplierX: 0, totalWinX: 0 }, { blockWinX: 10, chestAddX: 2 });
    const second = accrueMineBonusSpin(first, { blockWinX: 5, chestAddX: 3 });
    expect(first.creditWinX).toBe(0);
    expect(second.creditWinX).toBe(0);
    expect(settleMineBonusFinal(second, 0.5 * 0.4)).toMatchObject({ totalWinX: 15, creditWinX: 15 });
  });

  it("azami ödemeyi bütün bonusun nihai tek ödemesine uygular", () => {
    const first = accrueMineBonusSpin({ blockWinX: 0, chestMultiplierX: 0, totalWinX: 0 }, { blockWinX: 10_000, chestAddX: 2 });
    const second = accrueMineBonusSpin(first, { blockWinX: 10_000, chestAddX: 10 });
    const third = accrueMineBonusSpin(second, { blockWinX: 1, chestAddX: 2 });
    expect(settleMineBonusFinal(third, 1, 45_000)).toMatchObject({ totalWinX: 45_000, creditWinX: 45_000 });
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
    const progress = accrueMineBonusSpin(initial, first);
    expect(first.openedChests).toEqual([0]);
    expect(progress.totalWinX).toBe(0);
    const second = runMineSpin({ mine: first.mine, bonusTier, tuning, random: () => 0 });
    const final = settleMineBonusFinal(accrueMineBonusSpin(progress, second));
    expect(second.openedChests).toEqual([1, 2, 3, 4]);
    expect(final.totalWinX).toBe(15 * 15);
    expect(final.creditWinX).toBe(final.totalWinX);
    expect(mine.chests.every((chest) => !chest.opened)).toBe(true);
  });

  it("doğal bonusa temel oyunda açılmış sandığı taşımaz", () => {
    const mine = createMine(seededMineRandom(10));
    mine.chests[0] = { opened: true, multiplier: 3 };
    const progress = createMineBonusProgress(mine);
    expect(progress).toEqual({ blockWinX: 0, chestMultiplierX: 0, totalWinX: 0 });
    expect(settleMineBonusFinal(accrueMineBonusSpin(progress, { blockWinX: 5, chestAddX: 0 })).totalWinX).toBe(5);
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
