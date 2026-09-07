import { describe, expect, it } from "vitest";
import {
  ALLAH_MAX_WIN_X,
  ALLAH_PAYLINES,
  allahCoinCell,
  allahCoinTierForValue,
  allahFeatureCell,
  allahPurchaseCost,
  allahSymbolCell,
  createAllahGrid,
  createSeededAllahRandom,
  defaultAllahPersistentState,
  evaluateAllahPaylines,
  runAllahSpin,
  type AllahCell,
} from "./allahin-lutfu-engine";

function uniqueSymbols(row: number, column: number): AllahCell {
  const symbols = [
    "rosette",
    "lantern",
    "crescent",
    "tree-of-life",
    "golden-owl",
    "star-of-david",
    "gate-of-light",
    "hand-of-blessing",
    "celestial-key",
  ] as const;
  return allahSymbolCell(symbols[(row * 5 + column) % symbols.length], `u-${row}-${column}`);
}

describe("Allah’ın Lütfu motoru", () => {
  it("28 benzersiz ve beş reel uzunluğunda ödeme çizgisi sunar", () => {
    expect(ALLAH_PAYLINES).toHaveLength(28);
    expect(new Set(ALLAH_PAYLINES.map((line) => line.join("-"))).size).toBe(28);
    expect(ALLAH_PAYLINES.every((line) => line.length === 5)).toBe(true);
  });

  it("yalnız soldan başlayan bitişik sembollere ödeme yapar", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahSymbolCell("star-of-david", "a");
    grid[0][1] = allahSymbolCell("star-of-david", "b");
    grid[0][2] = allahSymbolCell("star-of-david", "c");
    grid[0][3] = allahSymbolCell("star-of-david", "d");
    expect(evaluateAllahPaylines(grid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ payline: 0, count: 4, multiplier: 2 }),
      ]),
    );

    const noLeft = createAllahGrid(uniqueSymbols);
    noLeft[0][1] = allahSymbolCell("celestial-key", "k1");
    noLeft[0][2] = allahSymbolCell("celestial-key", "k2");
    noLeft[0][3] = allahSymbolCell("celestial-key", "k3");
    expect(
      evaluateAllahPaylines(noLeft).some(
        (win) => win.payline === 0 && win.symbol === "celestial-key",
      ),
    ).toBe(false);
  });

  it("bütün satın alma maliyetlerini doğru hesaplar", () => {
    expect(allahPurchaseCost(10, "enhancer")).toBe(30);
    expect(allahPurchaseCost(10, "degen")).toBe(250);
    expect(allahPurchaseCost(10, "trickster")).toBe(750);
    expect(allahPurchaseCost(10, "fate")).toBe(50_000);
    expect(allahPurchaseCost(10, "bonus-buy")).toBe(2_000);
    expect(allahPurchaseCost(10, "super-bonus-buy")).toBe(10_000);
  });

  it("board multiplier yalnız komşu coin alanlarını etkiler", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[2][2] = { ...allahFeatureCell("multiplier", "multi"), kind: "multiplier", value: 3 };
    grid[1][1] = allahCoinCell("bronze", 2, "near");
    grid[5][4] = allahCoinCell("bronze", 2, "far");
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "radius-test" },
      createSeededAllahRandom(10),
    );
    const near = result.finalGrid[1][1];
    const far = result.finalGrid[5][4];
    expect(near.kind === "coin" && near.value).toBe(6);
    expect(near.kind === "coin" && near.tier).toBe("silver");
    expect(far.kind === "coin" && far.value).toBe(2);
    expect(result.events.filter((event) => event.type === "board-multiplier-cast")).toHaveLength(1);
    expect(result.events.filter((event) => event.type === "board-multiplier-apply")).toHaveLength(1);
    expect(result.events.some((event) => event.type === "board-multiplier-wave")).toBe(true);
  });

  it("upgrader mevcut coin'i değiştirmeden sonraki üretimlerin tabanını yükseltir", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahCoinCell("bronze", 2, "bronze");
    grid[0][1] = allahFeatureCell("upgrader", "upgrader");
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "upgrade-test" },
      createSeededAllahRandom(4),
    );
    expect(result.persistent.minimumCoinTier).toBe(1);
    expect(result.finalGrid[0][0]).toEqual(
      expect.objectContaining({ kind: "coin", tier: "bronze", value: 2 }),
    );
    expect(result.events.some((event) => event.type === "coin-upgrader-apply")).toBe(false);
  });

  it("upgrader sonrası Collector respin coin'leri yeni minimum katmandan üretir", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { ...allahFeatureCell("upgrader", "upgrader"), fromMystery: true };
    grid[0][1] = {
      ...allahFeatureCell("collector", "collector"),
      kind: "collector",
      super: false,
      fromMystery: true,
    };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "upgrade-next-slide-test" },
      () => 0,
    );
    const generatedCoins = result.finalGrid.flat().filter((cell) => cell.kind === "coin");
    expect(generatedCoins).toHaveLength(1);
    expect(generatedCoins.every((cell) => cell.kind === "coin" && cell.tier === "silver")).toBe(true);
  });

  it("her yeni asa coin tabanını bir kademe daha yükseltir", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("upgrader", "upgrader-1");
    grid[0][1] = allahFeatureCell("upgrader", "upgrader-2");
    grid[0][2] = allahFeatureCell("upgrader", "upgrader-3");
    grid[0][3] = { ...allahFeatureCell("collector", "collector"), kind: "collector", super: false };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "stacked-upgrader-test" },
      () => 0,
    );
    const completedUpgrades = result.events.filter(
      (event) => event.type === "coin-upgrader-charge" && event.payload.complete === true,
    );
    expect(completedUpgrades.map((event) => event.payload.removedTier)).toEqual([
      "bronze",
      "silver",
      "gold",
    ]);
    expect(completedUpgrades.map((event) => event.payload.minimumTier)).toEqual([
      "silver",
      "gold",
      "sapphire",
    ]);
    expect(result.persistent.minimumCoinTier).toBe(3);
    expect(
      result.finalGrid.flat().filter((cell) => cell.kind === "coin").every(
        (cell) => cell.kind === "coin" && ["sapphire", "ruby", "diamond"].includes(cell.tier),
      ),
    ).toBe(true);
  });

  it("Mystery sırasında açılan asa kendisinden hemen sonraki coin'e uygulanır", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("mystery", "mystery-upgrader");
    grid[1][0] = allahFeatureCell("mystery", "mystery-next-coin");
    const randomValues = [0.986, 0, 0];
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "ordered-upgrader-test" },
      () => randomValues.shift() ?? 0.999,
    );
    const firstRevealIndex = result.events.findIndex(
      (event) => event.type === "mystery-reveal" && event.cells[0]?.row === 0 && event.cells[0]?.column === 0,
    );
    const upgradeIndex = result.events.findIndex(
      (event) => event.type === "coin-upgrader-charge" && event.payload.complete === true,
    );
    const nextRollIndex = result.events.findIndex(
      (event) => event.type === "mystery-roll" && event.cells[0]?.row === 1 && event.cells[0]?.column === 0,
    );
    expect(firstRevealIndex).toBeLessThan(upgradeIndex);
    expect(upgradeIndex).toBeLessThan(nextRollIndex);
    expect(result.finalGrid[1][0]).toEqual(
      expect.objectContaining({ kind: "coin", tier: "silver" }),
    );
  });

  it("redrop normal sembolleri yenilerken coin ve collector hücrelerini korur", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahCoinCell("gold", 25, "kept-coin");
    grid[0][1] = { ...allahFeatureCell("collector", "kept-collector"), kind: "collector", super: false };
    grid[0][2] = allahFeatureCell("redrop", "redrop");
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "redrop-test" },
      createSeededAllahRandom(8),
    );
    const redropStage = result.events.find((event) => event.type === "redrop-fall");
    expect(redropStage?.grid.flat().some((cell) => cell.id === "kept-coin")).toBe(true);
    expect(redropStage?.grid.flat().some((cell) => cell.id === "kept-collector")).toBe(true);
    expect(result.events.some((event) => event.type === "redrop-clear")).toBe(true);
    expect(result.events.some((event) => event.type === "redrop-fall")).toBe(true);
  });

  it("Super Collector yeniden dönen tahta üzerinde iki toplama geçişi çalıştırır", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahCoinCell("silver", 10, "coin");
    grid[0][1] = { ...allahFeatureCell("collector", "super"), kind: "collector", super: true };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "super-test" },
      () => 0,
    );
    expect(result.events.filter(
      (event) => event.type === "collector-wake" && event.payload.collectorId === "super",
    )).toHaveLength(2);
    expect(result.events.some((event) => event.type === "super-collector-reset")).toBe(true);
    expect(result.collectorValues.super).toBeGreaterThan(10);
  });

  it("Kaderin Hükmü ilk 5×6 alanın tamamını Mystery getirir", () => {
    const result = runAllahSpin(
      { wager: 1, mode: "fate", runId: "fate-full-board" },
      () => 0,
    );
    expect(result.initialGrid.flat().every((cell) => cell.kind === "mystery")).toBe(true);
    const reveals = result.events.filter(
      (event) => event.type === "mystery-reveal" && event.payload.source === "fate",
    );
    expect(reveals).toHaveLength(30);
    expect(reveals.every((event) => event.cells.length === 1)).toBe(true);
    expect(reveals.map((event) => event.cells[0])).toEqual(
      Array.from({ length: 5 }, (_, column) =>
        Array.from({ length: 6 }, (_, row) => ({ row, column })),
      ).flat(),
    );
    expect(reveals.every((event) => {
      const target = event.cells[0];
      const cell = event.grid[target.row][target.column];
      return cell.kind !== "symbol" && cell.fromMystery === true;
    })).toBe(true);
    expect(result.collectorWinX).toBe(0);
    expect(result.coinWinX).toBe(30);
    expect(result.grossMultiplier).toBe(30);
  });

  it("Mystery normal makaraya kendiliğinden inmez; yalnız Göz/FU/Collector tarafından üretilir", () => {
    const modes = ["base", "enhancer", "degen", "trickster", "bonus-buy", "super-bonus-buy"] as const;
    for (const mode of modes) {
      for (let seed = 1; seed <= 32; seed += 1) {
        const result = runAllahSpin(
          { wager: 1, mode, runId: `no-natural-mystery-${mode}-${seed}` },
          createSeededAllahRandom(seed),
        );
        expect(result.initialGrid.flat().some((cell) => cell.kind === "mystery")).toBe(false);
      }
    }
  });

  it("Coin, Collector, anahtar, çarpan, yükseltici, Redrop ve Max Coin normal makaraya doğrudan inmez", () => {
    const modes = ["base", "enhancer", "degen", "trickster", "bonus-buy", "super-bonus-buy"] as const;
    const mysteryOnlyKinds = new Set([
      "coin",
      "global-key",
      "collector",
      "multiplier",
      "upgrader",
      "redrop",
      "max-coin",
    ]);
    for (const mode of modes) {
      for (let seed = 1; seed <= 64; seed += 1) {
        const result = runAllahSpin(
          { wager: 1, mode, runId: `direct-strip-${mode}-${seed}` },
          createSeededAllahRandom(seed),
        );
        expect(
          result.initialGrid.flat().some((cell) => mysteryOnlyKinds.has(cell.kind)),
        ).toBe(false);
        expect(
          result.initialGrid.flat().some(
            (cell) => cell.kind === "symbol" && cell.symbol === "celestial-key",
          ),
        ).toBe(false);
      }
    }
  });

  it("Hilebaz dönüş normal oyundan belirgin biçimde daha fazla Eye ve bonus girişi üretir", () => {
    let baseEyes = 0;
    let tricksterEyes = 0;
    let baseBonuses = 0;
    let tricksterBonuses = 0;
    for (let seed = 1; seed <= 180; seed += 1) {
      const base = runAllahSpin(
        { wager: 1, mode: "base", runId: `base-frequency-${seed}` },
        createSeededAllahRandom(seed * 17),
      );
      const trickster = runAllahSpin(
        { wager: 1, mode: "trickster", runId: `trickster-frequency-${seed}` },
        createSeededAllahRandom(seed * 17),
      );
      baseEyes += base.initialGrid.flat().filter((cell) => cell.kind === "eye").length;
      tricksterEyes += trickster.initialGrid.flat().filter((cell) => cell.kind === "eye").length;
      baseBonuses += base.triggeredBonus ? 1 : 0;
      tricksterBonuses += trickster.triggeredBonus ? 1 : 0;
    }
    expect(tricksterEyes).toBeGreaterThan(baseEyes * 5);
    expect(tricksterBonuses).toBeGreaterThan(baseBonuses);
  });

  it("Mystery'den çıkan işlev sembolü görevinden sonra yeniden dönüp coin olur", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { ...allahFeatureCell("upgrader", "temporary-upgrader"), fromMystery: true };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "modifier-becomes-coin" },
      () => 0,
    );
    const chargeIndex = result.events.findIndex((event) => event.type === "coin-upgrader-charge");
    const rollIndex = result.events.findIndex((event) => event.type === "modifier-coin-roll");
    const landIndex = result.events.findIndex((event) => event.type === "modifier-coin-land");
    expect(chargeIndex).toBeGreaterThan(-1);
    expect(chargeIndex).toBeLessThan(rollIndex);
    expect(rollIndex).toBeLessThan(landIndex);
    expect(result.finalGrid[0][0]).toEqual(
      expect.objectContaining({ kind: "coin", tier: "silver", fromMystery: true }),
    );
  });

  it("Mystery Collector coin'e dönüşmez ve tüm diğer Mystery sonuçları okunduktan sonra çalışır", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { ...allahFeatureCell("upgrader", "upgrader-before-bag"), fromMystery: true };
    grid[0][1] = {
      ...allahFeatureCell("collector", "mystery-bag"),
      kind: "collector",
      super: false,
      fromMystery: true,
    };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "collector-after-modifier-reroll" },
      () => 0,
    );
    const coinLandIndex = result.events.findIndex((event) => event.type === "modifier-coin-land");
    const collectorIndex = result.events.findIndex((event) => event.type === "collector-wake");
    expect(coinLandIndex).toBeGreaterThan(-1);
    expect(coinLandIndex).toBeLessThan(collectorIndex);
    expect(result.collectorValues["mystery-bag"]).toBeGreaterThan(0);
    expect(
      result.events.some(
        (event) => event.type === "modifier-coin-roll" && event.payload.previousKind === "collector",
      ),
    ).toBe(false);
  });

  it("Mystery hiçbir koşulda normal ödeme sembolü üretmez ve kökenini korur", () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const grid = createAllahGrid(uniqueSymbols);
      grid[0][0] = allahFeatureCell("mystery", `feature-only-mystery-${seed}`);
      const result = runAllahSpin(
        { wager: 1, forcedGrid: grid, runId: `mystery-feature-only-${seed}` },
        createSeededAllahRandom(seed),
      );
      const reveals = result.events.filter((event) => event.type === "mystery-reveal");
      expect(reveals.length).toBeGreaterThan(0);
      for (const reveal of reveals) {
        const target = reveal.cells[0];
        expect(reveal.payload.revealedKind).not.toBe("symbol");
        expect(reveal.grid[target.row][target.column]).toEqual(
          expect.objectContaining({ fromMystery: true }),
        );
      }
    }
  });

  it("Nur Gözü makarada kalır, alanı tarar ve Mystery sonuçlarını sırayla açar", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("eye", "legacy-eye-trigger");
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "side-eye-test" },
      () => 0.999,
    );
    expect(result.initialGrid.flat().some((cell) => cell.kind === "eye")).toBe(true);
    const eventTypes = result.events.map((event) => event.type);
    expect(eventTypes.indexOf("eye-look-left")).toBeLessThan(eventTypes.indexOf("eye-look-right"));
    expect(eventTypes.indexOf("eye-look-right")).toBeLessThan(eventTypes.indexOf("eye-look-down-grid"));
    const seeded = result.events.filter(
      (event) => event.type === "mystery-seed" && event.payload.source === "eye",
    );
    const reveals = result.events.filter(
      (event) => event.type === "mystery-reveal" && event.payload.source === "eye",
    );
    expect(seeded.length).toBeGreaterThan(0);
    expect(reveals).toHaveLength(seeded.length);
    expect(reveals.every((event) => event.cells.length === 1)).toBe(true);
  });

  it("Semavi Anahtar üç haneyi sırayla çevirip toplamını globale aktarır", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[2][2] = allahFeatureCell("global-key", "key");
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "key-three-slots" },
      () => 0.51,
    );
    const locks = result.events.filter((event) => event.type === "key-slot-lock");
    expect(locks).toHaveLength(3);
    expect(locks.map((event) => event.payload.slot)).toEqual([0, 1, 2]);
    expect(result.globalKeySlots.every((value) => typeof value === "number")).toBe(true);
    expect(result.globalMultiplier).toBe(
      result.globalKeySlots.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    );
  });

  it("aynı zincirdeki her Semavi Anahtar üç haneyi yeniden çevirip biriktirir", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("global-key", "key-a");
    grid[0][1] = allahFeatureCell("global-key", "key-b");
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "single-key-test" },
      () => 0.999,
    );
    expect(result.initialGrid.flat().filter((cell) => cell.kind === "global-key")).toHaveLength(2);
    expect(result.events.filter((event) => event.type === "key-flight")).toHaveLength(2);
    const locks = result.events.filter((event) => event.type === "key-slot-lock");
    expect(locks).toHaveLength(6);
    expect(locks.map((event) => event.payload.slot)).toEqual([0, 1, 2, 0, 1, 2]);
    expect(locks.map((event) => event.payload.keyRound)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(result.globalKeySlots).toEqual([40, 40, 40]);
    expect(result.globalMultiplier).toBe(100);
  });

  it("Mystery içinden gelen Göz yeni Mystery alanları açarak zinciri sürdürür", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { id: "nested-eye-seed", kind: "mystery", source: "eye" };
    const result = runAllahSpin(
      {
        wager: 1,
        mode: "trickster",
        forcedGrid: grid,
        runId: "nested-eye-chain",
        tuning: {
          maxFeatureCycles: 2,
          mysteryWeights: {
            coin: 0,
            eye: 1,
            collector: 0,
            upgrader: 0,
            redrop: 0,
            multiplier: 0,
            scatter: 0,
            key: 0,
            maxCoin: 0,
          },
        },
      },
      () => 0.5,
    );
    expect(result.events.some(
      (event) => event.type === "mystery-reveal" && event.payload.revealedKind === "eye",
    )).toBe(true);
    expect(result.events.some((event) => event.type === "eye-wake")).toBe(true);
    expect(result.events.some(
      (event) => event.type === "mystery-seed" && event.payload.source === "eye",
    )).toBe(true);
  });

  it("coin rengi çarpılmış yüz değerinin katmanını izler", () => {
    expect(allahCoinTierForValue(1)).toBe("bronze");
    expect(allahCoinTierForValue(10)).toBe("silver");
    expect(allahCoinTierForValue(150)).toBe("sapphire");
    expect(allahCoinTierForValue(750)).toBe("ruby");
    expect(allahCoinTierForValue(10_000)).toBe("diamond");
  });

  it("Collector yalnız o anda aktif Mystery kökenli hücreleri yeniden döndürür", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { ...allahCoinCell("silver", 10, "mystery-coin"), fromMystery: true };
    grid[0][1] = {
      ...allahFeatureCell("collector", "collector"),
      kind: "collector",
      super: false,
      fromMystery: true,
    };
    grid[0][2] = allahCoinCell("gold", 25, "direct-coin");
    const untouchedSymbolId = grid[1][4].id;
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "collector-refill-test" },
      () => 0.999,
    );
    const refill = result.events.find(
      (event) => event.type === "mystery-seed" && event.payload.source === "collector",
    );
    expect(refill?.cells).toEqual([{ row: 0, column: 0 }]);
    expect(refill?.cells.every(({ row, column }) => refill.grid[row][column].kind === "mystery")).toBe(true);
    expect(result.finalGrid.flat().some((cell) => cell.id === "mystery-coin")).toBe(false);
    expect(result.finalGrid.flat().some((cell) => cell.id === "direct-coin")).toBe(true);
    expect(result.finalGrid.flat().some((cell) => cell.id === untouchedSymbolId)).toBe(true);
    expect(result.collectorValues.collector).toBe(35);
  });

  it("kese gelmese bile son tahtada kalan coin değerlerinin tamamını öder", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahCoinCell("silver", 10, "direct-coin-a");
    grid[5][4] = allahCoinCell("gold", 25, "direct-coin-b");
    const result = runAllahSpin(
      { wager: 2, forcedGrid: grid, runId: "board-coins-pay-without-collector" },
      () => 0.999,
    );
    expect(result.collectorWinX).toBe(0);
    expect(result.coinWinX).toBe(35);
    expect(result.grossMultiplier).toBe(result.lineWinX + 35);
    expect(result.payout).toBe((result.lineWinX + 35) * 2);
  });

  it("kesenin topladığı eski coin'lerle yeniden dönen tahtadaki coin'leri bir kez sayar", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { ...allahCoinCell("silver", 10, "collected-coin"), fromMystery: true };
    grid[0][1] = {
      ...allahFeatureCell("collector", "collector-once"),
      kind: "collector",
      super: false,
      fromMystery: true,
    };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "collector-plus-final-board" },
      () => 0,
    );
    expect(result.collectorWinX).toBe(10);
    expect(result.coinWinX).toBe(1);
    expect(result.grossMultiplier).toBe(result.lineWinX + 11);
  });

  it("Collector coin değerlerini okuma sırasıyla tek tek keseye taşır", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[4][0] = allahCoinCell("silver", 10, "coin-a");
    grid[1][2] = allahCoinCell("gold", 25, "coin-b");
    grid[3][4] = { ...allahFeatureCell("collector", "bag"), kind: "collector", super: false };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "collector-order" },
      () => 0.999,
    );
    const flights = result.events.filter(
      (event) => event.type === "coin-flight" && event.payload.collectorId === "bag",
    );
    expect(flights.map((event) => event.cells[0])).toEqual([
      { row: 4, column: 0 },
      { row: 1, column: 2 },
    ]);
    expect(flights.map((event) => event.payload.value)).toEqual([10, 25]);
    expect(result.collectorValues.bag).toBe(35);
  });

  it("okuma sırasındaki ikinci kese ilk kesede biriken değeri de toplar", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahCoinCell("silver", 10, "shared-coin");
    grid[1][0] = { ...allahFeatureCell("collector", "bag-a"), kind: "collector", super: false };
    grid[2][0] = { ...allahFeatureCell("collector", "bag-b"), kind: "collector", super: false };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "collector-collects-collector" },
      () => 0.999,
    );
    expect(result.collectorValues["bag-a"]).toBe(10);
    expect(result.collectorValues["bag-b"]).toBe(20);
    const bagBFlights = result.events.filter(
      (event) => event.type === "coin-flight" && event.payload.collectorId === "bag-b",
    );
    expect(bagBFlights.map((event) => event.payload.sourceKind)).toEqual(["coin", "collector"]);
  });

  it("global multiplier çizgi ve collector toplamının tamamına uygulanır", () => {
    const grid = createAllahGrid(uniqueSymbols);
    for (let column = 0; column < 3; column += 1)
      grid[0][column] = allahSymbolCell("hand-of-blessing", `hand-${column}`);
    grid[1][0] = allahCoinCell("bronze", 2, "coin");
    grid[1][1] = { ...allahFeatureCell("collector", "collector"), kind: "collector", super: false };
    const result = runAllahSpin(
      {
        wager: 1,
        forcedGrid: grid,
        runId: "global-test",
        persistent: { globalMultiplier: 3 },
      },
      () => 0,
    );
    expect(result.grossMultiplier).toBe(
      (result.lineWinX + result.coinWinX + result.collectorWinX) * 3,
    );
    const rowEvents = result.events.filter(
      (event) => event.type === "global-row-charge" || event.type === "global-row-apply",
    );
    expect(rowEvents.map((event) => event.type)).toEqual([
      "global-row-charge",
      "global-row-apply",
    ]);
    expect(rowEvents.every((event) => event.payload.row === 1)).toBe(true);
    expect(rowEvents.every((event) => event.payload.multiplier === 3)).toBe(true);
    expect(rowEvents[0].globalAppliedValues).toEqual({});
    expect(rowEvents[1].globalAppliedValues).toEqual({ collector: 6 });
    expect(rowEvents[1].cells).toEqual([{ row: 1, column: 1 }]);
    expect(result.globalAppliedValues).toEqual({ collector: 6 });
  });

  it("global çarpanı ödeme öncesinde coin bulunan satırlara yukarıdan aşağı uygular", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[4][3] = allahCoinCell("silver", 10, "lower-coin");
    grid[1][0] = allahCoinCell("bronze", 2, "upper-coin-a");
    grid[1][4] = allahCoinCell("bronze", 3, "upper-coin-b");
    const result = runAllahSpin(
      {
        wager: 1,
        forcedGrid: grid,
        runId: "global-row-order",
        persistent: { globalMultiplier: 5 },
      },
      () => 0.999,
    );
    const rowEvents = result.events.filter(
      (event) => event.type === "global-row-charge" || event.type === "global-row-apply",
    );
    expect(rowEvents.map((event) => [event.type, event.payload.row])).toEqual([
      ["global-row-charge", 1],
      ["global-row-apply", 1],
      ["global-row-charge", 4],
      ["global-row-apply", 4],
    ]);
    expect(rowEvents[1].payload).toMatchObject({ before: 5, multiplier: 5, after: 25 });
    expect(rowEvents[3].payload).toMatchObject({ before: 10, multiplier: 5, after: 50 });
    expect(result.globalAppliedValues).toEqual({
      "upper-coin-a": 10,
      "upper-coin-b": 15,
      "lower-coin": 50,
    });
    const payoutIndex = result.events.findIndex((event) => event.type === "payout-count");
    const lastApplyIndex = result.events.reduce(
      (latest, event, index) => event.type === "global-row-apply" ? index : latest,
      -1,
    );
    expect(lastApplyIndex).toBeLessThan(payoutIndex);
  });

  it("Hilebaz Dönüşünde oluşan global anahtar coinleri gerçek sonuçla aynı şekilde satır satır çarpar", () => {
    const result = runAllahSpin(
      {
        wager: 1,
        mode: "trickster",
        runId: "trickster-global-row-regression",
        persistent: defaultAllahPersistentState(),
      },
      createSeededAllahRandom(73),
    );
    const rows = result.events.filter((event) => event.type === "global-row-apply");
    expect(result.globalMultiplier).toBe(3);
    expect(rows.map((event) => Number(event.payload.row))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rows.map((event) => [event.payload.before, event.payload.after])).toEqual([
      [13, 39],
      [7, 21],
      [8, 24],
      [22, 66],
      [6, 18],
      [7, 21],
    ]);
    expect(rows.every((event) => Number(event.payload.after) === Number(event.payload.before) * 3)).toBe(true);
    expect(result.coinWinX).toBe(63);
    expect(result.grossMultiplier).toBe(189);
  });

  it("düz/V beş scatter Mitik Lütuf açar", () => {
    const grid = createAllahGrid(uniqueSymbols);
    [0, 1, 2, 1, 0].forEach((row, column) => {
      grid[row][column] = allahFeatureCell("scatter", `scatter-${column}`);
    });
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "mythic-test" },
      createSeededAllahRandom(1),
    );
    expect(result.triggeredBonus).toBe("mythic");
    expect(result.events.some((event) => event.type === "bonus-portal")).toBe(true);
  });

  it("bonus içindeki scatter modu bir üst seviyeye yükseltir", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("scatter", "scatter");
    const result = runAllahSpin(
      {
        wager: 1,
        forcedGrid: grid,
        runId: "bonus-upgrade-test",
        bonus: { tier: "super", remaining: 5, totalSpins: 5, totalPayout: 0 },
      },
      createSeededAllahRandom(2),
    );
    expect(result.bonusUpgrade).toBe("legendary");
    expect(result.nextBonus).toEqual(expect.objectContaining({ tier: "legendary", remaining: 4 }));
  });

  it("Mitik garantili yükselticiyi normal makaraya değil ilk Mystery açılışına koyar", () => {
    const normalResult = runAllahSpin(
      {
        wager: 1,
        mode: "base",
        runId: "mythic-no-direct-upgrader",
        bonus: { tier: "mythic", remaining: 10, totalSpins: 0, totalPayout: 0 },
        persistent: { mythicUpgraderPending: true },
      },
      () => 0.999,
    );
    expect(normalResult.initialGrid.flat().some((cell) => cell.kind === "upgrader")).toBe(false);
    expect(normalResult.persistent.mythicUpgraderPending).toBe(true);

    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("mystery", "mythic-first-mystery");
    const featureResult = runAllahSpin(
      {
        wager: 1,
        mode: "base",
        runId: "mythic-feature-upgrader",
        forcedGrid: grid,
        bonus: { tier: "mythic", remaining: 9, totalSpins: 1, totalPayout: 0 },
        persistent: { mythicUpgraderPending: true },
      },
      () => 0.999,
    );
    const firstReveal = featureResult.events.find((event) => event.type === "mystery-reveal");
    expect(firstReveal?.payload.revealedKind).toBe("upgrader");
    expect(firstReveal?.grid[0][0]).toEqual(
      expect.objectContaining({ kind: "upgrader", fromMystery: true }),
    );
    expect(featureResult.persistent.mythicUpgraderPending).toBe(false);
  });

  it("max coin ödemeyi 500.000× üst sınıra götürür", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = allahFeatureCell("max-coin", "max");
    const result = runAllahSpin(
      { wager: 2, forcedGrid: grid, runId: "max-test" },
      createSeededAllahRandom(3),
    );
    expect(result.grossMultiplier).toBe(ALLAH_MAX_WIN_X);
    expect(result.payout).toBe(1_000_000);
    expect(result.maxWin).toBe(true);
  });

  it("max coin daha sonra Collector respin'iyle kapanırsa bile 500.000× hakkını korur", () => {
    const grid = createAllahGrid(uniqueSymbols);
    grid[0][0] = { ...allahFeatureCell("max-coin", "max-before-collect"), fromMystery: true };
    grid[0][1] = {
      ...allahFeatureCell("collector", "max-collector"),
      kind: "collector",
      super: false,
      fromMystery: true,
    };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "max-survives-refill" },
      () => 0,
    );
    expect(result.finalGrid.flat().some((cell) => cell.kind === "max-coin")).toBe(false);
    expect(result.grossMultiplier).toBe(ALLAH_MAX_WIN_X);
    expect(result.maxWin).toBe(true);
  });

  it("coin, Collector ve toplam kazancı ara hesaplarda da 500.000× ile sınırlar", () => {
    const grid = createAllahGrid(() => allahCoinCell("diamond", 50_000));
    grid[0][0] = { ...allahFeatureCell("multiplier", "cap-multiplier"), kind: "multiplier", value: 20 };
    grid[5][4] = { ...allahFeatureCell("collector", "cap-collector"), kind: "collector", super: false };
    const result = runAllahSpin(
      { wager: 1, forcedGrid: grid, runId: "intermediate-cap-test" },
      () => 0.999,
    );
    expect(result.collectorWinX).toBeLessThanOrEqual(ALLAH_MAX_WIN_X);
    expect(Math.max(...Object.values(result.collectorValues))).toBeLessThanOrEqual(ALLAH_MAX_WIN_X);
    expect(
      result.events
        .filter((event) => event.type === "board-multiplier-apply")
        .every((event) => Number(event.payload.after) <= ALLAH_MAX_WIN_X),
    ).toBe(true);
    expect(result.grossMultiplier).toBeLessThanOrEqual(ALLAH_MAX_WIN_X);
  });

  it("admin profili normal spindeki Eye ve Scatter oranlarini ayri degistirir", () => {
    const noFeature = runAllahSpin(
      {
        wager: 1,
        mode: "base",
        runId: "admin-no-feature",
        tuning: {
          reelEyeChancePercent: {
            base: 0,
            enhancer: 0,
            degen: 0,
            trickster: 0,
            fate: 0,
            "bonus-buy": 0,
            "super-bonus-buy": 0,
          },
          reelScatterChancePercent: {
            base: 0,
            enhancer: 0,
            degen: 0,
            trickster: 0,
            fate: 0,
            "bonus-buy": 0,
            "super-bonus-buy": 0,
          },
        },
      },
      createSeededAllahRandom(91),
    );
    expect(noFeature.initialGrid.flat().every((cell) => cell.kind === "symbol")).toBe(true);

    const allEyes = runAllahSpin(
      {
        wager: 1,
        mode: "base",
        runId: "admin-all-eyes",
        tuning: {
          reelEyeChancePercent: {
            base: 100,
            enhancer: 100,
            degen: 100,
            trickster: 100,
            fate: 0,
            "bonus-buy": 100,
            "super-bonus-buy": 100,
          },
          reelScatterChancePercent: {
            base: 0,
            enhancer: 0,
            degen: 0,
            trickster: 0,
            fate: 0,
            "bonus-buy": 0,
            "super-bonus-buy": 0,
          },
        },
      },
      createSeededAllahRandom(92),
    );
    expect(allEyes.initialGrid.flat().every((cell) => cell.kind === "eye")).toBe(true);
  });

  it("admin profili maliyet ve odeme tavanini degistirebilir", () => {
    expect(allahPurchaseCost(25, "enhancer", { enhancer: 7 })).toBe(175);
    const grid = createAllahGrid(() => allahCoinCell("diamond", 50_000));
    const result = runAllahSpin(
      {
        wager: 2,
        forcedGrid: grid,
        runId: "admin-cap",
        tuning: { maxWinX: 250, coinPayoutScale: 2 },
      },
      createSeededAllahRandom(93),
    );
    expect(result.grossMultiplier).toBe(250);
    expect(result.payout).toBe(500);
    expect(result.maxWin).toBe(true);
  });
});
