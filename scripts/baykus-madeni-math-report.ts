import { DEFAULT_MINE_DROP_TUNING, type MineDropTuningSettings } from "../src/data/casino-admin";
import { createMine, createMineBonusProgress, rollMysteryOutcome, runMineSpin, seededMineRandom, settleMineBonusSpin, type MineBonusTier, type MinePaidMode, type MineState } from "../src/games/slots/baykus-madeni-engine";

const count = Number(process.env.MINE_SAMPLES ?? 20_000);
const seed = Number(process.env.MINE_SEED ?? 20260906);
const tuning: MineDropTuningSettings = structuredClone(DEFAULT_MINE_DROP_TUNING);
if (!Number.isSafeInteger(count) || count < 2) throw new Error("MINE_SAMPLES must be an integer of at least 2.");

function bonus(tier: MineBonusTier, random: () => number, mine: MineState, maxWinX = tuning.maxWinX, sourceScale = 1) {
  let progress = createMineBonusProgress(mine);
  for (let spin = 0; spin < tuning.bonusSpins; spin++) {
    const result = runMineSpin({ mine, bonusTier: tier, random, tuning });
    mine = result.mine;
    progress = settleMineBonusSpin(progress, result, tuning.payoutScales[`bonus-${tier}`] * sourceScale, maxWinX);
  }
  return progress.totalWinX;
}

for (const mode of ["base", "extra", "super", "diamond", "obsidian", "buy-block", "buy-super", "mystery", "epic"] as const) {
  if (process.env.MINE_MODES && !process.env.MINE_MODES.split(",").includes(mode)) continue;
  const random = seededMineRandom(seed);
  const cost = mode === "epic" ? 1 : mode === "mystery" ? tuning.bonusCosts.mystery : mode === "buy-block" ? tuning.bonusCosts.block : mode === "buy-super" ? tuning.bonusCosts.super : tuning.modeCosts[mode];
  const wins: number[] = [];
  let sum = 0, sumSquares = 0, caps = 0, profitable = 0;
  for (let sample = 0; sample < count; sample++) {
    let win = 0;
    if (mode === "mystery") {
      const tier = rollMysteryOutcome(random, tuning);
      if (tier !== "none") win = bonus(tier, random, createMine(random, tuning), tuning.maxWinX, tuning.payoutScales.mystery);
    } else if (mode === "buy-block" || mode === "buy-super" || mode === "epic") {
      win = bonus(mode === "epic" ? "epic" : mode === "buy-super" ? "super" : "block", random, createMine(random, tuning));
    } else {
      const result = runMineSpin({ mode: mode as MinePaidMode, random, tuning });
      win = result.totalWinX;
      if (result.triggeredBonus) win += bonus(result.triggeredBonus, random, result.mine, tuning.maxWinX - win);
    }
    sum += win; sumSquares += win * win;
    if (win >= tuning.maxWinX) caps++;
    if (win > cost) profitable++;
    wins.push(win);
  }
  wins.sort((a, b) => a - b);
  const mean = sum / count;
  const error = 1.96 * Math.sqrt(Math.max(0, sumSquares / count - mean * mean) / count) / cost * 100;
  // Epic is a conditional bonus tier, not a separately priced purchase.
  console.log(JSON.stringify({ profile: tuning.profileName, mode, samples: count, seed, meanX: +mean.toFixed(4), returnPercent: mode === "epic" ? null : +(mean / cost * 100).toFixed(2), error95Points: mode === "epic" ? null : +error.toFixed(2), profitablePercent: mode === "epic" ? null : +(profitable / count * 100).toFixed(2), capPercent: +(caps / count * 100).toFixed(3), medianX: wins[Math.floor(count / 2)], p99X: wins[Math.floor(count * .99)] }));
}
