import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_SETTINGS } from "../../data/casino-admin";
import { runSlotSimulation } from "./slot-simulation-engine";

describe("yönetici hızlı slot simülasyonu", () => {
  it("100 Kaptan Mercan free-spin oturumunun hiçbirini üst sınırdan uzun oynatmaz", () => {
    const game = DEFAULT_ADMIN_SETTINGS.games["kaptan-mercan"];
    const report = runSlotSimulation(
      {
        gameId: "kaptan-mercan",
        mode: "bonus-sessions",
        runs: 100,
        wager: 100,
        seed: 0x4d455243,
      },
      game,
    );
    expect(report.bonusSessions).toBe(100);
    expect(report.maxBonusLength).toBeLessThanOrEqual(
      game.slot!.math.maxBonusSessionSpins,
    );
    expect(report.averageBonusLength).toBeGreaterThan(0);
    expect(Number.isFinite(report.rtp)).toBe(true);
  });

  it("üç ortak slot adaptöründe ücretli spin ve bonusları raporlar", () => {
    for (const gameId of [
      "kaptan-mercan",
      "neon-kasasi",
      "sekerhane-1024",
    ] as const) {
      const report = runSlotSimulation(
        {
          gameId,
          mode: "paid-spins",
          runs: 100,
          wager: 25,
          seed: 20260831,
        },
        DEFAULT_ADMIN_SETTINGS.games[gameId],
      );
      expect(report.paidSpins).toBe(100);
      expect(report.totalStake).toBe(2500);
      expect(Number.isFinite(report.rtp)).toBe(true);
    }
  });
});
