import type { CasinoGameId, CasinoRoundRecord } from "./casino-database";

type Contract = { version: number; fields: Record<string, string[]> };

export const ROUND_TELEMETRY_CONTRACTS: Record<CasinoGameId, Contract> = {
  blackjack: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      hands: ["result.playerHands"],
      outcomes: ["result.handResults"],
    },
  },
  roulette: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      result: ["result.number"],
      bets: ["result.bets"],
    },
  },
  poker: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      hand: ["result.handId"],
      stacks: ["result.finalStacks"],
      showdown: ["result.showdown", "result.payouts"],
    },
  },
  "kiraz-77": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      grid: ["result.grid"],
      wins: ["result.wins"],
      multiplier: ["result.winMultiple"],
    },
  },
  "neon-kasasi": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      cascades: ["result.cascades"],
      multipliers: ["result.finalPowerGrid", "result.appliedMultiplier"],
      bonus: ["result.freeSpinsAwarded"],
    },
  },
  "kaptan-mercan": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      fish: ["result.moneyFishValues"],
      captain: ["result.captainCount"],
      collection: [
        "result.collectedFishMultiplier",
        "result.collectionMultiplier",
      ],
    },
  },
  "sekerhane-1024": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      cascades: ["result.cascades"],
      cells: ["result.finalSpots"],
      bonus: ["result.freeSpinsAwarded"],
    },
  },
  "allahin-lutfu": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      grid: ["result.initialGrid", "result.finalGrid"],
      features: ["result.featureCycles"],
      payout: ["result.grossMultiplier"],
    },
  },
  "baykus-madeni": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      reel: ["result.reel"],
      mine: ["result.mine"],
      features: ["result.events", "result.triggeredBonus"],
      payout: ["result.grossMultiplier"],
    },
  },
  "altin-rota": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      crash: ["result.crashPoint"],
      bets: ["modifiers.bets"],
    },
  },
  limbo: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      target: ["result.target"],
      result: ["result.result"],
      fairness: ["result.commitment", "result.digest"],
    },
  },
  "obsidyen-damari": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      hazards: ["result.mineCount", "result.depthHazards"],
      progress: ["result.safeReveals"],
      multiplier: ["result.maxMultiplier", "result.currentMultiplier"],
    },
  },
  mines: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      hazards: ["result.mineCount"],
      progress: ["result.safeReveals"],
      multiplier: ["result.currentMultiplier"],
      fairness: ["result.commitment", "result.digest"],
    },
  },
  keno: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      selected: ["result.selected"],
      drawn: ["result.drawn"],
      hits: ["result.hits"],
      multiplier: ["result.multiplier"],
    },
  },
  "son-on": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      progress: ["result.safeSteps"],
      hazards: ["result.hazardIndices"],
      multiplier: ["result.currentMultiplier"],
    },
  },
  plinko: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      rows: ["result.rows"],
      risk: ["result.risk"],
      path: ["result.directions"],
      multiplier: ["result.multiplier"],
    },
  },
  hilo: {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      cards: ["result.cards"],
      choices: ["result.correctGuesses", "result.lastResult"],
      multiplier: ["result.multiplier"],
      fairness: ["result.commitment", "result.digest"],
    },
  },
  "yedi-cevher": {
    version: 1,
    fields: {
      version: ["result.telemetryVersion"],
      gems: ["result.gems"],
      combination: ["result.combination"],
      multiplier: ["result.multiplier"],
      fairness: ["result.commitment", "result.digest"],
    },
  },
};

function hasPath(value: unknown, path: string) {
  let current = value;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || !(part in current))
      return false;
    current = (current as Record<string, unknown>)[part];
  }
  return current !== undefined;
}

export function auditCasinoRoundTelemetry(record: CasinoRoundRecord) {
  const contract = ROUND_TELEMETRY_CONTRACTS[record.game];
  const missing = Object.entries(contract.fields)
    .filter(
      ([, alternatives]) => !alternatives.some((path) => hasPath(record, path)),
    )
    .map(([field]) => field);
  return {
    contractVersion: contract.version,
    checkedAt: record.settledAt,
    complete: missing.length === 0,
    missing,
  };
}

export function withCasinoRoundTelemetryAudit(
  record: CasinoRoundRecord,
): CasinoRoundRecord {
  return {
    ...record,
    result: {
      ...record.result,
      telemetryAudit: auditCasinoRoundTelemetry(record),
    },
  };
}
