import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { rebuildMetaSystem } from "../server/meta-system.mjs";
import {
  getCompetitionDashboard,
  rebuildCompetitionSystem,
} from "../server/competition-system.mjs";
import { rebuildClubCompetition } from "../server/competition-phase7.mjs";

const days = Math.max(1, Math.floor(Number(process.argv[2] ?? 3)));
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const databasePath = resolve(
  process.env.LOCALAPPDATA ?? ".local-data",
  "PehlevanRoyale",
  "pehlevan-royale.sqlite",
);

if (!existsSync(databasePath)) throw new Error(`Veritabanı bulunamadı: ${databasePath}`);

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA busy_timeout=10000");
const newestRound = database
  .prepare("SELECT MAX(settled_at) newest FROM game_rounds")
  .get()?.newest;
const referenceTime = newestRound ? new Date(String(newestRound)) : new Date();
const localCutoff = new Date(referenceTime);
localCutoff.setHours(0, 0, 0, 0);
localCutoff.setDate(localCutoff.getDate() - (days - 1));
const cutoff = localCutoff.toISOString();

const count = (sql, ...parameters) =>
  Number(database.prepare(sql).get(...parameters)?.count ?? 0);

const preview = {
  databasePath,
  referenceTime: referenceTime.toISOString(),
  cutoff,
  gameRounds: count("SELECT COUNT(*) count FROM game_rounds WHERE settled_at>=?", cutoff),
  walletEntries: count(
    "SELECT COUNT(*) count FROM wallet_ledger WHERE occurred_at>=? AND game IS NOT NULL",
    cutoff,
  ),
  authoritativeWalletEntries: count(
    `SELECT COUNT(*) count FROM wallet_ledger_v2
     WHERE occurred_at>=? AND game IS NOT NULL AND type IN ('stake','payout')`,
    cutoff,
  ),
  gameEvents: count("SELECT COUNT(*) count FROM game_events WHERE occurred_at>=?", cutoff),
  conversationsLinkedToRounds: count(
    `SELECT COUNT(*) count FROM ai_conversations c WHERE c.round_id IN
     (SELECT round_id FROM game_rounds WHERE settled_at>=?)`,
    cutoff,
  ),
  settlements: count(
    "SELECT COUNT(*) count FROM meta_round_settlements WHERE settled_at>=?",
    cutoff,
  ),
  multiplayerMatches: count(
    "SELECT COUNT(*) count FROM multiplayer_matches WHERE recorded_at>=?",
    cutoff,
  ),
  multiplayerHistory: count(
    "SELECT COUNT(*) count FROM multiplayer_rating_history WHERE recorded_at>=?",
    cutoff,
  ),
  tournamentResults: count(
    "SELECT COUNT(*) count FROM tournament_results WHERE recorded_at>=?",
    cutoff,
  ),
  roundsBySource: database
    .prepare(
      "SELECT COALESCE(source,'unknown') source,COUNT(*) count FROM game_rounds WHERE settled_at>=? GROUP BY source ORDER BY source",
    )
    .all(cutoff)
    .map((row) => ({ source: row.source, count: Number(row.count) })),
};

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...preview }, null, 2));
if (verify) {
  const dashboards = database
    .prepare("SELECT id FROM users WHERE status='active' ORDER BY id")
    .all()
    .map((row) => {
      const dashboard = getCompetitionDashboard(database, row.id);
      return {
        userId: row.id,
        balance: dashboard.profile?.account?.competitiveBalance ?? null,
        wealthRank: dashboard.leaderboards.wealth.self?.rank ?? null,
      };
    });
  console.log(JSON.stringify({ verifiedDashboards: dashboards }, null, 2));
}
if (!apply) {
  database.close();
  process.exit(0);
}

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = resolve(dirname(databasePath), "backups", `pre-purge-${days}d-${stamp}.sqlite`);
mkdirSync(dirname(backupPath), { recursive: true });
database.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);

database.exec("BEGIN IMMEDIATE");
try {
  database.exec("CREATE TEMP TABLE purge_round_ids(round_id TEXT PRIMARY KEY)");
  database
    .prepare(
      "INSERT OR IGNORE INTO purge_round_ids SELECT round_id FROM game_rounds WHERE settled_at>=?",
    )
    .run(cutoff);
  database.exec(`
    DELETE FROM ai_conversations WHERE round_id IN (SELECT round_id FROM purge_round_ids);
    DELETE FROM wallet_ledger WHERE occurred_at >= '${cutoff.replaceAll("'", "''")}' AND game IS NOT NULL;
    DELETE FROM wallet_ledger_v2 WHERE occurred_at >= '${cutoff.replaceAll("'", "''")}'
      AND game IS NOT NULL AND type IN ('stake','payout');
    DELETE FROM game_events WHERE occurred_at >= '${cutoff.replaceAll("'", "''")}';
    DELETE FROM game_rounds WHERE settled_at >= '${cutoff.replaceAll("'", "''")}';
    DELETE FROM multiplayer_rating_history WHERE recorded_at >= '${cutoff.replaceAll("'", "''")}';
    DELETE FROM tournament_results WHERE recorded_at >= '${cutoff.replaceAll("'", "''")}';
    DELETE FROM multiplayer_matches WHERE recorded_at >= '${cutoff.replaceAll("'", "''")}';
    DROP TABLE purge_round_ids;
  `);
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}

const rebuilt = {
  metaSettlements: rebuildMetaSystem(database),
  competitionSettlements: rebuildCompetitionSystem(database),
  clubSettlements: rebuildClubCompetition(database),
};

const after = {
  gameRounds: count("SELECT COUNT(*) count FROM game_rounds WHERE settled_at>=?", cutoff),
  walletEntries: count(
    "SELECT COUNT(*) count FROM wallet_ledger WHERE occurred_at>=? AND game IS NOT NULL",
    cutoff,
  ),
  authoritativeWalletEntries: count(
    `SELECT COUNT(*) count FROM wallet_ledger_v2
     WHERE occurred_at>=? AND game IS NOT NULL AND type IN ('stake','payout')`,
    cutoff,
  ),
  gameEvents: count("SELECT COUNT(*) count FROM game_events WHERE occurred_at>=?", cutoff),
  settlements: count(
    "SELECT COUNT(*) count FROM meta_round_settlements WHERE settled_at>=?",
    cutoff,
  ),
};

console.log(JSON.stringify({ deleted: preview, rebuilt, after, backupPath }, null, 2));
database.close();
