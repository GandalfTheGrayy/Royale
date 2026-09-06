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
  const float = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  return float;
}

const candidates: Record<string, FisherMathTuning> = {
  baseline: {},
  balancedA: {
    bonusSpecialRate: 1.15,
    bonusPrizeRate: 2.5,
    valueWeights: {
      "1": 38,
      "2": 30,
      "3": 22,
      "5": 18,
      "10": 8,
      "15": 3,
      "25": 1,
      "50": 0.25,
      "100": 0.04,
      "500": 0.004,
      "1000": 0.0006,
      "2500": 0.00005,
    },
  },
  balancedB: {
    bonusSpecialRate: 1.3,
    bonusPrizeRate: 2.1,
    valueWeights: {
      "1": 36,
      "2": 30,
      "3": 23,
      "5": 19,
      "10": 8.5,
      "15": 3,
      "25": 0.8,
      "50": 0.18,
      "100": 0.025,
      "500": 0.0025,
      "1000": 0.00035,
      "2500": 0.000025,
    },
  },
  balancedC: {
    bonusSpecialRate: 1.05,
    bonusPrizeRate: 3.1,
    valueWeights: {
      "1": 34,
      "2": 30,
      "3": 25,
      "5": 21,
      "10": 9,
      "15": 3.5,
      "25": 0.9,
      "50": 0.2,
      "100": 0.03,
      "500": 0.003,
      "1000": 0.0004,
      "2500": 0.00003,
    },
  },
  lineLiftD: {
    bonusPayoutScale: 1.8,
    bonusSpecialRate: 0.95,
    bonusPrizeRate: 1.5,
  },
  lineLiftE: {
    bonusPayoutScale: 2,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.15,
  },
  lineLiftF: {
    bonusPayoutScale: 1.65,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.8,
    valueWeights: {
      "1": 40,
      "2": 30,
      "3": 22,
      "5": 17,
      "10": 7.5,
      "15": 3,
      "25": 1,
      "50": 0.3,
      "100": 0.06,
      "500": 0.006,
      "1000": 0.001,
      "2500": 0.00008,
    },
  },
  lineLiftG: {
    bonusPayoutScale: 2,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.5,
  },
  lineLiftH: {
    bonusPayoutScale: 2.2,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.35,
  },
  lineLiftI: {
    bonusPayoutScale: 2.4,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.2,
  },
  finalJ: {
    bonusPayoutScale: 2.2,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.3,
  },
  finalK: {
    bonusPayoutScale: 2.2,
    bonusSpecialRate: 1,
    bonusPrizeRate: 1.38,
  },
  missionA: {
    bonusPayoutScale: 0.7,
    bonusSpecialRate: 0.55,
    bonusPrizeRate: 0.85,
  },
  missionB: {
    bonusPayoutScale: 0.8,
    bonusSpecialRate: 0.6,
    bonusPrizeRate: 0.75,
  },
  missionC: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.55,
    bonusPrizeRate: 0.65,
  },
  missionD: {
    bonusPayoutScale: 0.9,
    bonusSpecialRate: 0.5,
    bonusPrizeRate: 0.75,
  },
  missionE: {
    bonusPayoutScale: 0.9,
    bonusSpecialRate: 0.7,
    bonusPrizeRate: 0.85,
  },
  missionF: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.7,
    bonusPrizeRate: 0.9,
  },
  missionG: {
    bonusPayoutScale: 1.2,
    bonusSpecialRate: 0.65,
    bonusPrizeRate: 0.85,
  },
  missionH: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.75,
    bonusPrizeRate: 0.85,
  },
  missionI: {
    bonusPayoutScale: 0.95,
    bonusSpecialRate: 0.7,
    bonusPrizeRate: 0.875,
  },
  missionJ: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.68,
    bonusPrizeRate: 0.9,
  },
  missionK: {
    bonusPayoutScale: 0.95,
    bonusSpecialRate: 0.72,
    bonusPrizeRate: 0.85,
  },
  missionL: {
    bonusPayoutScale: 0.94,
    bonusSpecialRate: 0.72,
    bonusPrizeRate: 0.85,
  },
  missionM: {
    bonusPayoutScale: 0.95,
    bonusSpecialRate: 0.715,
    bonusPrizeRate: 0.85,
  },
  missionN: {
    bonusPayoutScale: 0.94,
    bonusSpecialRate: 0.71,
    bonusPrizeRate: 0.86,
  },
  missionO: {
    bonusPayoutScale: 0.93,
    bonusSpecialRate: 0.705,
    bonusPrizeRate: 0.855,
  },
  missionP: {
    bonusPayoutScale: 0.9,
    bonusSpecialRate: 0.71,
    bonusPrizeRate: 0.86,
  },
  queueQ: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.73,
    bonusPrizeRate: 0.88,
  },
  queueR: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.75,
    bonusPrizeRate: 0.86,
  },
  queueS: {
    bonusPayoutScale: 0.95,
    bonusSpecialRate: 0.75,
    bonusPrizeRate: 0.88,
  },
  queueT: {
    bonusPayoutScale: 1.05,
    bonusSpecialRate: 0.72,
    bonusPrizeRate: 0.88,
  },
  queueU: {
    bonusPayoutScale: 1,
    bonusSpecialRate: 0.74,
    bonusPrizeRate: 0.87,
  },
  queueV: {
    bonusPayoutScale: 0.98,
    bonusSpecialRate: 0.735,
    bonusPrizeRate: 0.87,
  },
  queueW: {
    bonusPayoutScale: 0.95,
    bonusSpecialRate: 0.735,
    bonusPrizeRate: 0.87,
  },
};

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ??
    0
  );
}

