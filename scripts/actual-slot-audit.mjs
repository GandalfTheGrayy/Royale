import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const databasePath = join(
  process.env.LOCALAPPDATA ?? ".",
  "PehlevanRoyale",
  "pehlevan-royale.sqlite",
);
const database = new DatabaseSync(databasePath, { readOnly: true });

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quantile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * percentile)] ?? 0;
}

function longest(spins, predicate) {
  let current = 0;
  let maximum = 0;
  spins.forEach((spin) => {
    current = predicate(spin) ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  });
  return maximum;
}

const rows = database
  .prepare(
    `SELECT game, settled_at, stake, gross_payout, net, payload_json
     FROM game_rounds
     WHERE game IN ('neon-kasasi', 'kaptan-mercan')
     ORDER BY settled_at ASC`,
  )
  .all()
  .map((row) => {
    const payload = JSON.parse(row.payload_json);
    return {
      game: row.game,
      settledAt: row.settled_at,
      stake: number(row.stake),
      payout: number(row.gross_payout),
      net: number(row.net),
      profile: payload.result?.mathProfileVersion ?? "legacy/unknown",
      source:
        payload.modifiers?.source ??
        (payload.modifiers?.purchaseMultiplier
          ? "bonus-buy"
          : payload.modifiers?.freeSpin
            ? "free-spin"
            : "paid-spin"),
      bonusSessionId: payload.modifiers?.bonusSessionId,
      bonusSource: payload.modifiers?.bonusSource,
      referenceBet:
        number(payload.result?.referenceBet) ||
        number(payload.modifiers?.wager) ||
        number(row.stake),
      scatterCount: number(payload.result?.scatterCount),
      specialCount:
        number(payload.result?.captainCount) ||
        number(payload.result?.powerValues?.length),
      multiplier:
        number(payload.result?.collectionMultiplier) ||
        number(payload.result?.finalBonusMultiplier) ||
        1,
      baseReturn: number(payload.result?.baseReturn),
      cascadeCount: payload.result?.cascades?.length ?? 0,
      bonusCumulativeAfter: number(payload.modifiers?.bonusCumulativeAfter),
      freeSpinsAfter: number(payload.modifiers?.freeSpinsAfter),
    };
  });

const groups = new Map();
rows.forEach((row) => {
  const key = `${row.game}::${row.profile}::${row.source}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
});

const result = [...groups.entries()].map(([key, spins]) => {
  const [game, profile, source] = key.split("::");
  const stake = spins.reduce((sum, spin) => sum + spin.stake, 0);
  const payout = spins.reduce((sum, spin) => sum + spin.payout, 0);
  const paid = spins.filter((spin) => spin.stake > 0);
  const measured = spins.filter((spin) => spin.referenceBet > 0);
  const multiples = measured.map((spin) =>
    spin.referenceBet ? spin.payout / spin.referenceBet : 0,
  );
  return {
    game,
    profile,
    source,
    spins: spins.length,
    stake,
    payout,
    rtp: stake ? payout / stake : null,
    zeroRate: measured.length
      ? measured.filter((spin) => spin.payout === 0).length / measured.length
      : null,
    profitRate: measured.length
      ? measured.filter((spin) => spin.payout > spin.referenceBet).length /
        measured.length
      : null,
    longestZero: longest(measured, (spin) => spin.payout === 0),
    longestBelowStake: longest(
      measured,
      (spin) => spin.payout < spin.referenceBet,
    ),
    p50x: quantile(multiples, 0.5),
    p90x: quantile(multiples, 0.9),
    p99x: quantile(multiples, 0.99),
    maxX: multiples.length ? Math.max(...multiples) : 0,
    first: spins[0]?.settledAt,
    last: spins.at(-1)?.settledAt,
  };
});

const recentNeon = rows
  .filter((row) => row.game === "neon-kasasi")
  .slice(-40)
  .map((row) => ({
    at: row.settledAt,
    profile: row.profile,
    source: row.source,
    stake: row.stake,
    referenceBet: row.referenceBet,
    payout: row.payout,
    x: row.referenceBet ? row.payout / row.referenceBet : 0,
    cascades: row.cascadeCount,
    multiplier: row.multiplier,
    bonusCumulativeAfter: row.bonusCumulativeAfter,
    freeSpinsAfter: row.freeSpinsAfter,
  }));

const neonBonusSessions = Object.values(
  rows
    .filter(
      (row) =>
        row.game === "neon-kasasi" &&
        row.source === "free-spin" &&
        row.bonusSessionId,
    )
    .reduce((sessions, row) => {
      const key = row.bonusSessionId;
      const current = sessions[key] ?? {
        id: key,
        profile: row.profile,
        source: row.bonusSource,
        referenceBet: row.referenceBet,
        spins: 0,
        payout: 0,
        maxSpinX: 0,
        finalMultiplier: 1,
        at: row.settledAt,
      };
      current.spins += 1;
      current.payout += row.payout;
      current.maxSpinX = Math.max(
        current.maxSpinX,
        row.referenceBet ? row.payout / row.referenceBet : 0,
      );
      current.finalMultiplier = row.multiplier;
      current.at = row.settledAt;
      sessions[key] = current;
      return sessions;
    }, {}),
).map((session) => ({
  ...session,
  totalX: session.referenceBet ? session.payout / session.referenceBet : 0,
}));

console.log(
  JSON.stringify(
    {
      databasePath,
      totalRows: rows.length,
      groups: result,
      neonBonusSessions: neonBonusSessions.slice(-20),
      recentNeon,
    },
    null,
    2,
  ),
);
database.close();
