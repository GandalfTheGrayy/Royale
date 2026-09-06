import {
  ALLAH_MAX_WIN_X,
  ALLAH_PURCHASE_COST_X,
  createSeededAllahRandom,
  defaultAllahPersistentState,
  runAllahSpin,
} from "../src/games/slots/allahin-lutfu-engine.ts";

const requestedSpins = Number(process.argv[2] ?? 2_000);
const spins = Number.isFinite(requestedSpins)
  ? Math.max(1, Math.floor(requestedSpins))
  : 2_000;
const scope = process.argv[3] ?? "all";
const modes = ["base", "enhancer", "degen", "trickster", "fate"];

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function summarize(mode) {
  const multipliers = [];
  const initialKinds = new Map();
  let hitCount = 0;
  let profitCount = 0;
  let maxWinCount = 0;
  let maxCollector = 0;
  let totalFeatureCycles = 0;
  const costX = ALLAH_PURCHASE_COST_X[mode];
  for (let index = 0; index < spins; index += 1) {
    const result = runAllahSpin(
      {
        wager: 1,
        mode,
        runId: `simulation-${mode}-${index}`,
        persistent: defaultAllahPersistentState(),
      },
      createSeededAllahRandom(0x9e3779b9 ^ (index + modes.indexOf(mode) * 10_000_000)),
    );
    multipliers.push(result.grossMultiplier);
    if (result.grossMultiplier > 0) hitCount += 1;
    if (result.grossMultiplier > costX) profitCount += 1;
    if (result.grossMultiplier >= ALLAH_MAX_WIN_X) maxWinCount += 1;
    maxCollector = Math.max(maxCollector, result.collectorWinX);
    totalFeatureCycles += result.featureCycles;
    for (const cell of result.initialGrid.flat())
      initialKinds.set(cell.kind, (initialKinds.get(cell.kind) ?? 0) + 1);
  }

  multipliers.sort((a, b) => a - b);
  const totalMultiplier = multipliers.reduce((sum, value) => sum + value, 0);
  return {
    mode,
    spins,
    costX,
    observedRtpPercent: Number(((totalMultiplier / spins / costX) * 100).toFixed(4)),
    hitRatePercent: Number((hitCount / spins * 100).toFixed(2)),
    profitRatePercent: Number((profitCount / spins * 100).toFixed(2)),
    maxWinRatePercent: Number((maxWinCount / spins * 100).toFixed(4)),
    p50: percentile(multipliers, 0.5),
    p90: percentile(multipliers, 0.9),
    p99: percentile(multipliers, 0.99),
    maximum: multipliers.at(-1) ?? 0,
    maxCollector,
    averageFeatureCycles: Number((totalFeatureCycles / spins).toFixed(4)),
    initialKinds: Object.fromEntries([...initialKinds].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function summarizeBonus(startTier, costX) {
  const sessionCount = Math.max(1, Math.floor(spins / 10));
  const payouts = [];
  let maxWinSpins = 0;
  let highestSpin = 0;
  let upgrades = 0;
  for (let session = 0; session < sessionCount; session += 1) {
    let persistent = {
      ...defaultAllahPersistentState(),
      persistentEye: startTier === "free" ? undefined : "gold",
    };
    let bonus = { tier: startTier, remaining: 10, totalSpins: 0, totalPayout: 0 };
    let total = 0;
    for (let spin = 0; spin < 10; spin += 1) {
      const result = runAllahSpin(
        {
          wager: 1,
          mode: "base",
          runId: `simulation-bonus-${startTier}-${session}-${spin}`,
          persistent,
          bonus,
        },
        createSeededAllahRandom(0x85ebca6b ^ (session * 31 + spin)),
      );
      total += result.grossMultiplier;
      highestSpin = Math.max(highestSpin, result.grossMultiplier);
      if (result.maxWin) maxWinSpins += 1;
      if (result.bonusUpgrade) upgrades += 1;
      persistent = result.persistent;
      bonus = result.nextBonus;
    }
    payouts.push(total);
  }
  payouts.sort((a, b) => a - b);
  const total = payouts.reduce((sum, value) => sum + value, 0);
  return {
    mode: `${startTier}-bonus-session`,
    sessions: sessionCount,
    spins: sessionCount * 10,
    costX,
    observedRtpPercent: costX
      ? Number((total / sessionCount / costX * 100).toFixed(4))
      : null,
    averageSessionPayoutX: Number((total / sessionCount).toFixed(4)),
    p50SessionX: percentile(payouts, 0.5),
    p90SessionX: percentile(payouts, 0.9),
    p99SessionX: percentile(payouts, 0.99),
    highestSpinX: highestSpin,
    maxWinSpinRatePercent: Number((maxWinSpins / (sessionCount * 10) * 100).toFixed(4)),
    upgradeRatePerSession: Number((upgrades / sessionCount).toFixed(4)),
  };
}

const paidResults = scope === "bonus"
  ? []
  : modes.filter((mode) => scope === "all" || scope === "paid" || scope === mode).map(summarize);
const bonusConfigurations = [
  ["free", 200],
  ["super", 1_000],
  ["legendary", 0],
  ["mythic", 0],
];
const bonusResults = bonusConfigurations
  .filter(([tier]) => scope === "all" || scope === "bonus" || scope === `bonus-${tier}`)
  .map(([tier, costX]) => summarizeBonus(tier, costX));
console.log(JSON.stringify([...paidResults, ...bonusResults], null, 2));
