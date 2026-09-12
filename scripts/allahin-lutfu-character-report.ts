import { DEFAULT_ALLAH_TUNING, type AllahSceneId } from "../src/data/casino-admin";
import {
  createSeededAllahRandom,
  defaultAllahPersistentState,
  runAllahSpin,
  type AllahPurchaseMode,
} from "../src/games/slots/allahin-lutfu-engine";

const requested = Number(process.argv[2] ?? 20_000);
const spins = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 20_000;
const scope = process.argv[3] ?? "paid";
const paidModes: AllahPurchaseMode[] = ["base", "enhancer", "degen", "trickster", "fate"];

type SceneStats = {
  count: number;
  totalX: number;
  profitable: number;
  featureSpins: number;
  deadModifiers: number;
  collectors: number;
  coins: number;
  eyes: number;
  eyeSpins: number;
  mysteryEyes: number;
};

for (const mode of paidModes.filter((candidate) => scope === "paid" || scope === "all" || scope === candidate)) {
  const byScene = new Map<AllahSceneId, SceneStats>();
  const costX = DEFAULT_ALLAH_TUNING.modeCosts[mode];
  for (let index = 0; index < spins; index += 1) {
    const result = runAllahSpin(
      { wager: 1, mode, persistent: defaultAllahPersistentState(), runId: `character-${mode}-${index}` },
      createSeededAllahRandom(0x6c8e9cf5 ^ (index + paidModes.indexOf(mode) * 10_000_000)),
    );
    const current = byScene.get(result.scene) ?? {
      count: 0, totalX: 0, profitable: 0, featureSpins: 0,
      deadModifiers: 0, collectors: 0, coins: 0, eyes: 0, eyeSpins: 0, mysteryEyes: 0,
    };
    current.count += 1;
    current.totalX += result.grossMultiplier;
    current.profitable += Number(result.grossMultiplier > costX);
    current.featureSpins += Number(result.featureCycles > 0);
    current.deadModifiers += result.events.filter(
      (event) => event.type === "board-multiplier-reveal" && event.payload.dormant === true,
    ).length;
    current.collectors += result.events.filter((event) => event.type === "collector-wake").length;
    current.coins += result.events.filter(
      (event) => event.type === "mystery-reveal" && event.payload.revealedKind === "coin",
    ).length;
    const initialEyes = result.initialGrid.flat().filter((cell) => cell.kind === "eye").length;
    current.eyes += initialEyes;
    current.eyeSpins += Number(initialEyes > 0);
    current.mysteryEyes += result.events.filter(
      (event) => event.type === "mystery-reveal" && event.payload.revealedKind === "eye",
    ).length;
    byScene.set(result.scene, current);
  }
  const rows = [...byScene.entries()].map(([scene, stats]) => ({
    scene,
    sharePercent: +(stats.count / spins * 100).toFixed(3),
    averageX: +(stats.totalX / stats.count).toFixed(4),
    rtpContributionPoints: +(stats.totalX / spins / costX * 100).toFixed(4),
    profitRatePercent: +(stats.profitable / stats.count * 100).toFixed(2),
    featureRatePercent: +(stats.featureSpins / stats.count * 100).toFixed(2),
    collectorsPerSpin: +(stats.collectors / stats.count).toFixed(3),
    mysteryCoinsPerSpin: +(stats.coins / stats.count).toFixed(3),
    initialEyesPerSpin: +(stats.eyes / stats.count).toFixed(3),
    initialEyeSpinRatePercent: +(stats.eyeSpins / stats.count * 100).toFixed(2),
    mysteryEyesPerSpin: +(stats.mysteryEyes / stats.count).toFixed(3),
    deadModifiersPerSpin: +(stats.deadModifiers / stats.count).toFixed(3),
  })).sort((left, right) => right.rtpContributionPoints - left.rtpContributionPoints);
  console.log(JSON.stringify({
    profile: DEFAULT_ALLAH_TUNING.profileName,
    mode,
    spins,
    costX,
    observedRtpPercent: +rows.reduce((sum, row) => sum + row.rtpContributionPoints, 0).toFixed(4),
    initialEyeSpinRatePercent: +([...byScene.values()].reduce((sum, stats) => sum + stats.eyeSpins, 0) / spins * 100).toFixed(2),
    initialEyesPerSpin: +([...byScene.values()].reduce((sum, stats) => sum + stats.eyes, 0) / spins).toFixed(3),
    mysteryEyesPerSpin: +([...byScene.values()].reduce((sum, stats) => sum + stats.mysteryEyes, 0) / spins).toFixed(4),
    scenes: rows,
  }, null, 2));
}
