import { runNeonSpin } from "../src/games/slots/neon-engine.ts";
import {
  advanceFisherBonus,
  createFisherBonus,
  createFisherBonusPickDeck,
  EMPTY_FISHER_BONUS_MODIFIERS,
  spinFisher,
  type FisherBonusModifiers,
} from "../src/games/slots/fisherman-engine.ts";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  const float = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  return { float, index: (max: number) => Math.floor(float() * max) };
}
const rounds = Number(process.argv[2] ?? 20_000);
const wager = 1_000;
const fisherTuning = {
  bonusPayoutScale: 0.95,
  bonusSpecialRate: 0.735,
  bonusPrizeRate: 0.87,
  stageInterval: 4,
  stageAwardSpins: 10,
  stageMultipliers: [1, 2, 3, 10],
};

function drawBonusModifiers(random: () => number): FisherBonusModifiers {
  const modifiers = { ...EMPTY_FISHER_BONUS_MODIFIERS };
  for (const card of createFisherBonusPickDeck(random)) {
    if (card.reward === "boot") break;
    modifiers[card.reward] = true;
  }
  return modifiers;
}

const neonRandom = seededRandom(0x4e425559);
let neonWin = 0;
for (let round = 0; round < rounds; round += 1) {
  let remaining = 15;
  let multiplier = 0;
  while (remaining > 0) {
    remaining -= 1;
    const spin = runNeonSpin(wager, neonRandom.index, {
      bonusMode: true,
      bonusMultiplier: multiplier,
    });
    multiplier = spin.finalBonusMultiplier;
    neonWin += spin.grossReturn;
    remaining += spin.freeSpinsAwarded;
  }
}

const fisherRandom = seededRandom(0x46425559);
let fisherWin = 0;
for (let round = 0; round < rounds; round += 1) {
  const modifiers = drawBonusModifiers(fisherRandom.float);
  let state = createFisherBonus(
    `buy-${round}`,
    15,
    "buy",
    modifiers,
    fisherTuning,
  );
  while (state.spinsRemaining > 0) {
    const spin = spinFisher(wager, {
      bonus: true,
      bonusMultiplier: state.multiplier,
      random: fisherRandom.float,
      tuning: fisherTuning,
      bonusModifiers: state.modifiers,
    });
    fisherWin += spin.grossPayout;
    state = advanceFisherBonus(state, spin, fisherTuning).state;
  }
}

console.log(
  JSON.stringify(
    {
      rounds,
      neon: {
        averageWinX: neonWin / rounds / wager,
        fairCostAt947Rtp: neonWin / rounds / wager / 0.947,
      },
      fisher: {
        averageWinX: fisherWin / rounds / wager,
        fairCostAt947Rtp: fisherWin / rounds / wager / 0.947,
      },
    },
    null,
    2,
  ),
);
