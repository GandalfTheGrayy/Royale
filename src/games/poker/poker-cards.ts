export type PokerSuit = "c" | "d" | "h" | "s";
export type PokerRank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";
export type PokerCard = `${PokerRank}${PokerSuit}`;

export type HandEvaluation = {
  category: number;
  rankClass: string;
  label: string;
  score: number[];
  bestFive: PokerCard[];
};

const SUITS: PokerSuit[] = ["s", "h", "d", "c"];
const RANKS: PokerRank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
];
const RANK_VALUE: Record<PokerRank, number> = Object.fromEntries(
  RANKS.map((rank, index) => [rank, index + 2]),
) as Record<PokerRank, number>;

export const createPokerDeck = (): PokerCard[] =>
  SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}` as PokerCard));

export function shufflePokerDeck(
  cards = createPokerDeck(),
  random: () => number = Math.random,
) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
}

export function pokerCardImage(card: PokerCard) {
  const rankNames: Record<PokerRank, string> = {
    A: "ace",
    K: "king",
    Q: "queen",
    J: "jack",
    T: "10",
    "9": "9",
    "8": "8",
    "7": "7",
    "6": "6",
    "5": "5",
    "4": "4",
    "3": "3",
    "2": "2",
  };
  const suitNames: Record<PokerSuit, string> = {
    s: "spades",
    h: "hearts",
    d: "diamonds",
    c: "clubs",
  };
  const rank = card[0] as PokerRank;
  const suit = suitNames[card[1] as PokerSuit];
  return `/assets/cards/opendecks-game/card fronts/${suit}/${rankNames[rank]} of ${suit}.png`;
}

export function formatPokerCard(card: PokerCard) {
  const suits: Record<PokerSuit, string> = {
    s: "♠",
    h: "♥",
    d: "♦",
    c: "♣",
  };
  const rank = card[0] === "T" ? "10" : card[0];
  return `${rank}${suits[card[1] as PokerSuit]}`;
}

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (items.length < count) return [];
  const output: T[][] = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    for (const tail of combinations(items.slice(index + 1), count - 1))
      output.push([items[index], ...tail]);
  }
  return output;
}

function straightHigh(values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index <= unique.length - 5; index += 1) {
    const run = unique.slice(index, index + 5);
    if (run.every((value, offset) => value === run[0] - offset))
      return run[0];
  }
  return 0;
}

function evaluateFive(cards: PokerCard[]): HandEvaluation {
  const values = cards
    .map((card) => RANK_VALUE[card[0] as PokerRank])
    .sort((a, b) => b - a);
  const flush = cards.every((card) => card[1] === cards[0][1]);
  const straight = straightHigh(values);
  const groups = [...new Set(values)]
    .map((value) => ({
      value,
      count: values.filter((candidate) => candidate === value).length,
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  let score: number[];
  let rankClass: string;
  let label: string;
  if (flush && straight) {
    score = [8, straight];
    rankClass = straight === 14 ? "royal-flush" : "straight-flush";
    label = straight === 14 ? "Royal Flush" : "Straight Flush";
  } else if (groups[0].count === 4) {
    score = [7, groups[0].value, groups[1].value];
    rankClass = "four-of-a-kind";
    label = "Kare";
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    score = [6, groups[0].value, groups[1].value];
    rankClass = "full-house";
    label = "Full House";
  } else if (flush) {
    score = [5, ...values];
    rankClass = "flush";
    label = "Floş";
  } else if (straight) {
    score = [4, straight];
    rankClass = "straight";
    label = "Kent";
  } else if (groups[0].count === 3) {
    score = [3, groups[0].value, ...groups.slice(1).map((group) => group.value)];
    rankClass = "three-of-a-kind";
    label = "Üçlü";
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    score = [
      2,
      Math.max(groups[0].value, groups[1].value),
      Math.min(groups[0].value, groups[1].value),
      groups[2].value,
    ];
    rankClass = "two-pair";
    label = "İki Çift";
  } else if (groups[0].count === 2) {
    score = [1, groups[0].value, ...groups.slice(1).map((group) => group.value)];
    rankClass = "pair";
    label = "Bir Çift";
  } else {
    score = [0, ...values];
    rankClass = "high-card";
    label = "Yüksek Kart";
  }
  return { category: score[0], score, rankClass, label, bestFive: cards };
}

export function compareEvaluations(a: HandEvaluation, b: HandEvaluation) {
  const length = Math.max(a.score.length, b.score.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a.score[index] ?? 0) - (b.score[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function evaluatePokerHand(cards: PokerCard[]): HandEvaluation {
  if (cards.length < 5) throw new Error("Poker eli için en az beş kart gerekir.");
  return combinations(cards, 5)
    .map(evaluateFive)
    .sort((a, b) => compareEvaluations(b, a))[0];
}