function drawBonusModifiers(random: () => number): FisherBonusModifiers {
  const modifiers = { ...EMPTY_FISHER_BONUS_MODIFIERS };
  for (const card of createFisherBonusPickDeck(random)) {
    if (card.reward === "boot") break;
    modifiers[card.reward] = true;
  }
  return modifiers;
}

function simulate(rounds: number, tuning: FisherMathTuning, seed: number) {
  const wager = 1_000;
  const random = seededRandom(seed);
  let total = 0;
  let baseTotal = 0;
  let bonusTotal = 0;
  let features = 0;
  const featureWins: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const base = spinFisher(wager, { random, tuning });
    baseTotal += base.grossPayout;
    let featureWin = 0;
    if (base.bonusSpins > 0) {
      features += 1;
      const modifiers = drawBonusModifiers(random);
      let state = createFisherBonus(
        `profile-${round}`,
        base.bonusSpins,
        "natural",
        modifiers,
        tuning,
      );
      let guard = 0;
      while (state.spinsRemaining > 0 && guard < 500) {
        guard += 1;
        const spin = spinFisher(wager, {
          bonus: true,
          bonusMultiplier: state.multiplier,
          random,
          tuning,
          bonusModifiers: state.modifiers,
        });
        featureWin += spin.grossPayout;
        state = advanceFisherBonus(state, spin, tuning).state;
      }
      featureWins.push(featureWin / wager);
    }
    bonusTotal += featureWin;
    total += base.grossPayout + featureWin;
  }
  return {
    rounds,
    rtp: total / (rounds * wager),
    baseRtp: baseTotal / (rounds * wager),
    bonusRtp: bonusTotal / (rounds * wager),
    featureFrequency: features ? rounds / features : 0,
    feature: {
      median: quantile(featureWins, 0.5),
      p75: quantile(featureWins, 0.75),
      p90: quantile(featureWins, 0.9),
      p99: quantile(featureWins, 0.99),
      under10:
        featureWins.filter((value) => value < 10).length /
        Math.max(1, featureWins.length),
      under20:
        featureWins.filter((value) => value < 20).length /
        Math.max(1, featureWins.length),
      max: Math.max(0, ...featureWins),
    },
  };
}

const rounds = Number(process.argv[2] ?? 200_000);
const requested = new Set(
  (process.env.FISHER_PROFILES ?? "").split(",").filter(Boolean),
);
const profiles = Object.entries(candidates).filter(
  ([name]) => !requested.size || requested.has(name),
);
console.log(
  JSON.stringify(
    Object.fromEntries(
      profiles.map(([name, tuning]) => [
        name,
        simulate(rounds, tuning, 0x4d455243),
      ]),
    ),
    null,
    2,
  ),
);
