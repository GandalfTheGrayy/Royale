import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const WINDOW_SIZE = Math.max(1, Number(process.argv[2] ?? 400));
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

function ratio(value, total) {
  return total ? Number((value / total).toFixed(4)) : 0;
}

function quantile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.floor((sorted.length - 1) * percentile)].toFixed(4));
}

function load(game) {
  return database.prepare(`
    SELECT settled_at, stake, gross_payout, payload_json
    FROM game_rounds
    WHERE game = ?
    ORDER BY settled_at DESC
    LIMIT ?
  `).all(game, WINDOW_SIZE).reverse().map((row) => {
    const payload = JSON.parse(row.payload_json);
    const result = payload.result ?? {};
    const modifiers = payload.modifiers ?? {};
    return {
      at: row.settled_at,
      stake: n(row.stake),
      payout: n(row.gross_payout),
      payload,
      result,
      modifiers,
      profile: result.mathProfileVersion ?? "legacy/unknown",
      source: modifiers.source ?? (modifiers.freeSpin ? "free-spin" : "paid-spin"),
      referenceBet: n(result.referenceBet) || n(modifiers.wager) || n(row.stake),
    };
  });
}

function sourceCounts(rows) {
  return rows.reduce((counts, row) => {
    counts[row.source] = (counts[row.source] ?? 0) + 1;
    return counts;
  }, {});
}

function profileCounts(rows) {
  return rows.reduce((counts, row) => {
    counts[row.profile] = (counts[row.profile] ?? 0) + 1;
    return counts;
  }, {});
}

function payoutSummary(rows) {
  const multiples = rows.map((row) => row.referenceBet ? row.payout / row.referenceBet : 0);
  return {
    spins: rows.length,
    zeroRate: ratio(rows.filter((row) => row.payout === 0).length, rows.length),
    anyReturnRate: ratio(rows.filter((row) => row.payout > 0).length, rows.length),
    profitRate: ratio(rows.filter((row) => row.payout > row.referenceBet).length, rows.length),
    p50x: quantile(multiples, 0.5),
    p90x: quantile(multiples, 0.9),
    p99x: quantile(multiples, 0.99),
    maxX: multiples.length ? Number(Math.max(...multiples).toFixed(4)) : 0,
  };
}

