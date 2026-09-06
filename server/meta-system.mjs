import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const MICRO_PR = 1_000_000;
const config = JSON.parse(
  readFileSync(
    new URL("../src/meta/meta-config.json", import.meta.url),
    "utf8",
  ),
);

const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toMicro = (value) => Math.round(finite(value) * MICRO_PR);
const fromMicro = (value) => Number(value ?? 0) / MICRO_PR;
const jsonObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const maxFinite = (...values) =>
  Math.max(0, ...values.map((value) => finite(value)).filter(Number.isFinite));
const maxObjectNumber = (value, key) =>
  Array.isArray(value)
    ? value.reduce(
        (highest, item) => Math.max(highest, maxObjectNumber(item, key)),
        0,
      )
    : value && typeof value === "object"
      ? Math.max(
          finite(value[key]),
          ...Object.values(value).map((item) => maxObjectNumber(item, key)),
        )
      : 0;
const eventIdFor = (record) =>
  `settlement-${createHash("sha256")
    .update(
      `${record.userId}|${record.game}|${record.roundId}|${record.playerParticipated ? "player" : record.id}`,
    )
    .digest("hex")}`;

export function weekKeyFor(value = new Date(), timeZone = "UTC") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Geçersiz hafta tarihi.");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const localCalendarDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  );
  const dayFromMonday = (localCalendarDate.getUTCDay() + 6) % 7;
  localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() - dayFromMonday);
  return localCalendarDate.toISOString().slice(0, 10);
}

function configuredCompetitionTimeZone(database) {
  try {
    const row = database
      .prepare("SELECT config_json FROM competition_settings WHERE id='global'")
      .get();
    const timeZone = JSON.parse(row?.config_json ?? "{}").schedule?.timeZone;
    if (timeZone) {
      new Intl.DateTimeFormat("en", { timeZone }).format();
      return timeZone;
    }
  } catch {
    /* Competition tables are initialized after the immutable meta ledger. */
  }
  return "Europe/Istanbul";
}

export const WALLET_TRANSACTION_SOURCES = Object.freeze({
  STARTING_BALANCE: "STARTING_BALANCE",
  GAME_WAGER: "GAME_WAGER",
  GAME_PAYOUT: "GAME_PAYOUT",
  TOURNAMENT_REWARD: "TOURNAMENT_REWARD",
  ACHIEVEMENT_REWARD: "ACHIEVEMENT_REWARD",
  ADMIN_GRANT: "ADMIN_GRANT",
  ADMIN_REMOVE: "ADMIN_REMOVE",
  TEST_ADJUSTMENT: "TEST_ADJUSTMENT",
  BONUS: "BONUS",
  SYSTEM_CORRECTION: "SYSTEM_CORRECTION",
});

export function classifyWalletTransaction(type) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized === "stake")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.GAME_WAGER,
      competitiveEligible: true,
      wealthEligible: true,
    };
  if (normalized === "payout")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.GAME_PAYOUT,
      competitiveEligible: true,
      wealthEligible: true,
    };
  if (normalized === "approval_credit" || normalized === "starting_balance")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.STARTING_BALANCE,
      competitiveEligible: false,
      wealthEligible: true,
    };
  if (normalized === "admin_credit")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.ADMIN_GRANT,
      competitiveEligible: false,
      wealthEligible: false,
    };
  if (normalized === "admin_debit")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.ADMIN_REMOVE,
      competitiveEligible: false,
      wealthEligible: false,
    };
  if (normalized === "tournament_reward")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.TOURNAMENT_REWARD,
      competitiveEligible: false,
      wealthEligible: true,
    };
  if (normalized === "achievement_reward")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.ACHIEVEMENT_REWARD,
      competitiveEligible: false,
      wealthEligible: true,
    };
  if (normalized.includes("test"))
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.TEST_ADJUSTMENT,
      competitiveEligible: false,
      wealthEligible: false,
    };
  if (normalized === "bonus")
    return {
      sourceType: WALLET_TRANSACTION_SOURCES.BONUS,
      competitiveEligible: false,
      wealthEligible: false,
    };
  return {
    sourceType: WALLET_TRANSACTION_SOURCES.SYSTEM_CORRECTION,
    competitiveEligible: false,
    wealthEligible: false,
  };
}

