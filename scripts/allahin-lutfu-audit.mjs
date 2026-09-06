import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const hours = Math.max(1, Number(process.argv[2] ?? 48));
const cutoff = new Date(Date.now() - hours * 60 * 60 * 1_000).toISOString();
const databasePath = join(
  process.env.LOCALAPPDATA ?? ".",
  "PehlevanRoyale",
  "pehlevan-royale.sqlite",
);
const database = new DatabaseSync(databasePath, { readOnly: true });

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quantile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * percentile)] ?? 0;
}

const rows = database.prepare(`
  SELECT settled_at, stake, gross_payout, net, outcome, payload_json
  FROM game_rounds
  WHERE game = 'allahin-lutfu' AND settled_at >= ?
  ORDER BY settled_at ASC
`).all(cutoff).map((row) => {
  const payload = JSON.parse(row.payload_json);
  const result = payload.result ?? {};
  const modifiers = payload.modifiers ?? {};
  return {
    at: row.settled_at,
    stake: n(row.stake),
    payout: n(row.gross_payout),
    net: n(row.net),
    outcome: row.outcome,
    balanceBefore: n(payload.balanceBefore),
    balanceAfter: n(payload.balanceAfter),
    referenceBet: n(result.referenceBet),
    mode: modifiers.bonus ? `bonus:${modifiers.bonusTier ?? "unknown"}` : result.mode ?? "unknown",
    multiplier: n(result.grossMultiplier),
    lineWinX: n(result.lineWinX),
    coinWinX: n(result.coinWinX),
    collectorWinX: n(result.collectorWinX),
    globalMultiplier: n(result.globalMultiplier),
    featureCycles: n(result.featureCycles),
    maxWin: Boolean(result.maxWin),
  };
});

function summarize(group) {
  const paid = group.filter((row) => row.stake > 0);
  const multiples = group.map((row) => row.multiplier);
  const totalStake = group.reduce((sum, row) => sum + row.stake, 0);
  const totalPayout = group.reduce((sum, row) => sum + row.payout, 0);
  return {
    rounds: group.length,
    paidRounds: paid.length,
    totalStake,
    totalPayout,
    net: totalPayout - totalStake,
    observedRtp: totalStake ? totalPayout / totalStake : null,
    zeroRate: group.length ? group.filter((row) => row.payout === 0).length / group.length : 0,
    profitRate: group.length ? group.filter((row) => row.payout > row.stake).length / group.length : 0,
    maxWinHits: group.filter((row) => row.maxWin).length,
    p50x: quantile(multiples, 0.5),
    p90x: quantile(multiples, 0.9),
    p99x: quantile(multiples, 0.99),
    maxX: multiples.length ? Math.max(...multiples) : 0,
    maxBoardCoinX: group.length ? Math.max(...group.map((row) => row.coinWinX)) : 0,
    maxCollectorX: group.length ? Math.max(...group.map((row) => row.collectorWinX)) : 0,
    maxFeatureCycles: group.length ? Math.max(...group.map((row) => row.featureCycles)) : 0,
  };
}

const byMode = Object.fromEntries(
  [...new Set(rows.map((row) => row.mode))].map((mode) => [
    mode,
    summarize(rows.filter((row) => row.mode === mode)),
  ]),
);

const ledger = database.prepare(`
  SELECT occurred_at, payload_json
  FROM wallet_ledger
  WHERE game = 'allahin-lutfu' AND occurred_at >= ?
  ORDER BY occurred_at ASC
`).all(cutoff).map((row) => ({ at: row.occurred_at, ...JSON.parse(row.payload_json) }));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  databasePath,
  cutoff,
  hours,
  summary: summarize(rows),
  byMode,
  extremeRoundCount: rows.filter((row) => row.multiplier >= 10_000).length,
  trillionCollectorRounds: rows.filter((row) => row.collectorWinX >= 1_000_000_000_000).length,
  topRounds: [...rows].sort((left, right) => right.payout - left.payout).slice(0, 20),
  ledger: {
    entries: ledger.length,
    stakeEntries: ledger.filter((row) => row.type === "stake").length,
    payoutEntries: ledger.filter((row) => row.type === "payout").length,
    firstBalance: ledger[0]?.balanceBefore,
    lastBalance: ledger.at(-1)?.balanceAfter,
    largestPayout: Math.max(0, ...ledger.filter((row) => row.type === "payout").map((row) => n(row.amount))),
  },
}, null, 2));

database.close();
