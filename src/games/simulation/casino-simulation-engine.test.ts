import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_SETTINGS } from "../../data/casino-admin";
import { SIMULATION_GAMES, runCasinoSimulation } from "./casino-simulation-engine";
import { runSlotSimulation } from "../slots/slot-simulation-engine";
import { defaultAllahPersistentState, prepareAllahSpinPersistent } from "../slots/allahin-lutfu-engine";

describe("owner tüm oyunlar simülasyon laboratuvarı", () => {
  it("satın alınan Allah bonuslarını gerçek spin sayısı ve maliyetle başlatır", () => {
    for (const mode of ["bonus-buy", "super-bonus-buy"] as const) {
      const report = runCasinoSimulation({ gameId: "allahin-lutfu", mode, runs: 3, wager: 25, seed: 17 }, DEFAULT_ADMIN_SETTINGS);
      const tuning = DEFAULT_ADMIN_SETTINGS.games["allahin-lutfu"].allah!;
      expect(report.bonusRounds).toBe(3 * tuning.bonusSpins);
      expect(report.totalStake).toBe(3 * 25 * tuning.modeCosts[mode]);
      expect(report.totalPayout).toBeGreaterThan(0);
    }
  });
  it("canlı ve laboratuvar sınırında geçici çarpanları sıfırlar, bonus gözünü korur", () => {
    const state = { ...defaultAllahPersistentState(), globalMultiplier: 90, minimumCoinTier: 4, persistentEye: "gold" as const, eyeSlots: ["rune-1" as never] };
    const next = prepareAllahSpinPersistent(state, { tier: "super", remaining: 5, totalSpins: 1, totalPayout: 0 });
    expect(next.globalMultiplier).toBe(1);
    expect(next.minimumCoinTier).toBe(0);
    expect(next.persistentEye).toBe("gold");
    expect(next.eyeSlots).toEqual(state.eyeSlots);
    expect(prepareAllahSpinPersistent(state).eyeSlots).toEqual([]);
    expect(state.globalMultiplier).toBe(90);
  });
  it("ortak slotlarda ana oturum toplamını, hit ve kârlı turu doğru paydada ölçer", () => {
    for (const gameId of ["neon-kasasi", "kaptan-mercan", "sekerhane-1024"] as const) {
      const request = { gameId, mode: "bonus-sessions" as const, runs: 10, wager: 25, seed: 19 };
      const sessions: Array<{ payout: number; stake: number }> = [];
      const raw = runSlotSimulation(request, DEFAULT_ADMIN_SETTINGS.games[gameId], session => sessions.push(session));
      const report = runCasinoSimulation(request, DEFAULT_ADMIN_SETTINGS);
      expect(sessions).toHaveLength(10);
      expect(report.totalPayout).toBeCloseTo(raw.totalPayout, 6);
      expect(report.hitRate).toBe(sessions.filter(s => s.payout > 0).length / 10);
      expect(report.profitRate).toBe(sessions.filter(s => s.payout > s.stake).length / 10);
      expect(report.distribution.reduce((sum, d) => sum + d.count, 0)).toBe(10);
    }
  });
  it("katalogdaki her oyun için sonlu ve izole bir rapor üretir", () => {
    for (const definition of SIMULATION_GAMES) {
      const report = runCasinoSimulation({
        gameId: definition.id,
        mode: definition.modes[0].id,
        runs: 20,
        wager: DEFAULT_ADMIN_SETTINGS.games[definition.id].defaultBet,
        seed: 20260909,
        parameter: definition.parameter?.defaultValue,
      }, DEFAULT_ADMIN_SETTINGS);
      expect(report.request.gameId).toBe(definition.id);
      expect(report.request.runs).toBe(20);
      expect(Number.isFinite(report.observedRtp)).toBe(true);
      expect(Number.isFinite(report.totalPayout)).toBe(true);
      expect(report.totalStake).toBeGreaterThan(0);
      expect(report.metadata.find((row) => row.label === "Bakiye etkisi")?.value).toContain("yok");
    }
  });

  it("aynı tohum ve senaryoda aynı sayısal sonucu tekrar üretir", () => {
    const request = { gameId: "allahin-lutfu" as const, mode: "trickster", runs: 30, wager: 25, seed: 424242 };
    const first = runCasinoSimulation(request, DEFAULT_ADMIN_SETTINGS);
    const second = runCasinoSimulation(request, DEFAULT_ADMIN_SETTINGS);
    expect(second.totalPayout).toBe(first.totalPayout);
    expect(second.observedRtp).toBe(first.observedRtp);
    expect(second.causes).toEqual(first.causes);
  });

  it("deneme sınırlarını ve dinamik parametreleri güvenli aralığa alır", () => {
    const report = runCasinoSimulation({ gameId: "plinko", mode: "yuksek", runs: 0, wager: -10, seed: 1, parameter: 99 }, DEFAULT_ADMIN_SETTINGS);
    expect(report.request.runs).toBe(1);
    expect(report.request.wager).toBe(.01);
    expect(report.request.parameter).toBe(16);
  });
});
