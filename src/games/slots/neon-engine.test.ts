import { describe, expect, it } from "vitest";
import {
  bonusFreeSpinsFor,
  findNeonClusters,
  freeSpinsFor,
  randomPowerValue,
  runNeonSpin,
  type NeonSymbolId,
} from "./neon-engine";

const cubeWithoutPower = (max: number) => (max === 10_000 ? max - 1 : 0);

describe("Neon Kasası cluster/cascade motoru", () => {
  it("yalnız yatay/dikey bağlı beşli kümeleri bulur", () => {
    const grid = Array.from(
      { length: 7 },
      () => Array(7).fill("scatter") as NeonSymbolId[][][number],
    );
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ].forEach(([row, column]) => {
      grid[row][column] = "cube";
    });
    grid[4][4] = "gem";
    grid[5][5] = "gem";
    grid[6][6] = "gem";
    const clusters = findNeonClusters(grid);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].symbol).toBe("cube");
    expect(clusters[0].cells).toHaveLength(5);
  });

  it("cascade güvenlik sınırını taşır", () => {
    const result = runNeonSpin(25, cubeWithoutPower);
    expect(result.cascades).toHaveLength(16);
    expect(
      result.cascades[0].fallRows.flat().some((distance) => distance > 0),
    ).toBe(true);
  });

  it("patlamayan üst sembollerin kimliğini ve gerçek düşüş mesafesini korur", () => {
    let symbolCall = 0;
    const palette = [0, 20, 38, 55, 71, 84, 94];
    const random = (max: number) => {
      if (max === 10_000) return 9999;
      const row = Math.floor(symbolCall / 7);
      const column = symbolCall % 7;
      symbolCall += 1;
      return row === 6 && column < 5
        ? 0
        : palette[(row + column) % palette.length] % max;
    };
    const result = runNeonSpin(25, random);
    expect(result.cascades[0].sourceRows[6][0]).toBe(5);
    expect(result.cascades[0].fallRows[6][0]).toBe(1);
  });

  it("dört MIRA scatter ile bonusu açar ve fazlasını kademelendirir", () => {
    expect(freeSpinsFor(3)).toBe(0);
    expect(freeSpinsFor(4)).toBe(15);
    expect(freeSpinsFor(5)).toBe(20);
    expect(freeSpinsFor(6)).toBe(25);
    expect(freeSpinsFor(7)).toBe(30);
    expect(bonusFreeSpinsFor(2)).toBe(0);
    expect(bonusFreeSpinsFor(3)).toBe(5);
  });

  it("yüksek çarpanları ağırlık tablosunun en nadir ucuna koyar", () => {
    expect(randomPowerValue(() => 0)).toBe(2);
    expect(randomPowerValue((max) => max - 1)).toBe(1000);
  });

  it("güçleri bütün tumble zincirinin sonunda bonus havuzuna toplar", () => {
    let powerCalls = 0;
    const random = (max: number) => {
      if (max === 10_000) {
        powerCalls += 1;
        return powerCalls <= 2 ? 0 : 9999;
      }
      return 0;
    };
    const result = runNeonSpin(25, random, {
      bonusMode: true,
      bonusMultiplier: 5,
    });
    expect(result.multiplierValues.length).toBeGreaterThanOrEqual(2);
    expect(result.powerSum).toBe(
      result.multiplierValues.reduce((sum, value) => sum + value, 0),
    );
    expect(result.appliedMultiplier).toBe(5 + result.powerSum);
    expect(result.finalBonusMultiplier).toBe(5 + result.powerSum);
    expect(result.grossReturn).toBeCloseTo(
      result.baseReturn * result.appliedMultiplier,
    );
  });

  it("ilk ekranda olmayan güç sonraki tumble ile inip zincirin sonuna katılır", () => {
    let tenThousandCalls = 0;
    let symbolCalls = 0;
    const palette = [0, 20, 38, 55, 71, 84, 94];
    const random = (max: number) => {
      if (max === 10_000) {
        tenThousandCalls += 1;
        if (tenThousandCalls === 99 || tenThousandCalls === 100) return 0;
        return 9999;
      }
      if (max === 100) return 99;
      const row = Math.floor(symbolCalls / 7);
      const column = symbolCalls % 7;
      symbolCalls += 1;
      return row === 6 && column < 5
        ? 0
        : palette[(row + column) % palette.length] % max;
    };
    const result = runNeonSpin(25, random);
    expect(result.initialPowerGrid.flat().every((value) => value === 0)).toBe(
      true,
    );
    expect(
      result.cascades[0].nextPowerGrid.flat().some((value) => value === 2),
    ).toBe(true);
    expect(result.multiplierValues).toContain(2);
    expect(result.grossReturn).toBeCloseTo(
      result.baseReturn * result.appliedMultiplier,
    );
  });

  it("temel spin matematik profilini sabit tohumla raporlar", () => {
    let state = 0x2f6e2b1;
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % max;
    };
    let gross = 0;
    let hits = 0;
    let secondCascades = 0;
    const sample = 10_000;
    for (let spin = 0; spin < sample; spin += 1) {
      const result = runNeonSpin(25, random);
      gross += result.grossReturn;
      if (result.grossReturn > 0) hits += 1;
      if (result.cascades.length >= 2) secondCascades += 1;
    }
    const baseRtp = gross / (sample * 25);
    console.info(
      `Neon Kasası · temel örnek RTP %${(baseRtp * 100).toFixed(2)} · hit %${((hits / sample) * 100).toFixed(2)} · 2+ cascade %${((secondCascades / sample) * 100).toFixed(2)}`,
    );
    expect(baseRtp).toBeGreaterThan(0.3);
    expect(baseRtp).toBeLessThan(1.2);
  });

  it("bedava spinler dahil örnek oturum profilini raporlar", () => {
    let state = 0x6d2b79f5;
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % max;
    };
    const wager = 25;
    const paidSpins = 50_000;
    let gross = 0;
    let bonusRounds = 0;
    let freeSpinCount = 0;
    for (let paid = 0; paid < paidSpins; paid += 1) {
      const base = runNeonSpin(wager, random);
      gross += base.grossReturn;
      let freeSpins = base.freeSpinsAwarded;
      let bonusMultiplier = 0;
      if (freeSpins) bonusRounds += 1;
      while (freeSpins > 0 && freeSpinCount < paidSpins * 80) {
        const bonus = runNeonSpin(wager, random, {
          bonusMode: true,
          bonusMultiplier,
        });
        gross += bonus.grossReturn;
        bonusMultiplier = bonus.finalBonusMultiplier;
        freeSpins = freeSpins - 1 + bonus.freeSpinsAwarded;
        freeSpinCount += 1;
      }
    }
    const sampledRtp = gross / (paidSpins * wager);
    console.info(
      `Neon Kasası · bonus dahil örnek RTP %${(sampledRtp * 100).toFixed(2)} · bonus turu ${bonusRounds} · bedava spin ${freeSpinCount}`,
    );
    expect(sampledRtp).toBeGreaterThan(0.55);
    expect(sampledRtp).toBeLessThan(1.2);
  }, 15_000);

  it("58,5× bedelli bonus satın alımının uzun örneklem profilini sınırlar", () => {
    let state = 0x71ad53c1;
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % max;
    };
    const wager = 25;
    const rounds = 3000;
    let gross = 0;
    for (let round = 0; round < rounds; round += 1) {
      let freeSpins = 15;
      let bonusMultiplier = 0;
      while (freeSpins > 0) {
        const result = runNeonSpin(wager, random, {
          bonusMode: true,
          bonusMultiplier,
        });
        gross += result.grossReturn;
        bonusMultiplier = result.finalBonusMultiplier;
        freeSpins = freeSpins - 1 + result.freeSpinsAwarded;
      }
    }
    const buyRtp = gross / (rounds * wager * 58.5);
    console.info(
      `Neon Kasası · bonus satın alma örnek RTP %${(buyRtp * 100).toFixed(2)}`,
    );
    expect(buyRtp).toBeGreaterThan(0.7);
    expect(buyRtp).toBeLessThan(1.15);
  }, 15_000);

  it("MIRA Boost ek maliyet dahil kasa eğilimli profilini korur", () => {
    let state = 0x4f1bbcdc;
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % max;
    };
    const wager = 25;
    const paidSpins = 30_000;
    let gross = 0;
    for (let paid = 0; paid < paidSpins; paid += 1) {
      const base = runNeonSpin(wager, random, { scatterBoost: true });
      gross += base.grossReturn;
      let freeSpins = base.freeSpinsAwarded;
      let bonusMultiplier = 0;
      while (freeSpins > 0) {
        const bonus = runNeonSpin(wager, random, {
          bonusMode: true,
          bonusMultiplier,
        });
        gross += bonus.grossReturn;
        bonusMultiplier = bonus.finalBonusMultiplier;
        freeSpins = freeSpins - 1 + bonus.freeSpinsAwarded;
      }
    }
    const boostRtp = gross / (paidSpins * wager * 1.25);
    console.info(
      `Neon Kasası · MIRA Boost örnek RTP %${(boostRtp * 100).toFixed(2)}`,
    );
    expect(boostRtp).toBeGreaterThan(0.7);
    expect(boostRtp).toBeLessThan(1.15);
  }, 15_000);
});