function captainAudit(rows) {
  const free = rows.filter((row) => row.source === "free-spin");
  const paid = rows.filter((row) => row.source === "paid-spin");
  const enriched = free.map((row) => ({
    ...row,
    fish: n(row.result.moneyFishCount ?? row.result.moneyFishValues?.length),
    captains: n(row.result.captainCount),
    multiplier: Math.max(1, n(row.result.collectionMultiplier || row.modifiers.bonusMultiplierBefore || 1)),
    sessionId: row.modifiers.bonusSessionId ?? "unknown",
  }));
  const sessions = Object.values(enriched.reduce((all, row) => {
    const current = all[row.sessionId] ?? {
      id: row.sessionId,
      source: row.modifiers.bonusSource,
      spins: 0,
      captains: 0,
      fish: 0,
      captainSpins: 0,
      fishSpins: 0,
      collectionSpins: 0,
      captainOnlySpins: 0,
      maxMultiplier: 1,
      payout: 0,
      referenceBet: row.referenceBet,
    };
    current.spins += 1;
    current.captains += row.captains;
    current.fish += row.fish;
    current.captainSpins += Number(row.captains > 0);
    current.fishSpins += Number(row.fish > 0);
    current.collectionSpins += Number(row.captains > 0 && row.fish > 0);
    current.captainOnlySpins += Number(row.captains > 0 && row.fish === 0);
    current.maxMultiplier = Math.max(current.maxMultiplier, row.multiplier);
    current.payout += row.payout;
    all[row.sessionId] = current;
    return all;
  }, {})).map((session) => ({
    ...session,
    totalX: session.referenceBet ? Number((session.payout / session.referenceBet).toFixed(3)) : 0,
  }));
  const captainSpins = enriched.filter((row) => row.captains > 0);
  const fishSpins = enriched.filter((row) => row.fish > 0);
  const collectionSpins = enriched.filter((row) => row.captains > 0 && row.fish > 0);
  const captainOnly = enriched.filter((row) => row.captains > 0 && row.fish === 0);
  const fishOnly = enriched.filter((row) => row.fish > 0 && row.captains === 0);
  return {
    rows: rows.length,
    profiles: profileCounts(rows),
    sources: sourceCounts(rows),
    paid: payoutSummary(paid),
    free: {
      ...payoutSummary(enriched),
      captainSymbols: enriched.reduce((sum, row) => sum + row.captains, 0),
      moneyFishSymbols: enriched.reduce((sum, row) => sum + row.fish, 0),
      captainSpinRate: ratio(captainSpins.length, enriched.length),
      fishSpinRate: ratio(fishSpins.length, enriched.length),
      collectionSpinRate: ratio(collectionSpins.length, enriched.length),
      captainWithoutFishRate: ratio(captainOnly.length, enriched.length),
      fishWithoutCaptainRate: ratio(fishOnly.length, enriched.length),
      averageCaptainsPerSpin: ratio(enriched.reduce((sum, row) => sum + row.captains, 0), enriched.length),
      averageFishPerSpin: ratio(enriched.reduce((sum, row) => sum + row.fish, 0), enriched.length),
      multiplierSpinDistribution: enriched.reduce((counts, row) => {
        counts[`${row.multiplier}x`] = (counts[`${row.multiplier}x`] ?? 0) + 1;
        return counts;
      }, {}),
    },
    bonusSessions: {
      count: sessions.length,
      reached2x: ratio(sessions.filter((session) => session.maxMultiplier >= 2).length, sessions.length),
      reached3x: ratio(sessions.filter((session) => session.maxMultiplier >= 3).length, sessions.length),
      reached10x: ratio(sessions.filter((session) => session.maxMultiplier >= 10).length, sessions.length),
      sessions,
    },
  };
}

function neonAudit(rows) {
  const currentProfile = rows.at(-1)?.profile;
  const current = rows.filter((row) => row.profile === currentProfile);
  const summarize = (set) => {
    const paid = set.filter((row) => row.source === "paid-spin");
    const free = set.filter((row) => row.source === "free-spin");
    const cascades = set.flatMap((row) => row.result.cascades ?? []);
    const clusterSizes = cascades.flatMap((cascade) =>
      (cascade.clusters ?? []).map((cluster) => cluster.cells?.length ?? 0),
    );
    const minimumClusters = set.reduce((counts, row) => {
      const minimum = row.result.mathParameters?.minimumCluster ?? "missing";
      counts[minimum] = (counts[minimum] ?? 0) + 1;
      return counts;
    }, {});
    return {
      rows: set.length,
      sources: sourceCounts(set),
      paid: payoutSummary(paid),
      free: payoutSummary(free),
      minimumClusterSettings: minimumClusters,
      cascadeSpinRate: ratio(set.filter((row) => (row.result.cascades?.length ?? 0) > 0).length, set.length),
      averageCascadesPerSpin: ratio(set.reduce((sum, row) => sum + (row.result.cascades?.length ?? 0), 0), set.length),
      clusterSizeDistribution: clusterSizes.reduce((counts, size) => {
        counts[size] = (counts[size] ?? 0) + 1;
        return counts;
      }, {}),
      fourSymbolClusters: clusterSizes.filter((size) => size === 4).length,
      subFourClusters: clusterSizes.filter((size) => size < 4).length,
    };
  };
  return {
    rows: rows.length,
    profiles: profileCounts(rows),
    currentProfile,
    wholeWindow: summarize(rows),
    currentProfileOnly: summarize(current),
  };
}

const captainRows = load("kaptan-mercan");
const neonRows = load("neon-kasasi");
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  databasePath,
  requestedWindow: WINDOW_SIZE,
  captain: captainAudit(captainRows),
  neon: neonAudit(neonRows),
}, null, 2));
database.close();