function trackedMetadata(gameId, result, modifiers) {
  const common = {
    telemetryVersion: result.telemetryVersion ?? null,
    telemetryAudit: result.telemetryAudit ?? null,
    freeSpin: modifiers.freeSpin === true || modifiers.source === "free-spin",
    bonusSessionId: modifiers.bonusSessionId ?? null,
  };
  if (gameId === "kaptan-mercan")
    return {
      ...common,
      fishMultiplier: maxFinite(
        ...(Array.isArray(result.moneyFishValues)
          ? result.moneyFishValues
          : []),
      ),
      fishCount: finite(result.moneyFishCount),
      captainCount: finite(result.captainCount),
      collectedFishMultiplier: finite(result.collectedFishMultiplier),
      collectionMultiplier: finite(result.collectionMultiplier),
      scatterCount: finite(result.scatterCount),
      bonusSpinsAwarded: finite(result.bonusSpinsAwarded),
    };
  if (gameId === "sekerhane-1024")
    return {
      ...common,
      cascadeCount: Array.isArray(result.cascades)
        ? result.cascades.length
        : finite(result.cascadeCount),
      maxMultiplier: maxFinite(
        result.maxMultiplier,
        result.currentMultiplier,
        result.winMultiple,
      ),
      maxCellMultiplier: maxFinite(
        maxObjectNumber(result.finalSpots, "multiplier"),
        maxObjectNumber(result.cascades, "multiplier"),
      ),
      bonusSpinsAwarded: finite(
        result.freeSpinsAwarded ?? result.bonusSpinsAwarded,
      ),
    };
  if (gameId === "neon-kasasi")
    return {
      ...common,
      cascadeCount: Array.isArray(result.cascades)
        ? result.cascades.length
        : finite(result.cascadeCount),
      maxMultiplier: maxFinite(
        result.maxPowerValue,
        result.appliedMultiplier,
        result.finalBonusMultiplier,
        result.currentMultiplier,
        modifiers.maxPowerValue,
      ),
      bonusSpinsAwarded: finite(result.freeSpinsAwarded),
    };
  if (gameId === "altin-rota")
    return {
      ...common,
      crashPoint: finite(result.crashPoint),
      cashoutMultiplier: maxFinite(
        result.cashoutMultiplier,
        result.multiplier,
        ...(Array.isArray(modifiers.bets)
          ? modifiers.bets.map((bet) => bet?.cashoutMultiplier)
          : []),
      ),
    };
  if (gameId === "obsidyen-damari")
    return {
      ...common,
      mineCount: finite(result.mineCount),
      tilesCleared: finite(result.safeReveals),
      maxMultiplier: maxFinite(result.maxMultiplier, result.currentMultiplier),
    };
  if (gameId === "son-on")
    return {
      ...common,
      safeSteps: finite(result.safeSteps),
      maxMultiplier: maxFinite(result.maxMultiplier, result.currentMultiplier),
    };
  if (gameId === "plinko")
    return {
      ...common,
      rows: finite(result.rows),
      risk: result.risk ?? null,
      multiplier: finite(result.multiplier),
    };
  if (gameId === "hilo")
    return {
      ...common,
      safeSteps: finite(result.correctGuesses),
      multiplier: finite(result.multiplier),
    };
  if (gameId === "yedi-cevher")
    return {
      ...common,
      combination: result.combination ?? null,
      gemCount: Array.isArray(result.gems) ? result.gems.length : 0,
      multiplier: finite(result.multiplier),
    };
  if (gameId === "blackjack")
    return {
      ...common,
      naturalBlackjacks: finite(
        result.naturalBlackjacks,
        modifiers.blackjack === true ? 1 : 0,
      ),
      handCount: Array.isArray(result.playerHands)
        ? result.playerHands.length
        : 1,
    };
  if (gameId === "poker")
    return {
      ...common,
      potSize: finite(result.potSize ?? result.pot),
      handType: result.handType ?? result.playerHand?.category ?? null,
      placement: result.placement ?? null,
      opponentCount: finite(result.opponentCount),
    };
  if (gameId === "roulette")
    return {
      ...common,
      number: result.number ?? null,
      colour: result.colour ?? null,
      hitMultiplier: finite(modifiers.hitMultiplier),
    };
  return common;
}

