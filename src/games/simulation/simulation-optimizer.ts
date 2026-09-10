import type { AdminGameSettings, CasinoAdminSettings } from "../../data/casino-admin";
import { SIMULATION_GAMES, runCasinoSimulation, type CasinoSimulationReport } from "./casino-simulation-engine";

export type OptimizationPriority = "balanced" | "engagement" | "house";
export type SimulationOptimizationGoal = {
  targetRtp: number;
  priority: OptimizationPriority;
  minHitRetention: number;
  minBonusRetention: number;
  allowPayoutChanges: boolean;
  batchRuns: number;
  maxIterations?: number;
};
export type OptimizationChange = {
  path: string; label: string; before: number; after: number;
  unit: "%" | "×" | "ağırlık"; reason: string;
};
export type ResearchMetrics = {
  rtp: number; hitRate: number; profitRate: number; bonusRate: number;
  bonusFrequency: number;
  maxWinX: number; causes: Record<string, number>;
  incompleteSessions: number;
};
export type ResearchComparison = {
  before: ResearchMetrics; after: ResearchMetrics;
  rtpDelta95: [number, number]; improvement95: [number, number];
  improvements: number[]; seeds: number[]; runsPerSeed: number;
};
export type ResearchExperiment = {
  id: string; label: string; changes: OptimizationChange[];
  mechanism: string; comparison: ResearchComparison; score: number;
  kind: "single" | "combination" | "refinement" | "scenario";
};
export type SimulationRecommendation = {
  id: string; priority: "important"; title: string; summary: string;
  expectedEffect: string; confidence: "orta" | "düşük";
  changes: OptimizationChange[]; applyable: boolean; blockedReason?: string;
  validation: ResearchComparison; sourceFingerprint: string;
};
export type SimulationDiagnosis = {
  status: "warning" | "healthy" | "uncertain";
  verdict: string; explanation: string; tooHigh: string[]; tooLow: string[];
  evidence: string[]; recommendations: SimulationRecommendation[];
};
export type SimulationResearch = {
  goal: SimulationOptimizationGoal; sourceFingerprint: string;
  experiments: ResearchExperiment[]; diagnosis: SimulationDiagnosis;
  crossModes: Array<{ mode: string; comparison: ResearchComparison; regression: boolean }>;
  selectedId?: string; totalSimulatedRounds: number; durationMs: number;
  protectedSettings: Array<{ path: string; value: number }>;
  limitations: string[]; interactions: string[];
  iterations: Array<{ step: number; accepted: boolean; label: string; comparison: ResearchComparison; changes: OptimizationChange[] }>;
};
export type ResearchProgress = { phase: string; completed: number; simulatedRounds: number };
type Knob = { path: string; label: string; mechanism: string; unit: OptimizationChange["unit"]; max: number; global: boolean };
const tr = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const mean = (a: number[]) => a.reduce((s, n) => s + n, 0) / Math.max(1, a.length);
const round = (n: number) => Number(n.toFixed(6));
export const profileFingerprint = (game: AdminGameSettings) => JSON.stringify({
  id: game.id, targetRtp: game.targetRtp, slot: game.slot, allah: game.allah,
  mineDrop: game.mineDrop, crash: game.crash, mines: game.mines, countdown: game.countdown, plinko: game.plinko,
});
export function readGameSetting(game: AdminGameSettings, path: string): number {
  let value: unknown = game;
  for (const key of path.split(".")) value = (value as Record<string, unknown>)?.[key];
  return typeof value === "number" ? value : NaN;
}
const readPath = readGameSetting;
const protectedNames = /(^|\.)(maxWinX|maxPayoutX|maxMultiplier|globalMultiplierCap|modeCosts|bonusCosts|bonusBuyX|maxCoin|maxBook)(\.|$)/;
function applyChanges(game: AdminGameSettings, changes: OptimizationChange[]): AdminGameSettings {
  const clone = structuredClone(game);
  for (const change of changes) {
    if (protectedNames.test(change.path) || change.path.split(".").some(p => ["__proto__", "constructor", "prototype"].includes(p)))
      throw new Error("Oyunun kazanç tavanı, satın alım bedeli ve jackpot ayarları korunuyor.");
    if (!Number.isFinite(change.after) || change.after < 0 || !Number.isFinite(readPath(game, change.path)))
      throw new Error("Geçersiz matematik ayarı.");
    const keys = change.path.split(".");
    let target = clone as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[keys.at(-1)!] = change.after;
  }
  return clone;
}
export function patchGameWithRecommendation(game: AdminGameSettings, recommendation: SimulationRecommendation): AdminGameSettings {
  if (!recommendation.applyable) throw new Error("Bu aday bağımsız doğrulamayı geçmedi.");
  if (profileFingerprint(game) !== recommendation.sourceFingerprint)
    throw new Error("Oyun profili bu araştırmadan sonra değişti. Güncel profille yeniden araştırın.");
  return applyChanges(game, recommendation.changes);
}
export function protectedGameSettings(game: AdminGameSettings) {
  const result: Array<{ path: string; value: number }> = [];
  const visit = (obj: unknown, path: string) => {
    if (typeof obj === "number" && protectedNames.test(path)) result.push({ path, value: obj });
    else if (obj && typeof obj === "object") Object.entries(obj).forEach(([k, v]) => visit(v, path ? path + "." + k : k));
  };
  visit(game, "");
  return result;
}

