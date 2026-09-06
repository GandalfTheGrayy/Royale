import {
  advanceFisherBonus,
  createFisherBonus,
  createFisherBonusPickDeck,
  EMPTY_FISHER_BONUS_MODIFIERS,
  spinFisher,
  type FisherBonusModifiers,
  type FisherMathTuning,
} from "../src/games/slots/fisherman-engine.ts";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function drawBonusModifiers(random: () => number): FisherBonusModifiers {
  const modifiers = { ...EMPTY_FISHER_BONUS_MODIFIERS };
  for (const card of createFisherBonusPickDeck(random)) {
    if (card.reward === "boot") break;
    modifiers[card.reward] = true;
  }
  return modifiers;
}

const candidates: Array<{ name: string; tuning: FisherMathTuning }> = [
  {
    name: "v5-current",
    tuning: {
      payoutScale: 1,
      bonusPayoutScale: 0.95,
      bonusSpecialRate: 0.735,
      bonusPrizeRate: 0.87,
      captainRescueChancePercent: 10,
      stageInterval: 4,
      stageAwardSpins: 10,
      stageMultipliers: [1, 2, 3, 10],
    },
  },
  {
    name: "fish-forward-a",
    tuning: {
      payoutScale: 1.2,
      bonusPayoutScale: 1,
      bonusSpecialRate: 0.52,
      bonusPrizeRate: 1.65,
      captainRescueChancePercent: 48,
      stageInterval: 4,
      stageAwardSpins: 10,
      stageMultipliers: [1, 2, 3, 10],
    },
  },
  {
    name: "fish-forward-b",
    tuning: {
      payoutScale: 1.3,
      bonusPayoutScale: 1.05,
      bonusSpecialRate: 0.48,
      bonusPrizeRate: 1.85,
      captainRescueChancePercent: 58,
      stageInterval: 4,
      stageAwardSpins: 10,
      stageMultipliers: [1, 2, 3, 10],
    },
  },
  {
    name: "fish-forward-target-945",
    tuning: {
      payoutScale: 1.122,
      bonusPayoutScale: 1.05,
      bonusSpecialRate: 0.52,
      bonusPrizeRate: 1.65,
      captainRescueChancePercent: 48,
      stageInterval: 4,
      stageAwardSpins: 10,
      stageMultipliers: [1, 2, 3, 10],
    },
  },
];

const rounds = Math.max(1, Number(process.argv[2] ?? 100_000));
const wager = 1_000;

const requestedCandidate = process.argv[3];
const selectedCandidates = requestedCandidate
  ? candidates.filter((candidate) => candidate.name === requestedCandidate)
  : candidates;

const reports = selectedCandidates.map(({ name, tuning }, candidateIndex) => {
  const random = seededRandom(0x4d455243 + candidateIndex * 0x10000);
  let basePayout = 0;
  let bonusPayout = 0;
  let features = 0;
  let bonusSpins = 0;
  let captainSymbols = 0;
  let fishSymbols = 0;
  let captainSpins = 0;
  let fishSpins = 0;
  let collectionSpins = 0;
  let captainOnlySpins = 0;
  let reached2x = 0;
  let reached3x = 0;
  let reached10x = 0;
  for (let round = 0; round < rounds; round += 1) {
    const base = spinFisher(wager, { random, tuning });
    basePayout += base.grossPayout;
    if (!base.bonusSpins) continue;
    features += 1;
    const modifiers = drawBonusModifiers(random);
    let state = createFisherBonus(
      `lab-${round}`,
      base.bonusSpins,
      "natural",
      modifiers,
      tuning,
    );
    let maxMultiplier = state.multiplier;
    while (state.spinsRemaining > 0 && bonusSpins < rounds * 100) {
      const spin = spinFisher(wager, {
        bonus: true,
        bonusMultiplier: state.multiplier,
        bonusModifiers: state.modifiers,
        random,
        tuning,
      });
      bonusPayout += spin.grossPayout;
      bonusSpins += 1;
      captainSymbols += spin.captainCount;
      fishSymbols += spin.fishValues.length;
      captainSpins += Number(spin.captainCount > 0);
      fishSpins += Number(spin.fishValues.length > 0);
      collectionSpins += Number(spin.captainCount > 0 && spin.fishValues.length > 0);
      captainOnlySpins += Number(spin.captainCount > 0 && spin.fishValues.length === 0);
      state = advanceFisherBonus(state, spin, tuning).state;
      maxMultiplier = Math.max(maxMultiplier, state.multiplier, ...state.queuedBatches.map((batch) => batch.multiplier));
    }
    reached2x += Number(maxMultiplier >= 2);
    reached3x += Number(maxMultiplier >= 3);
    reached10x += Number(maxMultiplier >= 10);
  }
  const exposure = rounds * wager;
  return {
    name,
    rounds,
    rtp: Number(((basePayout + bonusPayout) / exposure).toFixed(4)),
    baseRtp: Number((basePayout / exposure).toFixed(4)),
    bonusRtp: Number((bonusPayout / exposure).toFixed(4)),
    featureFrequency: Number((rounds / features).toFixed(2)),
    averageBonusSpins: Number((bonusSpins / features).toFixed(2)),
    captainSymbolsPerSpin: Number((captainSymbols / bonusSpins).toFixed(4)),
    fishSymbolsPerSpin: Number((fishSymbols / bonusSpins).toFixed(4)),
    captainSpinRate: Number((captainSpins / bonusSpins).toFixed(4)),
    fishSpinRate: Number((fishSpins / bonusSpins).toFixed(4)),
    collectionSpinRate: Number((collectionSpins / bonusSpins).toFixed(4)),
    captainWithoutFishRate: Number((captainOnlySpins / bonusSpins).toFixed(4)),
    reached2xRate: Number((reached2x / features).toFixed(4)),
    reached3xRate: Number((reached3x / features).toFixed(4)),
    reached10xRate: Number((reached10x / features).toFixed(4)),
  };
});

console.log(JSON.stringify(reports, null, 2));
