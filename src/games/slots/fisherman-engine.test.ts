import { describe, expect, it } from "vitest";
import {
  advanceFisherBonus,
  createFisherBonus,
  createFisherBonusPickDeck,
  evaluateFisherGrid,
  spinFisher,
  type FisherCell,
} from "./fisherman-engine";

const empty = (): FisherCell[][] =>
  Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => ({ id: "anchor" as const })),
  );

describe("Kaptan Mercan matematik motoru", () => {
  it("3/4/5 scatter için 10/15/20 ücretsiz spin verir", () => {
    for (const [scatterCount, spins] of [
      [3, 10],
      [4, 15],
      [5, 20],
    ] as const) {
      const grid = empty();
      for (let reel = 0; reel < scatterCount; reel += 1)
        grid[reel % 4][reel] = { id: "scatter" };
      expect(
        evaluateFisherGrid(grid, 100, { allowHook: false }).bonusSpins,
      ).toBe(spins);
    }
  });

  it("kaptan bütün görünür para balıklarını mevcut bonus çarpanıyla bir kez toplar", () => {
    const grid = empty();
    grid[0][0] = { id: "money-fish", cashMultiplier: 3 };
    grid[1][2] = { id: "money-fish", cashMultiplier: 10 };
    grid[3][4] = { id: "captain" };
    const result = evaluateFisherGrid(grid, 20, {
      bonus: true,
      bonusMultiplier: 3,
      allowHook: false,
    });
    expect(result.collectedFishMultiplier).toBe(39);
    expect(result.grossPayout).toBeGreaterThanOrEqual(780);
  });

  it("normal oyunda kaptan görünür para balığını 1x ile toplar", () => {
    const grid = empty();
    grid[1][3] = { id: "money-fish", cashMultiplier: 9 };
    grid[0][0] = { id: "captain" };
    const result = evaluateFisherGrid(grid, 100, { allowHook: false });
    expect(result.captainCount).toBe(1);
    expect(result.fishValues).toEqual([9]);
    expect(result.collectedFishMultiplier).toBe(9);
    expect(result.grossPayout).toBeGreaterThanOrEqual(900);
  });

  it("bonusta üç fener yalnız ayarlanan retrigger spinini verir", () => {
    const grid = empty();
    grid[0][0] = { id: "scatter" };
    grid[1][1] = { id: "scatter" };
    grid[2][2] = { id: "scatter" };
    const result = evaluateFisherGrid(grid, 100, {
      bonus: true,
      allowHook: false,
      tuning: { retriggerSpins: 5 },
    });
    expect(result.bonusSpins).toBe(5);
  });

  it("her spinde fener gelse bile bonus oturumu güvenlik sınırında biter", () => {
    const grid = empty();
    grid[0][0] = { id: "scatter" };
    grid[1][1] = { id: "scatter" };
    grid[2][2] = { id: "scatter" };
    const retrigger = evaluateFisherGrid(grid, 100, {
      bonus: true,
      allowHook: false,
      tuning: { retriggerSpins: 5 },
    });
    const tuning = {
      retriggerSpins: 5,
      maxBonusSessionSpins: 20,
      stageInterval: 4,
      stageAwardSpins: 10,
      stageMultipliers: [1, 2, 3, 10],
    };
    let state = createFisherBonus("bounded", 15, "natural", {}, tuning);
    let played = 0;
    while (state.spinsRemaining > 0 && played < 100) {
      state = advanceFisherBonus(state, retrigger, tuning).state;
      played += 1;
    }
    expect(played).toBe(20);
    expect(state.spinsRemaining).toBe(0);
  });

  it("aynı ekrandaki her kaptan görünür balıkları ayrı ayrı toplar", () => {
    const grid = empty();
    grid[0][0] = { id: "money-fish", cashMultiplier: 3 };
    grid[1][2] = { id: "money-fish", cashMultiplier: 7 };
    grid[2][3] = { id: "captain" };
    grid[3][4] = { id: "captain" };
    const result = evaluateFisherGrid(grid, 20, {
      bonus: true,
      bonusMultiplier: 2,
      allowHook: false,
    });
    expect(result.collectedFishMultiplier).toBe(40);
    expect(result.captainCells).toHaveLength(2);
    expect(result.fishCells).toEqual(
      expect.arrayContaining([
        { row: 0, reel: 0, value: 3 },
        { row: 1, reel: 2, value: 7 },
      ]),
    );
  });

  it("sefer fermanlarında beş farklı güçlendirme ve bir çizme bulunur", () => {
    const deck = createFisherBonusPickDeck(() => 0.42);
    expect(deck).toHaveLength(6);
    expect(new Set(deck.map((card) => card.reward)).size).toBe(6);
    expect(deck.some((card) => card.reward === "boot")).toBe(true);
  });

  it("2x başlangıç ve +2 sefer fermanlarını bonus durumuna uygular", () => {
    const state = createFisherBonus(
      "mission",
      10,
      "natural",
      {
        "start-level-two": true,
        "extra-spins": true,
      },
      { stageInterval: 4, stageMultipliers: [1, 2, 3, 10] },
    );
    expect(state.spinsRemaining).toBe(12);
    expect(state.captainsCollected).toBe(4);
    expect(state.stage).toBe(1);
    expect(state.multiplier).toBe(2);
  });

  it("yeni çarpan paketini mevcut kademe bittikten sonra başlatır", () => {
    const result = spinFisher(25, { bonus: true, random: () => 0.1 });
    result.captainCount = 4;
    let progress = advanceFisherBonus(
      createFisherBonus("bonus", 2, "natural"),
      result,
    );
    expect(progress.extraSpins).toBe(10);
    expect(progress.state.multiplier).toBe(1);
    expect(progress.state.currentBatchRemaining).toBe(1);
    expect(progress.state.queuedBatches).toEqual([
      { stage: 1, multiplier: 2, spins: 10 },
    ]);
    progress = advanceFisherBonus(progress.state, {
      ...result,
      captainCount: 0,
      scatterCount: 0,
    });
    expect(progress.state.multiplier).toBe(2);
    expect(progress.state.stage).toBe(1);
    expect(progress.state.currentBatchRemaining).toBe(10);
    expect(progress.state.spinsRemaining).toBe(10);
  });

  it("satın alınan girişte zorlanan scatter sayısını üretir", () => {
    expect(
      spinFisher(25, { forceScatters: 4, random: () => 0.42 }).scatterCount,
    ).toBeGreaterThanOrEqual(4);
  });

  it("bonus dahil uzun örnekte kasa eğilimini ve bonus erişilebilirliğini korur", () => {
    let seed = 0x4d455243;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const rounds = 50_000;
    const wager = 100;
    let payout = 0;
    let bonuses = 0;
    let freeSpins = 0;
    for (let round = 0; round < rounds; round += 1) {
      const base = spinFisher(wager, { random });
      payout += base.grossPayout;
      if (!base.bonusSpins) continue;
      bonuses += 1;
      let state = createFisherBonus(`sim-${round}`, base.bonusSpins, "natural");
      while (state.spinsRemaining > 0 && state.spinsPlayed < 250) {
        const free = spinFisher(wager, {
          bonus: true,
          bonusMultiplier: state.multiplier,
          random,
        });
        payout += free.grossPayout;
        freeSpins += 1;
        state = advanceFisherBonus(state, free).state;
      }
    }
    const rtp = payout / (rounds * wager);
    console.info(
      `Kaptan Mercan · bonus dahil örnek RTP %${(rtp * 100).toFixed(2)} · bonus ${bonuses} · free spin ${freeSpins}`,
    );
    expect(bonuses).toBeGreaterThan(35);
    expect(rtp).toBeGreaterThan(0.65);
    expect(rtp).toBeLessThan(1.15);
  });
});
