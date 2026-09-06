import { describe, expect, it } from "vitest";
import {
  MINE_MAX_WIN_X,
  createMine,
  runMineSpin,
  seededMineRandom,
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
    const result = runMineSpin({
      mine: createMine(seededMineRandom(7)),
      bonusTier: "epic",
      random: () => 0.4,
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
    const samples = [0, 0, 0.83, ...Array.from({ length: 13 }, () => 0.99)];
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
});
