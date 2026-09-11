import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_SETTINGS } from "../../data/casino-admin";
import { SIMULATION_GAMES, runCasinoSimulation } from "./casino-simulation-engine";
import { buildSimulationDiagnosis, patchGameWithRecommendation, profileFingerprint, protectedGameSettings, researchKnobs, researchSimulation, validateSimulationSelection, type SimulationOptimizationGoal } from "./simulation-optimizer";

const goal: SimulationOptimizationGoal = { targetRtp: 70, priority: "balanced", minHitRetention: .8, minBonusRetention: .5, allowPayoutChanges: false, batchRuns: 100 };
describe("deneysel simülasyon araştırması", () => {
  it("tek koşu veya korelasyondan uygulanabilir öneri uydurmaz", () => {
    const report = runCasinoSimulation({ gameId: "allahin-lutfu", mode: "trickster", runs: 100, wager: 25, seed: 9 }, DEFAULT_ADMIN_SETTINGS);
    expect(buildSimulationDiagnosis(report, DEFAULT_ADMIN_SETTINGS.games["allahin-lutfu"], goal).recommendations).toEqual([]);
  });

  it("bütün oyun ve modlarda tasarım tavanlarını korur, gerçek ayarları kataloglar", () => {
    for (const definition of SIMULATION_GAMES) for (const mode of definition.modes) {
      const knobs = researchKnobs(DEFAULT_ADMIN_SETTINGS.games[definition.id], mode.id, true);
      if (!["blackjack", "roulette", "poker"].includes(definition.id)) expect(knobs.length, definition.id + "/" + mode.id).toBeGreaterThan(0);
      expect(knobs.some(k => /maxWin|maxPayout|maxMultiplier|globalMultiplierCap|modeCosts|bonusCosts|maxCoin/.test(k.path))).toBe(false);
    }
    const allahBaseScale = researchKnobs(DEFAULT_ADMIN_SETTINGS.games["allahin-lutfu"], "base", true)
      .find(knob => knob.path === "allah.modePayoutScales.base");
    expect(allahBaseScale).toMatchObject({ global: false, unit: "×" });
  });

  it("18 oyunun her birinde gerçek motor deneyleri veya strateji karşılaştırmaları çalıştırır", async () => {
    for (const definition of SIMULATION_GAMES) {
      const report = runCasinoSimulation({ gameId: definition.id, mode: definition.modes[0].id, runs: 10, wager: 25, seed: 321, parameter: definition.parameter?.defaultValue }, DEFAULT_ADMIN_SETTINGS);
      const result = await researchSimulation(report, DEFAULT_ADMIN_SETTINGS, { ...goal, allowPayoutChanges: true, maxIterations: 0, maxCandidates: 0 });
      expect(result.experiments.length, definition.id).toBeGreaterThan(0);
      expect(result.totalSimulatedRounds).toBeGreaterThan(300);
      for (const experiment of result.experiments) {
        expect(Number.isFinite(experiment.comparison.after.rtp)).toBe(true);
        expect(experiment.comparison.seeds).toHaveLength(3);
      }
      expect(profileFingerprint(DEFAULT_ADMIN_SETTINGS.games[definition.id])).toBe(result.sourceFingerprint);
    }
  }, 180_000);

  it("seçimi bağımsız tohumlarla sınar, gerçek ödeme değişimini doğrular ve eski raporu uygulamaz", async () => {
    const report = runCasinoSimulation({ gameId: "plinko", mode: "dusuk", runs: 500, wager: 100, seed: 7, parameter: 8 }, DEFAULT_ADMIN_SETTINGS);
    const result = await researchSimulation(report, DEFAULT_ADMIN_SETTINGS, { ...goal, batchRuns: 500 });
    const recommendation = result.diagnosis.recommendations[0];
    expect(recommendation).toBeDefined();
    expect(recommendation.applyable).toBe(true);
    expect(result.diagnosis.recommendations.every(item => item.applyable)).toBe(true);
    expect(result.searchSummary.outcome).toBe("validated");
    expect(result.searchSummary.candidatesValidated).toBeGreaterThan(0);
    expect(recommendation.validation.improvement95[0]).toBeGreaterThan(0);
    const searchSeeds = result.experiments[0].comparison.seeds;
    expect(recommendation.validation.seeds.every(seed => !searchSeeds.includes(seed))).toBe(true);
    const game = DEFAULT_ADMIN_SETTINGS.games.plinko;
    const patched = patchGameWithRecommendation(game, recommendation);
    expect(patched.targetRtp).toBe(70);
    expect(protectedGameSettings(patched)).toEqual(protectedGameSettings(game));
    expect(() => patchGameWithRecommendation({ ...game, targetRtp: 90 }, recommendation)).toThrow("profil");
    expect(() => patchGameWithRecommendation(game, { ...recommendation, changes: [{ path: "plinko.maxPayoutX", label: "Tavan", before: 1000, after: 10, unit: "×", reason: "" }] })).toThrow("korunuyor");
  }, 30_000);

  it("özellik içinden üretilen gözleri sayar ve ödemeyi tavan sonrası ayrıştırır", () => {
    const settings = structuredClone(DEFAULT_ADMIN_SETTINGS);
    const tuning = settings.games["allahin-lutfu"].allah!;
    tuning.mysteryWeights.eye = 30;
    tuning.maxWinX = 50;
    const report = runCasinoSimulation({ gameId: "allahin-lutfu", mode: "trickster", runs: 100, wager: 25, seed: 123 }, settings);
    expect(report.causes.find(c => c.label === "Mystery kaynaklı göz")?.occurrences).toBeGreaterThan(0);
    expect(report.causes.find(c => c.label === "Etkinleşen göz (tüm kaynaklar)")?.occurrences).toBeGreaterThan(0);
    expect(report.causes.reduce((sum, c) => sum + c.contributionShare, 0)).toBeCloseTo(1, 5);
  });

  it("tavanı düşürmeden, yüksek göz profilinde frekans müdahalesinin ölçümünü yapar", async () => {
    const settings = structuredClone(DEFAULT_ADMIN_SETTINGS);
    settings.games["allahin-lutfu"].allah!.reelEyeChancePercent.base = 20;
    const report = runCasinoSimulation({ gameId: "allahin-lutfu", mode: "base", runs: 100, wager: 25, seed: 123 }, settings);
    const result = await researchSimulation(report, settings, { ...goal, targetRtp: 96.7, minHitRetention: 0, maxCandidates: 0 });
    const eye = result.experiments.find(e => e.changes[0]?.path === "allah.reelEyeChancePercent.base" && e.changes[0].after === 7)!;
    expect(eye).toBeDefined();
    expect(eye.comparison.after.causes["Göz sembolü"]).toBeLessThan(eye.comparison.before.causes["Göz sembolü"]);
    expect(result.protectedSettings.find(s => s.path === "allah.maxWinX")?.value).toBe(500_000);
    for (const rec of result.diagnosis.recommendations) {
      expect(rec.changes.some(c => c.path.includes("maxWin"))).toBe(false);
      if (rec.applyable) expect(rec.validation.improvement95[0]).toBeGreaterThan(0);
    }
  }, 120_000);

  it("Allah'in Lutfu %160+ RTP profilini diger modlara dokunmadan kalibre edecek ayar bulur", async () => {
    const settings = structuredClone(DEFAULT_ADMIN_SETTINGS);
    // Bu senaryo eski, bağımsız mystery dağılımını özellikle yüksek RTP'ye
    // çekerek optimizer'ın geriye dönük kalibrasyon yolunu doğrular.
    settings.games["allahin-lutfu"].allah!.characterScenesEnabled = false;
    settings.games["allahin-lutfu"].allah!.coinPayoutScale = 0.24;
    const request = { gameId: "allahin-lutfu" as const, mode: "base", runs: 10_000, wager: 25, seed: 20260909 };
    const report = runCasinoSimulation(request, settings);
    expect(report.observedRtp).toBeGreaterThan(150);
    const result = await researchSimulation(report, settings, {
      targetRtp: 96.7, priority: "balanced", minHitRetention: .8,
      minBonusRetention: .5, allowPayoutChanges: true, batchRuns: 500,
      maxIterations: 0, maxCandidates: 2,
    });
    const recommendation = result.diagnosis.recommendations[0];
    expect(result.searchSummary.outcome).toBe("validated");
    expect(recommendation?.applyable).toBe(true);
    expect(recommendation?.changes.some(change => change.path === "allah.modePayoutScales.base")).toBe(true);
    expect(recommendation?.changes.some(change => change.path.includes("maxWin"))).toBe(false);
    expect(recommendation!.validation.after.rtp).toBeLessThan(recommendation!.validation.before.rtp);
    const patched = patchGameWithRecommendation(settings.games["allahin-lutfu"], recommendation!);
    expect(patched.allah!.modePayoutScales.fate).toBe(settings.games["allahin-lutfu"].allah!.modePayoutScales.fate);
    expect(patched.allah!.maxWinX).toBe(500_000);
  }, 120_000);

  it("ardışık araştırmada geçici profille ilerler ve başlangıç ayarlarını asla değiştirmez", async () => {
    const settings = structuredClone(DEFAULT_ADMIN_SETTINGS);
    settings.games["kiraz-77"].slot!.math.payoutScale = 8;
    const original = structuredClone(settings);
    const request = { gameId: "kiraz-77" as const, mode: "spins", runs: 100, wager: 25, seed: 123 };
    const report = runCasinoSimulation(request, settings);
    const result = await researchSimulation(report, settings, { ...goal, allowPayoutChanges: true, maxIterations: 3, maxCandidates: 0 });
    expect(result.iterations.length).toBeGreaterThan(0);
    expect(result.iterations.length).toBeLessThanOrEqual(3);
    expect(settings).toEqual(original);
    expect(result.iterations.every(step => step.changes.every(c => c.before === 8))).toBe(true);
  }, 30_000);

  it("seçimi güncel profilde yeniden ölçer, yalnız seçilen alanı uygular ve geri kalan ayarları korur", async () => {
    const settings = structuredClone(DEFAULT_ADMIN_SETTINGS);
    settings.games.plinko.plinko!.maxPayoutX = 4321;
    const original = structuredClone(settings);
    const request = { gameId: "plinko" as const, mode: "dusuk", runs: 100, wager: 100, seed: 7, parameter: 8 };
    const selection = [{ path: "targetRtp", before: settings.games.plinko.targetRtp, after: 70, label: "Hedef", unit: "%" as const, reason: "Deney" }];
    const result = await validateSimulationSelection(request, settings, { ...goal, batchRuns: 500 }, selection);
    expect(settings).toEqual(original);
    expect(result.applyable).toBe(true);
    expect(result.changes).toEqual(selection);
    expect(result.validation.seeds).toHaveLength(6);
    expect(result.sourceFingerprint).toBe(profileFingerprint(settings.games.plinko));
    const patched = patchGameWithRecommendation(settings.games.plinko, result);
    expect(patched).toEqual({ ...settings.games.plinko, targetRtp: 70 });
    const current = { ...settings, games: { ...settings.games, plinko: patched } };
    await expect(validateSimulationSelection(request, current, goal, selection)).rejects.toThrow("zaten");
    await expect(validateSimulationSelection(request, settings, goal, [{ ...selection[0], before: 42 }])).rejects.toThrow("değişmiş");
    await expect(validateSimulationSelection(request, settings, goal, [{ ...selection[0], path: "plinko.maxPayoutX" }])).rejects.toThrow("kapsamında");
    await expect(validateSimulationSelection(request, settings, goal, [selection[0], selection[0]])).rejects.toThrow("iki kez");
  }, 30_000);
});