// This registry declares real engine inputs, not diagnoses or canned corrections.
// Direction, magnitude, ranking and acceptance are determined by experiments below.
export function researchKnobs(game: AdminGameSettings, mode: string, allowPayoutChanges: boolean): Knob[] {
  const knobs: Knob[] = [];
  const add = (path: string, label: string, mechanism: string, unit: Knob["unit"] = "ağırlık", max = 1e6, global = true) => {
    if (readPath(game, path) > 0) knobs.push({ path, label, mechanism, unit, max, global });
  };
  if (game.allah) {
    add("allah.reelEyeChancePercent." + mode, "Makara göz sıklığı", "Makaradaki göz → Mystery üretimi → özellik zinciri → ödeme", "%", 100, false);
    add("allah.reelScatterChancePercent." + mode, "Makara scatter sıklığı", "Scatter → doğal bonus → bonus ödeme katkısı", "%", 100, false);
    const weights = mode === "fate" ? "fateMysteryWeights" : "mysteryWeights";
    for (const [key, label] of [["eye", "Mystery içinden göz"], ["collector", "Collector"], ["redrop", "Yeniden düşüş"], ["upgrader", "Coin yükseltici"], ["multiplier", "Tahta çarpanı"], ["key", "Global çarpan anahtarı"]]) {
      add("allah." + weights + "." + key, label + " ağırlığı", "Mystery → " + label + " → zincir uzunluğu ve son ödeme");
    }
    if (mode === "trickster") add("allah.tricksterMysteryEyeMultiplier", "Trickster göz ağırlık çarpanı", "Trickster Mystery → ek göz → yeniden Mystery", "×", 100, false);
    if (mode.includes("bonus")) {
      for (const tier of ["free", "super", "legendary", "mythic"]) {
        add("allah.bonusFeatureChancePercent." + tier, tier + " bonus göz sıklığı", "Bonus makarasında göz → Mystery → bonus toplamı", "%", 100);
        add("allah.bonusScatterChancePercent." + tier, tier + " bonus scatter sıklığı", "Bonus scatter → uzama / seviye değişimi", "%", 100);
      }
    }
    if (allowPayoutChanges) {
      add("allah.coinPayoutScale", "Coin / Collector ödeme ölçeği", "Coin ve Collector ödemelerinin parasal ölçeği", "×", 100);
      add("allah.linePayoutScale", "Çizgi ödeme ölçeği", "Normal sembol ödemelerinin parasal ölçeği", "×", 100);
    }
  } else if (game.mineDrop) {
    if (mode === "mystery-buy") {
      for (const outcome of ["none", "super", "epic"])
        add("mineDrop.mysteryOutcomeWeights." + outcome, "Gizemli kapı · " + outcome + " ağırlığı", "Satın alım → boş / süper / epik kapı → oturum ödemesi", "ağırlık", 1e4, false);
      for (const tier of ["bonus-super", "bonus-epic"])
        for (const key of ["eye", "tool", "tnt"])
          add("mineDrop.symbolWeights." + tier + "." + key, tier + " · " + key, "Gizemli kapı sonrası bonus özellikleri → son ödeme");
    }
    for (const key of ["eye", "tool", "tnt", "book"]) add("mineDrop.symbolWeights." + mode + "." + key, mode + " · " + key + " ağırlığı", "Makara → kazma terfisi / blok kırılması / sandık / bonus", "ağırlık", 1e4, false);
    for (const key of ["gold", "diamond", "obsidian"]) add("mineDrop.toolWeights." + mode + "." + key, key + " kazma ağırlığı", "Kazma kalitesi → dayanıklılık → kırılan blok ve sandık", "ağırlık", 1e4, false);
    if (allowPayoutChanges) add("mineDrop.payoutScales." + mode, "Kazı ödeme ölçeği", "Seçili kazı bağlamının ödeme ölçeği", "×", 100, false);
  } else if (game.slot) {
    if (game.id !== "kiraz-77") {
      const contexts = mode === "bonus-sessions" ? ["bonus"] : ["base", "bonus"];
      for (const context of contexts)
        for (const feature of ["Scatter", "Special", "Prize"])
          add("slot.math." + context + feature + "Rate", context + " · " + feature + " sıklığı", feature + " üretimi → özellik / bonus ödemesi");
      add("slot.math.cascadeAffinityPercent", "Ardışık eşleşme eğilimi", "Ardışık eşleşme → daha uzun düşüş zinciri", "%", 100);
      for (const feature of ["rescueChancePercent", "captainRescueChancePercent"])
        add("slot.math." + feature, "Kurtarma · " + feature, "Kurtarma olayı → ek balık / ödeme", "%", 100);
      if (game.slot.flow.enabled) {
        add("slot.flow.drySpinEventBoostPercent", "Kuru tur sonrası özellik desteği", "Ödeme olmayan seri → özellik ağırlığı → ritim", "%", 100);
        add("slot.flow.bonusPressurePerSpinPercent", "Doğal bonus baskısı", "Bonus bekleme süresi → bonus tetiklenme olasılığı", "%", 100);
        add("slot.flow.retriggerConversionPercent", "Yeniden tetikleme dönüşümü", "Bonus ipucu → ilave spin", "%", 100);
      }
    }
    if (allowPayoutChanges) {
      if (mode !== "bonus-sessions") add("slot.math.payoutScale", "Temel ödeme ölçeği", "Ücretli spin ödeme ölçeği", "×", 100);
      if (game.id !== "kiraz-77") add("slot.math.bonusPayoutScale", "Bonus ödeme ölçeği", "Bonus spin ödeme ölçeği", "×", 100);
    }
  } else if (!["blackjack", "roulette", "poker"].includes(game.id)) {
    add("targetRtp", "Ödeme formülü RTP hedefi", "Canlı olasılık / ödeme tablosu → stratejinin gerçekleşen geri dönüşü", "%", 100);
  }
  return knobs;
}
function interval(values: number[]): [number, number] {
  const m = mean(values);
  if (values.length < 2) return [-Infinity, Infinity];
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  const t = values.length >= 6 ? 2.571 : values.length >= 4 ? 3.182 : 4.303;
  const margin = t * Math.sqrt(variance / values.length);
  return [m - margin, m + margin];
}
function metrics(reports: CasinoSimulationReport[]): ResearchMetrics {
  const causes: Record<string, number> = {};
  for (const report of reports) for (const cause of report.causes)
    causes[cause.label] = (causes[cause.label] ?? 0) + cause.occurrences / report.request.runs / reports.length;
  return {
    rtp: mean(reports.map(r => r.observedRtp)), hitRate: mean(reports.map(r => r.hitRate)),
    profitRate: mean(reports.map(r => r.profitRate)),
    bonusRate: mean(reports.map(r => r.bonusRounds / r.request.runs)),
    bonusFrequency: mean(reports.map(r => r.causes.find(c => c.label === "Bonus oturumu")?.roundRate ?? 0)),
    maxWinX: Math.max(...reports.map(r => r.maxWinX)), causes,
    incompleteSessions: reports.reduce((sum, r) => sum + r.incompleteSessions, 0),
  };
}
function compare(before: CasinoSimulationReport[], after: CasinoSimulationReport[], target: number): ResearchComparison {
  const improvements = before.map((b, i) => Math.abs(b.observedRtp - target) - Math.abs(after[i].observedRtp - target));
  return {
    before: metrics(before), after: metrics(after), improvements,
    rtpDelta95: interval(before.map((b, i) => after[i].observedRtp - b.observedRtp)),
    improvement95: interval(improvements), seeds: before.map(r => r.request.seed), runsPerSeed: before[0].request.runs,
  };
}
export function buildSimulationDiagnosis(report: CasinoSimulationReport, _game: AdminGameSettings, goal: SimulationOptimizationGoal): SimulationDiagnosis {
  const [lo, hi] = report.confidence95;
  const above = lo > goal.targetRtp, below = hi < goal.targetRtp;
  return {
    status: above || below ? "warning" : "uncertain",
    verdict: "Deneysel araştırma bekleniyor",
    explanation: "Bu tek koşu gözlem sunar. Hangi ayarın etkili olduğu, ayarı değiştirip yeniden çalıştırmadan belirlenemez.",
    tooHigh: above ? ["Bu koşunun geri dönüş aralığı hedefin üzerinde."] : [],
    tooLow: below ? ["Bu koşunun geri dönüş aralığı hedefin altında."] : [],
    evidence: ["Gözlenen RTP %" + tr(report.observedRtp) + "; örnek ortalaması aralığı %" + tr(lo) + "–%" + tr(hi) + "."],
    recommendations: [],
  };
}
export async function researchSimulation(
  report: CasinoSimulationReport, settings: CasinoAdminSettings, rawGoal: SimulationOptimizationGoal,
  progress: (value: ResearchProgress) => void = () => {},
): Promise<SimulationResearch> {
  const started = performance.now(), request = report.request, game = settings.games[request.gameId];
  const goal = { ...rawGoal, batchRuns: Math.max(100, Math.min(10_000, Math.round(rawGoal.batchRuns))), maxIterations: Math.max(0, Math.min(5, Math.round(rawGoal.maxIterations ?? 3))) };
  const knobs = researchKnobs(game, request.mode, goal.allowPayoutChanges);
  const experiments: ResearchExperiment[] = [], interactions: string[] = [];
  const iterations: SimulationResearch["iterations"] = [];
  const fingerprint = profileFingerprint(game);
  let totalSimulatedRounds = 0, completed = 0;
  // Separate deterministic seed domains for search and untouched validation.
  const seeds = (domain: number, count: number) => Array.from({ length: count }, (_, i) =>
    (Math.imul(request.seed ^ domain, 1664525) + Math.imul(i + 1, 1013904223)) >>> 0);
  const searchSeeds = seeds(0x51a23, 3), validationSeeds = seeds(0x78ca9, 6);
  const simulate = async (profile: AdminGameSettings, batchSeeds: number[], runs: number, phase: string, mode = request.mode, parameter = request.parameter) => {
    const reports: CasinoSimulationReport[] = [];
    for (const seed of batchSeeds) {
      reports.push(runCasinoSimulation({ ...request, mode, parameter, seed, runs }, { ...settings, games: { ...settings.games, [game.id]: profile } }));
      totalSimulatedRounds += runs;
      progress({ phase, completed: ++completed, simulatedRounds: totalSimulatedRounds });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return reports;
  };
  const baseline = await simulate(game, searchSeeds, goal.batchRuns, "Mevcut profil: farklı tohumlarla referans ölçümü");
  const score = (comparison: ResearchComparison, changes: OptimizationChange[]) => {
    const minHit = comparison.before.hitRate * goal.minHitRetention;
    const deficit = Math.max(0, minHit - comparison.after.hitRate);
    const bonusDeficit = comparison.before.bonusFrequency > 0
      ? Math.max(0, goal.minBonusRetention - comparison.after.bonusFrequency / comparison.before.bonusFrequency) : 0;
    const rhythmWeight = goal.priority === "engagement" ? 4 : goal.priority === "house" ? 1 : 2;
    return Math.abs(comparison.after.rtp - goal.targetRtp) / goal.targetRtp
      + deficit * rhythmWeight * 10 + bonusDeficit * 10 + changes.length * .002;
  };
  const makeChange = (knob: Knob, after: number): OptimizationChange => ({
    path: knob.path, label: knob.label, before: readPath(game, knob.path),
    after: round(Math.min(knob.max, Math.max(.000001, after))), unit: knob.unit, reason: knob.mechanism,
  });
  const evaluate = async (changes: OptimizationChange[], label: string, kind: ResearchExperiment["kind"], mechanism: string) => {
    const after = await simulate(applyChanges(game, changes), searchSeeds, goal.batchRuns, label);
    const comparison = compare(baseline, after, goal.targetRtp);
    const experiment = { id: "experiment-" + experiments.length, label, kind, changes, mechanism, comparison, score: score(comparison, changes) };
    experiments.push(experiment);
    return experiment;
  };
  for (const knob of knobs) {
    const before = readPath(game, knob.path);
    const values = knob.path === "targetRtp" ? [goal.targetRtp] : [before * .5, before * .8, before * 1.2];
    for (const value of [...new Set(values.map(round))]) {
      const change = makeChange(knob, value);
      if (change.after !== change.before)
        await evaluate([change], knob.label + ": " + tr(change.before) + " → " + tr(change.after), "single", knob.mechanism);
    }
  }
  const baseComparison = compare(baseline, baseline, goal.targetRtp);
  const baseScore = score(baseComparison, []);
  const ranked = () => experiments.filter(e => e.kind !== "scenario").sort((a, b) => a.score - b.score);
  let best = ranked()[0];
  // Refine the most promising actual measurement, rather than inventing a
  // correction from observed RTP. A factor that did nothing is never extrapolated.
  if (best && best.score < baseScore && best.changes.length === 1 && best.changes[0].path !== "targetRtp") {
    const chosen = best.changes[0], knob = knobs.find(k => k.path === chosen.path)!;
    for (const value of [chosen.after * .5, (chosen.after + chosen.before) / 2])
      await evaluate([makeChange(knob, value)], knob.label + " · ince arama " + tr(value), "refinement", knob.mechanism);
  }
  const distinct = ranked().filter((e, i, all) => e.score < baseScore && all.findIndex(a => a.changes[0].path === e.changes[0].path) === i).slice(0, 2);
  if (distinct.length === 2) {
    const combined = await evaluate(distinct.flatMap(e => e.changes), "En etkili iki ayarın birlikte denemesi", "combination", "Tekil etkilerin birlikte çalışınca değişip değişmediği ölçülür.");
    const additive = distinct.reduce((s, e) => s + e.comparison.after.rtp - e.comparison.before.rtp, 0);
    const actual = combined.comparison.after.rtp - combined.comparison.before.rtp;
    interactions.push("İki tekil deneyin RTP etkileri toplamı " + tr(additive) + " puan; birlikte ölçülen " + tr(actual) + " puan. Fark " + tr(actual - additive) + " puan; etkileşim ve örnek değişkenliği içerir.");
  }
  best = ranked()[0];
  // Coordinate search continues on the best measured temporary profile. Every
  // cumulative candidate is still compared with the same untouched live baseline.
  for (let step = 1; best && best.score < baseScore && step <= goal.maxIterations; step += 1) {
    const previous = best;
    const paths = [...new Set(ranked().filter(e => e.kind !== "combination").flatMap(e => e.changes.map(c => c.path)))].filter(path => path !== "targetRtp").slice(0, 3);
    if (!paths.length) break;
    for (const path of paths) {
      const knob = knobs.find(k => k.path === path)!;
      const center = previous.changes.find(c => c.path === path)?.after ?? readPath(game, path);
      for (const factor of [.7, 1.15]) {
        const next = makeChange(knob, center * factor);
        const changes = [...previous.changes.filter(c => c.path !== path), next].filter(c => c.before !== c.after);
        if (!changes.length) continue;
        await evaluate(changes, "Deney adımı " + step + " · " + knob.label + " " + tr(next.after), "refinement", "Önceki en iyi geçici profil üzerinden " + knob.mechanism);
      }
    }
    best = ranked()[0];
    const accepted = best.score < previous.score - .0001;
    iterations.push({ step, accepted, label: accepted ? "Bu geçici profil daha iyi; sonraki deney buradan devam etti." : "Ek denemeler iyileştirmedi; önceki geçici profil korundu.", comparison: best.comparison, changes: best.changes });
    if (!accepted) break;
  }
  const diagnosis = buildSimulationDiagnosis(report, game, goal);
  diagnosis.evidence.push("Arama " + searchSeeds.length + " tohumla; seçilen aday ayrı 6 tohumla sınanır. Birim, ana tur / satın alım oturumudur.");
  const crossModes: SimulationResearch["crossModes"] = [];
  const limitations = [
    "Sonuçlar seçilen motor adaptörü, mod, bahis ve örnek hacmi için geçerlidir. Teorik RTP sertifikası değildir.",
    "Güven aralıkları tohum grupları arasındaki eşleştirilmiş farklardan hesaplanır. Dal değişince rastgele sayı tüketimi değişebilir; tek tek spinler eşleşmiş kabul edilmez.",
    "Nadir jackpot görülmemesi, jackpot yolunun yokluğu veya uzun dönem riskinin ölçüldüğü anlamına gelmez. Tavan korunur; gerçekleşme sıklığı aynı kalacağı garanti edilmez.",
  ];
  if (game.slot && game.id !== "kiraz-77") limitations.push("Slot hit, dağılım ve RTP ölçümleri ücretli spin + doğal bonus toplamı veya satın alınmış bonus oturumu bazındadır. Oturumlar arasında motorun akış durumu korunur.");
  if (best && best.score < baseScore) {
    const candidate = applyChanges(game, best.changes);
    const before = await simulate(game, validationSeeds, goal.batchRuns * 2, "Bağımsız doğrulama · mevcut profil");
    const after = await simulate(candidate, validationSeeds, goal.batchRuns * 2, "Bağımsız doğrulama · seçilen aday");
    const validation = compare(before, after, goal.targetRtp);
    const regressions: string[] = [];
    if (best.changes.some(c => knobs.find(k => k.path === c.path)?.global)) {
      const definition = SIMULATION_GAMES.find(d => d.id === game.id)!;
      for (const mode of definition.modes.filter(m => m.id !== request.mode && !(game.id === "baykus-madeni" && m.id === "bonus-epic"))) {
        const b = await simulate(game, validationSeeds.slice(0, 3), goal.batchRuns, "Diğer mod kontrolü · " + mode.label, mode.id);
        const a = await simulate(candidate, validationSeeds.slice(0, 3), goal.batchRuns, "Aday diğer mod · " + mode.label, mode.id);
        const comparison = compare(b, a, goal.targetRtp);
        const regression = comparison.improvement95[1] < -3 || comparison.after.hitRate < comparison.before.hitRate * goal.minHitRetention
          || comparison.after.bonusFrequency < comparison.before.bonusFrequency * goal.minBonusRetention;
        crossModes.push({ mode: mode.label, comparison, regression });
        if (regression) regressions.push(mode.label);
      }
    }
    const enough = validation.improvement95[0] > 0;
    const retainsHit = validation.after.hitRate >= validation.before.hitRate * goal.minHitRetention;
    const retainsBonus = validation.after.bonusFrequency >= validation.before.bonusFrequency * goal.minBonusRetention;
    const incomplete = validation.before.incompleteSessions + validation.after.incompleteSessions
      + crossModes.reduce((sum, m) => sum + m.comparison.before.incompleteSessions + m.comparison.after.incompleteSessions, 0);
    const conditionalOnly = game.id === "baykus-madeni" && request.mode === "bonus-epic";
    const applyable = enough && retainsHit && retainsBonus && !regressions.length && !incomplete && !conditionalOnly;
    const blockedReason = conditionalOnly ? "Epik koşullu senaryodur. Uygulanabilir öneri için Gizemli dönüş satın al modunu araştırın."
      : incomplete ? "Simülasyonun işlem sınırında tamamlanamayan bonus oturumları var. Eksik ödemeyle ayar önerilemez."
      : !enough ? "Bağımsız örnekte iyileşme yeterince kesin değil; daha büyük deney gerekli."
      : !retainsHit ? "Seçtiğiniz ödeme sıklığını koruma sınırı aşıldı."
      : !retainsBonus ? "Seçtiğiniz bonus sıklığını koruma sınırı aşıldı."
      : regressions.length ? "Diğer modlarda gerileme: " + regressions.join(", ") : undefined;
    const changedCause = Object.entries(validation.before.causes)
      .map(([label, value]) => ({ label, before: value, after: validation.after.causes[label] ?? 0 }))
      .filter(c => Math.abs(c.before - c.after) > .001)
      .sort((a, b) => Math.abs(b.before - b.after) - Math.abs(a.before - a.after)).slice(0, 5);
    diagnosis.evidence.push(...changedCause.map(c => c.label + ": ana tur başına " + tr(c.before) + " → " + tr(c.after) + " olay."));
    diagnosis.verdict = applyable ? "Ölçülmüş iyileştirme bulundu" : "Aday bulundu; doğrulama yetersiz";
    diagnosis.status = applyable ? "healthy" : "uncertain";
    diagnosis.explanation = "En iyi aday " + best.label + ". Bağımsız ölçümde RTP %" + tr(validation.before.rtp) + " → %" + tr(validation.after.rtp) + ". " + (blockedReason ?? "Hedefe yaklaşma ve seçtiğiniz ödeme sıklığı koşulu doğrulandı.");
    diagnosis.recommendations.push({
      id: best.id, priority: "important", title: best.label, summary: best.mechanism,
      confidence: applyable ? "orta" : "düşük", changes: best.changes, applyable, blockedReason,
      sourceFingerprint: fingerprint, validation,
      expectedEffect: "Yeni tohumlarda ölçülen RTP farkı aralığı " + tr(validation.rtpDelta95[0]) + "–" + tr(validation.rtpDelta95[1]) + " yüzde puan; ödeme sıklığı %" + tr(validation.before.hitRate * 100) + " → %" + tr(validation.after.hitRate * 100) + ".",
    });
    if (validation.after.rtp > goal.targetRtp + 3) diagnosis.tooHigh.push("Aday sonrasında da RTP hedefin üzerinde; bu aday tam dengeye ulaştığı iddiası taşımaz.");
    if (validation.after.rtp < goal.targetRtp - 3) diagnosis.tooLow.push("Aday sonrasında RTP hedefin altında; kalan fark raporda korunuyor.");
  } else {
    diagnosis.status = "uncertain";
    diagnosis.verdict = knobs.length ? "Denenen ayarlarda uygun iyileştirme bulunamadı" : "Bu profil için düzenlenebilir uygun ayar yok";
    diagnosis.explanation = knobs.length
      ? "Denenen değerler, hedef geri dönüş ve ödeme sıklığı koşullarını birlikte iyileştirmedi. Deney tablosu etkisiz veya ters etkili adayları da içeriyor."
      : "Oyuncu seçimi ve ödeme tablosunu incelemek için senaryolar karşılaştırılıyor. Oyunun sabit kuralını değiştiren bir canlı ayar önerilmiyor.";
  }
  // Fixed-table games are researched through their actual strategy/risk choices.
  // These are informative alternatives, never disguised as global game settings.
  if (!knobs.length || (!game.slot && !game.allah && !game.mineDrop)) {
    const definition = SIMULATION_GAMES.find(d => d.id === game.id)!;
    const scenarios = definition.modes.filter(m => m.id !== request.mode).map(m => ({ mode: m.id, label: m.label, parameter: request.parameter }));
    if (definition.parameter) for (const parameter of [definition.parameter.min, definition.parameter.defaultValue, definition.parameter.max])
      if (parameter !== request.parameter) scenarios.push({ mode: request.mode, label: definition.parameter.label + " " + parameter, parameter });
    for (const scenario of scenarios) {
      const after = await simulate(game, searchSeeds, goal.batchRuns, "Senaryo karşılaştırması · " + scenario.label, scenario.mode, scenario.parameter);
      const comparison = compare(baseline, after, goal.targetRtp);
      experiments.push({ id: "scenario-" + experiments.length, label: scenario.label, kind: "scenario", changes: [], mechanism: "Oyuncu kararı / risk seçimi değiştirilerek ölçülür. Canlı profil ayarı değildir.", comparison, score: 0 });
    }
  }
  if (experiments.every(e => e.comparison.before.rtp === e.comparison.after.rtp))
    diagnosis.evidence.push("Bu örnekte adaylar ölçülen geri dönüşü değiştirmedi; ayar etkinliği kanıtlanmadı.");
  return {
    goal, sourceFingerprint: fingerprint, experiments, diagnosis, selectedId: best?.id, crossModes,
    totalSimulatedRounds, durationMs: performance.now() - started, protectedSettings: protectedGameSettings(game),
    limitations, interactions, iterations,
  };
}

/** Validate any selected subset on the CURRENT shared profile before approval.
 * This function never imports or calls the settings persistence API. */
export async function validateSimulationSelection(
  request: CasinoSimulationReport["request"], settings: CasinoAdminSettings,
  goal: SimulationOptimizationGoal, selectedChanges: OptimizationChange[],
  progress: (value: ResearchProgress) => void = () => {},
): Promise<SimulationRecommendation> {
  const game = settings.games[request.gameId];
  const knobs = researchKnobs(game, request.mode, goal.allowPayoutChanges);
  const changes = selectedChanges.filter(c => readPath(game, c.path) !== c.after).map(c => {
    const knob = knobs.find(k => k.path === c.path);
    if (!knob || !Number.isFinite(c.after) || c.after <= 0 || c.after > knob.max)
      throw new Error("Seçilen ayar bu araştırma kapsamında değil: " + c.label);
    if (readPath(game, c.path) !== c.before) throw new Error(c.label + " araştırmadan sonra değişmiş. Güncel profille tekrar araştırın.");
    return { ...c, before: readPath(game, c.path) };
  });
  if (!changes.length) throw new Error("Seçili değerler zaten canlı ayarlarda kayıtlı.");
  if (new Set(changes.map(c => c.path)).size !== changes.length) throw new Error("Aynı ayar iki kez seçilemez.");
  const candidate = applyChanges(game, changes);
  const seeds = Array.from({ length: 6 }, (_, i) => (Math.imul(request.seed ^ 0x934b7, 1664525) + Math.imul(i + 1, 1013904223)) >>> 0);
  const runs = Math.max(100, Math.min(20_000, goal.batchRuns * 2));
  let completed = 0;
  const simulate = async (profile: AdminGameSettings, mode: string, count = 6) => {
    const reports: CasinoSimulationReport[] = [];
    for (const seed of seeds.slice(0, count)) {
      reports.push(runCasinoSimulation({ ...request, mode, seed, runs }, { ...settings, games: { ...settings.games, [game.id]: profile } }));
      progress({ phase: "Seçili ayarlar deneniyor · " + mode + " · canlı kayıt yapılmıyor", completed: ++completed, simulatedRounds: completed * runs });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return reports;
  };
  const before = await simulate(game, request.mode);
  const after = await simulate(candidate, request.mode);
  const validation = compare(before, after, goal.targetRtp);
  const regressions: string[] = [];
  let incomplete = validation.before.incompleteSessions + validation.after.incompleteSessions;
  if (changes.some(c => knobs.find(k => k.path === c.path)?.global)) {
    for (const mode of SIMULATION_GAMES.find(g => g.id === game.id)!.modes.filter(m => m.id !== request.mode && !(game.id === "baykus-madeni" && m.id === "bonus-epic"))) {
      const comparison = compare(await simulate(game, mode.id, 3), await simulate(candidate, mode.id, 3), goal.targetRtp);
      incomplete += comparison.before.incompleteSessions + comparison.after.incompleteSessions;
      if (comparison.improvement95[1] < -3 || comparison.after.hitRate < comparison.before.hitRate * goal.minHitRetention || comparison.after.bonusFrequency < comparison.before.bonusFrequency * goal.minBonusRetention)
        regressions.push(mode.label);
    }
  }
  const blockedReason = game.id === "baykus-madeni" && request.mode === "bonus-epic" ? "Koşullu epik inceleme canlı satın alımı temsil etmez."
    : incomplete ? "Bazı bonus oturumları tamamlanamadı."
    : validation.improvement95[0] <= 0 ? "Bu seçimin hedefe yaklaştırdığı bağımsız örnekte kesinleşmedi."
    : validation.after.hitRate < validation.before.hitRate * goal.minHitRetention ? "Ödeme sıklığı belirlediğiniz sınırın altına düşüyor."
    : validation.after.bonusFrequency < validation.before.bonusFrequency * goal.minBonusRetention ? "Bonus sıklığı belirlediğiniz sınırın altına düşüyor."
    : regressions.length ? "Diğer modlarda gerileme: " + regressions.join(", ") : undefined;
  return {
    id: "selection-" + changes.map(c => c.path + "=" + c.after).join("|"),
    priority: "important", title: changes.length + " seçili ayar", summary: "Yalnız seçtiğiniz ayarlar, şu anki Oyun Yönetimi profili üzerinde geçici olarak denendi.",
    expectedEffect: "Geri dönüş %" + tr(validation.before.rtp) + " → %" + tr(validation.after.rtp) + "; ödeme görülen tur %" + tr(validation.before.hitRate * 100) + " → %" + tr(validation.after.hitRate * 100) + ".",
    confidence: blockedReason ? "düşük" : "orta", changes, applyable: !blockedReason, blockedReason, validation, sourceFingerprint: profileFingerprint(game),
  };
}