export function normalizeSettlement(record) {
  const result = jsonObject(record.result);
  const modifiers = jsonObject(record.modifiers);
  const wager = Math.max(0, finite(record.stake));
  const payout = Math.max(0, finite(record.grossPayout));
  const variant = String(record.variant ?? "");
  const cancelled =
    record.cancelled === true ||
    result.cancelled === true ||
    modifiers.cancelled === true;
  const testRound =
    /(?:^|[\s·_-])(test|demo|simulation|simülasyon)(?:$|[\s·_-])/iu.test(
      variant,
    ) ||
    modifiers.test === true ||
    modifiers.simulation === true;
  const participated =
    record.playerParticipated === true &&
    record.source === "player" &&
    record.outcome !== "watch";
  const competitiveEligible = participated && !cancelled && !testRound;
  const eligibilityReason = competitiveEligible
    ? "server-persisted-player-round"
    : cancelled
      ? "cancelled"
      : testRound
        ? "test-or-simulation"
        : "not-player-settlement";
  const gameId = String(record.game ?? "unknown");
  const gameFamily = config.games[gameId]?.family ?? "other";
  const metadata = trackedMetadata(gameId, result, modifiers);
  const multiplier = maxFinite(
    metadata.maxMultiplier,
    metadata.maxCellMultiplier,
    metadata.fishMultiplier,
    metadata.collectedFishMultiplier,
    metadata.collectionMultiplier,
    metadata.hitMultiplier,
    metadata.multiplier,
    metadata.cashoutMultiplier,
    result.multiplier,
    result.currentMultiplier,
    result.maxMultiplier,
    wager > 0 ? payout / wager : 0,
  );
  return {
    eventId: eventIdFor(record),
    sourceRecordId: String(record.id),
    roundId: String(record.roundId),
    userId: String(record.userId),
    gameId,
    gameFamily,
    settledAt: String(record.settledAt),
    wagerMicro: toMicro(wager),
    payoutMicro: toMicro(payout),
    netMicro: toMicro(payout - wager),
    multiplier,
    outcome: String(
      record.outcome ??
        (payout > wager ? "win" : payout < wager ? "loss" : "push"),
    ),
    competitiveEligible,
    eligibilityReason,
    metadata,
  };
}

function addColumn(database, table, name, type) {
  const columns = new Set(
    database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name),
  );
  if (!columns.has(name))
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}

