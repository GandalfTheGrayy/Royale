import { openingReward } from "../wagering";
import {
  compareEvaluations,
  evaluatePokerHand,
  shufflePokerDeck,
  type HandEvaluation,
  type PokerCard,
} from "./poker-cards";

export type CasinoHoldemDeal = {
  player: [PokerCard, PokerCard];
  dealer: [PokerCard, PokerCard];
  flop: [PokerCard, PokerCard, PokerCard];
  turn: PokerCard;
  river: PokerCard;
};

export type CasinoHoldemResolution = {
  playerHand: HandEvaluation;
  dealerHand: HandEvaluation;
  dealerQualifies: boolean;
  result: "fold" | "player" | "dealer" | "push" | "dealer-no-qualify";
  anteMultiplier: number;
  aaMultiplier: number;
  stake: number;
  anteGross: number;
  callGross: number;
  aaGross: number;
  grossPayout: number;
  openingBonus: number;
  net: number;
  message: string;
};

export function dealCasinoHoldem(random: () => number = Math.random): CasinoHoldemDeal {
  const deck = shufflePokerDeck(undefined, random);
  return {
    player: [deck[0], deck[2]],
    dealer: [deck[1], deck[3]],
    flop: [deck[4], deck[5], deck[6]],
    turn: deck[7],
    river: deck[8],
  };
}

export function dealerQualifies(hand: HandEvaluation) {
  return hand.category > 1 || (hand.category === 1 && hand.score[1] >= 4);
}

export function anteWinMultiplier(hand: HandEvaluation) {
  if (hand.rankClass === "royal-flush") return 100;
  if (hand.rankClass === "straight-flush") return 20;
  if (hand.rankClass === "four-of-a-kind") return 10;
  if (hand.rankClass === "full-house") return 3;
  if (hand.rankClass === "flush") return 2;
  return 1;
}

export function aaBonusMultiplier(hand: HandEvaluation) {
  if (hand.rankClass === "royal-flush") return 100;
  if (hand.rankClass === "straight-flush") return 50;
  if (hand.rankClass === "four-of-a-kind") return 40;
  if (hand.rankClass === "full-house") return 30;
  if (hand.rankClass === "flush") return 20;
  if (
    hand.rankClass === "straight" ||
    hand.rankClass === "three-of-a-kind" ||
    hand.rankClass === "two-pair" ||
    (hand.rankClass === "pair" && hand.score[1] === 14)
  )
    return 7;
  return 0;
}

export function resolveCasinoHoldem(
  deal: CasinoHoldemDeal,
  ante: number,
  aaBet: number,
  called: boolean,
  openingBoost = 0,
): CasinoHoldemResolution {
  const board = [...deal.flop, deal.turn, deal.river];
  const playerHand = evaluatePokerHand([...deal.player, ...board]);
  const dealerHand = evaluatePokerHand([...deal.dealer, ...board]);
  const qualifies = dealerQualifies(dealerHand);
  const anteMultiplier = anteWinMultiplier(playerHand);
  const aaHand = evaluatePokerHand([...deal.player, ...deal.flop]);
  const aaMultiplier = called ? aaBonusMultiplier(aaHand) : 0;
  const call = called ? ante * 2 : 0;
  const stake = ante + aaBet + call;
  let mainGross = 0;
  let anteGross = 0;
  let callGross = 0;
  let result: CasinoHoldemResolution["result"] = "fold";
  let message = "Elini bıraktın; Ante ve AA bahisleri masada kaldı.";

  if (called) {
    const comparison = compareEvaluations(playerHand, dealerHand);
    if (!qualifies) {
      result = "dealer-no-qualify";
      anteGross = ante * (anteMultiplier + 1);
      callGross = call;
      mainGross = anteGross + callGross;
      message = `Leyla açılmadı. ${playerHand.label} için Ante ödendi, Call iade edildi.`;
    } else if (comparison > 0) {
      result = "player";
      anteGross = ante * (anteMultiplier + 1);
      callGross = call * 2;
      mainGross = anteGross + callGross;
      message = `${playerHand.label}, Leyla'nın ${dealerHand.label} elini geçti.`;
    } else if (comparison === 0) {
      result = "push";
      anteGross = ante;
      callGross = call;
      mainGross = anteGross + callGross;
      message = `İkinizde de ${playerHand.label}. Ana bahisler iade.`;
    } else {
      result = "dealer";
      message = `Leyla ${dealerHand.label} ile eli aldı.`;
    }
  }

  const aaGross = aaMultiplier ? aaBet * (aaMultiplier + 1) : 0;
  const openingBonus = openingReward(mainGross + aaGross, stake, openingBoost);
  const grossPayout = mainGross + aaGross + openingBonus;
  return {
    playerHand,
    dealerHand,
    dealerQualifies: qualifies,
    result,
    anteMultiplier,
    aaMultiplier,
    stake,
    anteGross,
    callGross,
    aaGross,
    grossPayout,
    openingBonus,
    net: grossPayout - stake,
    message,
  };
}
