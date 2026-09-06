import {
  runNeonSpin,
  type NeonMathTuning,
} from "../src/games/slots/neon-engine.ts";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return (max: number) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return Math.floor((state / 4_294_967_296) * max);
  };
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))
  ];
}

const lowPowerWeights = {
  "2": 440000,
  "3": 285000,
  "4": 145000,
  "5": 80000,
  "10": 33000,
  "15": 11000,
  "25": 4500,
  "50": 1200,
  "100": 250,
  "500": 15,
  "1000": 1,
};

const candidates: Record<string, NeonMathTuning> = {
  current: {},
  frequentA: {
    minimumCluster: 4,
    payoutScale: 0.42,
    bonusPayoutScale: 0.36,
    cascadeAffinityPercent: 25,
    baseSpecialRate: 55,
    bonusSpecialRate: 115,
    valueWeights: lowPowerWeights,
  },
  frequentB: {
    minimumCluster: 4,
    payoutScale: 0.38,
    bonusPayoutScale: 0.32,
    cascadeAffinityPercent: 27,
    baseSpecialRate: 58,
    bonusSpecialRate: 125,
    valueWeights: lowPowerWeights,
  },
  frequentC: {
    minimumCluster: 4,
    payoutScale: 0.34,
    bonusPayoutScale: 0.29,
    cascadeAffinityPercent: 29,
    baseSpecialRate: 60,
    bonusSpecialRate: 135,
    valueWeights: lowPowerWeights,
  },
  frequentD: {
    minimumCluster: 4,
    payoutScale: 0.58,
    bonusPayoutScale: 0.5,
    cascadeAffinityPercent: 25,
    baseSpecialRate: 55,
    bonusSpecialRate: 115,
    valueWeights: lowPowerWeights,
  },
  frequentE: {
    minimumCluster: 4,
    payoutScale: 0.56,
    bonusPayoutScale: 0.53,
    cascadeAffinityPercent: 25,
    baseSpecialRate: 55,
    bonusSpecialRate: 115,
    valueWeights: lowPowerWeights,
  },
  frequentF: {
    minimumCluster: 4,
    payoutScale: 0.569,
    bonusPayoutScale: 0.491,
    cascadeAffinityPercent: 25,
    baseSpecialRate: 55,
    bonusSpecialRate: 115,
    valueWeights: lowPowerWeights,
  },
};

function simulate(name: string, tuning: NeonMathTuning, rounds: number) {
  const wager = 1_000;
  const random = seededRandom(0x4e454f4e);
  let baseWin = 0;
  let bonusWin = 0;
  let paidHits = 0;
  let paidProfit = 0;
  let features = 0;
  let bonusSpins = 0;
  let blankBonusSpins = 0;
  let profitableBonusSpins = 0;
  let longestBlank = 0;
  let blankRun = 0;
  const featureWins: number[] = [];
  const featureFinalMultipliers: number[] = [];

  for (let round = 0; round < rounds; round += 1) {
    const base = runNeonSpin(wager, random, { tuning });
    baseWin += base.grossReturn;
    if (base.grossReturn > 0) paidHits += 1;
    if (base.grossReturn > wager) paidProfit += 1;
    blankRun = base.grossReturn === 0 ? blankRun + 1 : 0;
    longestBlank = Math.max(longestBlank, blankRun);
    if (!base.freeSpinsAwarded) continue;

    features += 1;
    let remaining = base.freeSpinsAwarded;
    let multiplier = 0;
    let sessionWin = 0;
    let guard = 0;
    while (remaining > 0 && guard < 500) {
      guard += 1;
      remaining -= 1;
      bonusSpins += 1;
      const spin = runNeonSpin(wager, random, {
        tuning,
        bonusMode: true,
        bonusMultiplier: multiplier,
      });
      multiplier = spin.finalBonusMultiplier;
      sessionWin += spin.grossReturn;
      bonusWin += spin.grossReturn;
      if (spin.grossReturn === 0) blankBonusSpins += 1;
      if (spin.grossReturn > wager) profitableBonusSpins += 1;
      remaining += spin.freeSpinsAwarded;
    }
    featureWins.push(sessionWin / wager);
    featureFinalMultipliers.push(multiplier);
  }

  return {
    name,
    rounds,
    rtp: (baseWin + bonusWin) / (rounds * wager),
    baseRtp: baseWin / (rounds * wager),
    bonusRtp: bonusWin / (rounds * wager),
    paidHitRate: paidHits / rounds,
    paidProfitRate: paidProfit / rounds,
    longestPaidBlank: longestBlank,
    featureFrequency: features ? rounds / features : 0,
    bonusSpinBlankRate: bonusSpins ? blankBonusSpins / bonusSpins : 0,
    bonusSpinProfitRate: bonusSpins ? profitableBonusSpins / bonusSpins : 0,
    feature: {
      median: quantile(featureWins, 0.5),
      p90: quantile(featureWins, 0.9),
      p99: quantile(featureWins, 0.99),
      max: Math.max(0, ...featureWins),
    },
    finalMultiplier: {
      median: quantile(featureFinalMultipliers, 0.5),
      p90: quantile(featureFinalMultipliers, 0.9),
      p99: quantile(featureFinalMultipliers, 0.99),
      max: Math.max(0, ...featureFinalMultipliers),
    },
  };
}

const rounds = Number(process.argv[2] ?? 100_000);
const requested = (
  process.env.NEON_PROFILES ?? Object.keys(candidates).join(",")
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
console.log(
  JSON.stringify(
    Object.fromEntries(
      requested.map((name) => [name, simulate(name, candidates[name], rounds)]),
    ),
    null,
    2,
  ),
);