export function initializeMetaSystem(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta_round_settlements (
      event_id TEXT PRIMARY KEY, source_record_id TEXT NOT NULL, round_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id), game_id TEXT NOT NULL, game_family TEXT NOT NULL,
      settled_at TEXT NOT NULL, wager_micro INTEGER NOT NULL, payout_micro INTEGER NOT NULL,
      net_micro INTEGER NOT NULL, multiplier REAL NOT NULL DEFAULT 0, outcome TEXT NOT NULL,
      competitive_eligible INTEGER NOT NULL, eligibility_reason TEXT NOT NULL,
      metadata_json TEXT NOT NULL, invalidated_at TEXT, invalidated_by TEXT REFERENCES users(id),
      invalidation_reason TEXT, created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_settlement_source ON meta_round_settlements(user_id, source_record_id);
    CREATE INDEX IF NOT EXISTS idx_meta_settlement_user_time ON meta_round_settlements(user_id, settled_at DESC);
    CREATE INDEX IF NOT EXISTS idx_meta_settlement_game_time ON meta_round_settlements(game_id, settled_at DESC);
    CREATE INDEX IF NOT EXISTS idx_meta_settlement_competitive ON meta_round_settlements(competitive_eligible, settled_at DESC);
    CREATE TABLE IF NOT EXISTS meta_settlement_invalidations (
      event_id TEXT PRIMARY KEY,invalidated_at TEXT NOT NULL,invalidated_by TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,source_record_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_stat_aggregates (
      user_id TEXT NOT NULL REFERENCES users(id), period_type TEXT NOT NULL, period_key TEXT NOT NULL,
      scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, rounds INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, pushes INTEGER NOT NULL DEFAULT 0,
      wager_micro INTEGER NOT NULL DEFAULT 0, payout_micro INTEGER NOT NULL DEFAULT 0, net_micro INTEGER NOT NULL DEFAULT 0,
      biggest_payout_micro INTEGER NOT NULL DEFAULT 0, biggest_win_micro INTEGER NOT NULL DEFAULT 0,
      max_multiplier REAL NOT NULL DEFAULT 0, first_settled_at TEXT NOT NULL, last_settled_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, PRIMARY KEY(user_id, period_type, period_key, scope_type, scope_id)
    );
    CREATE INDEX IF NOT EXISTS idx_stats_rank_net ON game_stat_aggregates(period_type, period_key, scope_type, scope_id, net_micro DESC);
    CREATE INDEX IF NOT EXISTS idx_stats_rank_payout ON game_stat_aggregates(period_type, period_key, scope_type, scope_id, biggest_payout_micro DESC);
    CREATE TABLE IF NOT EXISTS meta_player_accounts (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      starting_balance_micro INTEGER NOT NULL, competitive_balance_micro INTEGER NOT NULL,
      peak_competitive_balance_micro INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  addColumn(database, "wallet_ledger_v2", "source_type", "TEXT");
  addColumn(
    database,
    "wallet_ledger_v2",
    "competitive_eligible",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumn(
    database,
    "wallet_ledger_v2",
    "wealth_eligible",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumn(
    database,
    "wallet_ledger_v2",
    "metadata_json",
    "TEXT NOT NULL DEFAULT '{}'",
  );
  database.exec(`
    UPDATE wallet_ledger_v2 SET
      source_type = CASE type
        WHEN 'stake' THEN 'GAME_WAGER' WHEN 'payout' THEN 'GAME_PAYOUT'
        WHEN 'approval_credit' THEN 'STARTING_BALANCE' WHEN 'admin_credit' THEN 'ADMIN_GRANT'
        WHEN 'admin_debit' THEN 'ADMIN_REMOVE' ELSE 'SYSTEM_CORRECTION' END,
      competitive_eligible = CASE WHEN type IN ('stake','payout') THEN 1 ELSE 0 END,
      wealth_eligible = CASE WHEN type IN ('stake','payout','approval_credit') THEN 1 ELSE 0 END
    WHERE source_type IS NULL;
    INSERT INTO meta_player_accounts(user_id,starting_balance_micro,competitive_balance_micro,peak_competitive_balance_micro,created_at,updated_at)
      SELECT w.user_id,w.balance_micro,w.balance_micro,w.balance_micro,datetime('now'),datetime('now') FROM wallets w
      WHERE 1
      ON CONFLICT(user_id) DO NOTHING;
    DROP TRIGGER IF EXISTS classify_wallet_transaction_v1;
    CREATE TRIGGER classify_wallet_transaction_v1 AFTER INSERT ON wallet_ledger_v2 BEGIN
      UPDATE wallet_ledger_v2 SET
        source_type = CASE NEW.type
          WHEN 'stake' THEN 'GAME_WAGER' WHEN 'payout' THEN 'GAME_PAYOUT'
          WHEN 'approval_credit' THEN 'STARTING_BALANCE' WHEN 'admin_credit' THEN 'ADMIN_GRANT'
          WHEN 'admin_debit' THEN 'ADMIN_REMOVE' WHEN 'tournament_reward' THEN 'TOURNAMENT_REWARD'
          WHEN 'achievement_reward' THEN 'ACHIEVEMENT_REWARD' WHEN 'bonus' THEN 'BONUS'
          ELSE 'SYSTEM_CORRECTION' END,
        competitive_eligible = CASE WHEN NEW.type IN ('stake','payout') THEN 1 ELSE 0 END,
        wealth_eligible = CASE WHEN NEW.type IN ('stake','payout','approval_credit','tournament_reward','achievement_reward') THEN 1 ELSE 0 END
      WHERE id=NEW.id;
      INSERT INTO meta_player_accounts(user_id,starting_balance_micro,competitive_balance_micro,peak_competitive_balance_micro,created_at,updated_at)
        VALUES(NEW.user_id,CASE WHEN NEW.type='approval_credit' THEN NEW.balance_after_micro ELSE NEW.balance_before_micro END,
          CASE WHEN NEW.type='approval_credit' THEN NEW.balance_after_micro ELSE NEW.balance_before_micro END,
          CASE WHEN NEW.type='approval_credit' THEN NEW.balance_after_micro ELSE NEW.balance_before_micro END,NEW.occurred_at,NEW.occurred_at)
        ON CONFLICT(user_id) DO UPDATE SET
          starting_balance_micro=CASE WHEN NEW.type='approval_credit' THEN NEW.balance_after_micro ELSE starting_balance_micro END,
          competitive_balance_micro=CASE WHEN NEW.type='approval_credit' THEN NEW.balance_after_micro WHEN NEW.type IN ('stake','payout') THEN MAX(0,competitive_balance_micro+NEW.amount_micro) ELSE competitive_balance_micro END,
          peak_competitive_balance_micro=CASE WHEN NEW.type='approval_credit' THEN MAX(peak_competitive_balance_micro,NEW.balance_after_micro) WHEN NEW.type IN ('stake','payout') THEN MAX(peak_competitive_balance_micro,MAX(0,competitive_balance_micro+NEW.amount_micro)) ELSE peak_competitive_balance_micro END,
          updated_at=NEW.occurred_at;
    END;
    INSERT INTO schema_info(key,value) VALUES('schema_version','6') ON CONFLICT(key) DO UPDATE SET value='6';
  `);
}

function updateAggregate(
  database,
  settlement,
  scopeType,
  scopeId,
  periodType = "lifetime",
  periodKey = "all",
) {
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO game_stat_aggregates(
    user_id,period_type,period_key,scope_type,scope_id,rounds,wins,losses,pushes,wager_micro,payout_micro,net_micro,
    biggest_payout_micro,biggest_win_micro,max_multiplier,first_settled_at,last_settled_at,updated_at
  ) VALUES(?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(user_id,period_type,period_key,scope_type,scope_id) DO UPDATE SET
    rounds=rounds+1,wins=wins+excluded.wins,losses=losses+excluded.losses,pushes=pushes+excluded.pushes,
    wager_micro=wager_micro+excluded.wager_micro,payout_micro=payout_micro+excluded.payout_micro,net_micro=net_micro+excluded.net_micro,
    biggest_payout_micro=MAX(biggest_payout_micro,excluded.biggest_payout_micro),biggest_win_micro=MAX(biggest_win_micro,excluded.biggest_win_micro),
    max_multiplier=MAX(max_multiplier,excluded.max_multiplier),first_settled_at=MIN(first_settled_at,excluded.first_settled_at),
    last_settled_at=MAX(last_settled_at,excluded.last_settled_at),updated_at=excluded.updated_at`,
    )
    .run(
      settlement.userId,
      periodType,
      periodKey,
      scopeType,
      scopeId,
      settlement.outcome === "win" ? 1 : 0,
      settlement.outcome === "loss" ? 1 : 0,
      settlement.outcome === "push" ? 1 : 0,
      settlement.wagerMicro,
      settlement.payoutMicro,
      settlement.netMicro,
      settlement.payoutMicro,
      Math.max(0, settlement.netMicro),
      settlement.multiplier,
      settlement.settledAt,
      settlement.settledAt,
      now,
    );
}

export function processRoundSettlement(database, record) {
  const settlement = normalizeSettlement(record);
  const invalidation = database
    .prepare("SELECT * FROM meta_settlement_invalidations WHERE event_id=?")
    .get(settlement.eventId);
  const inserted = database
    .prepare(
      `INSERT INTO meta_round_settlements(
    event_id,source_record_id,round_id,user_id,game_id,game_family,settled_at,wager_micro,payout_micro,net_micro,
    multiplier,outcome,competitive_eligible,eligibility_reason,metadata_json,invalidated_at,invalidated_by,invalidation_reason,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,
    )
    .run(
      settlement.eventId,
      settlement.sourceRecordId,
      settlement.roundId,
      settlement.userId,
      settlement.gameId,
      settlement.gameFamily,
      settlement.settledAt,
      settlement.wagerMicro,
      settlement.payoutMicro,
      settlement.netMicro,
      settlement.multiplier,
      settlement.outcome,
      settlement.competitiveEligible ? 1 : 0,
      settlement.eligibilityReason,
      JSON.stringify(settlement.metadata),
      invalidation?.invalidated_at ?? null,
      invalidation?.invalidated_by ?? null,
      invalidation?.reason ?? null,
      new Date().toISOString(),
    );
  if (!inserted.changes || !settlement.competitiveEligible || invalidation)
    return {
      inserted: Boolean(inserted.changes),
      settlement: { ...settlement, invalidated: Boolean(invalidation) },
    };
  updateAggregate(database, settlement, "casino", "*");
  updateAggregate(database, settlement, "family", settlement.gameFamily);
  updateAggregate(database, settlement, "game", settlement.gameId);
  const weekKey = weekKeyFor(
    settlement.settledAt,
    configuredCompetitionTimeZone(database),
  );
  updateAggregate(database, settlement, "casino", "*", "week", weekKey);
  updateAggregate(
    database,
    settlement,
    "family",
    settlement.gameFamily,
    "week",
    weekKey,
  );
  updateAggregate(
    database,
    settlement,
    "game",
    settlement.gameId,
    "week",
    weekKey,
  );
  return { inserted: true, settlement };
}

export function backfillMetaSettlements(database) {
  const rows = database
    .prepare(
      `SELECT rounds.payload_json,rounds.user_id FROM game_rounds rounds
    LEFT JOIN meta_round_settlements settlements
      ON settlements.user_id=rounds.user_id AND settlements.source_record_id=rounds.id
    WHERE settlements.event_id IS NULL ORDER BY rounds.settled_at ASC`,
    )
    .all();
  let inserted = 0;
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) {
      const record = { ...JSON.parse(row.payload_json), userId: row.user_id };
      if (!record.userId || !record.id || !record.roundId) continue;
      if (processRoundSettlement(database, record).inserted) inserted += 1;
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return inserted;
}

export function rebuildMetaSystem(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(
      "DELETE FROM game_stat_aggregates; DELETE FROM meta_round_settlements;",
    );
    const rows = database
      .prepare(
        "SELECT payload_json,user_id FROM game_rounds ORDER BY settled_at ASC",
      )
      .all();
    let inserted = 0;
    for (const row of rows) {
      const record = { ...JSON.parse(row.payload_json), userId: row.user_id };
      if (!record.userId || !record.id || !record.roundId) continue;
      if (processRoundSettlement(database, record).inserted) inserted += 1;
    }
    database.exec("COMMIT");
    return inserted;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getMetaStats(database, userId) {
  const aggregates = database
    .prepare(
      `SELECT period_type periodType,period_key periodKey,scope_type scopeType,scope_id scopeId,
    rounds,wins,losses,pushes,CAST(wager_micro AS REAL) wager_micro,CAST(payout_micro AS REAL) payout_micro,
    CAST(net_micro AS REAL) net_micro,CAST(biggest_payout_micro AS REAL) biggest_payout_micro,
    CAST(biggest_win_micro AS REAL) biggest_win_micro,max_multiplier maxMultiplier,
    first_settled_at firstSettledAt,last_settled_at lastSettledAt FROM game_stat_aggregates
    WHERE user_id=? ORDER BY scope_type,scope_id`,
    )
    .all(userId)
    .map((row) => ({
      ...row,
      wager: fromMicro(row.wager_micro),
      payout: fromMicro(row.payout_micro),
      netProfit: fromMicro(row.net_micro),
      biggestPayout: fromMicro(row.biggest_payout_micro),
      biggestWin: fromMicro(row.biggest_win_micro),
      wager_micro: undefined,
      payout_micro: undefined,
      net_micro: undefined,
      biggest_payout_micro: undefined,
      biggest_win_micro: undefined,
    }));
  const account = database
    .prepare(
      "SELECT CAST(starting_balance_micro AS REAL) starting_balance_micro,CAST(competitive_balance_micro AS REAL) competitive_balance_micro,CAST(peak_competitive_balance_micro AS REAL) peak_competitive_balance_micro,updated_at FROM meta_player_accounts WHERE user_id=?",
    )
    .get(userId);
  return {
    currency: config.currency.code,
    account: account
      ? {
          startingBalance: fromMicro(account.starting_balance_micro),
          competitiveBalance: fromMicro(account.competitive_balance_micro),
          peakCompetitiveBalance: fromMicro(
            account.peak_competitive_balance_micro,
          ),
          updatedAt: account.updated_at,
        }
      : null,
    aggregates,
  };
}

export { config as META_SYSTEM_CONFIG };
