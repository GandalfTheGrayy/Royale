import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createAccountSystem } from "./auth-system.mjs";
import {
  backfillMetaSettlements,
  getMetaStats,
  initializeMetaSystem,
  META_SYSTEM_CONFIG,
  processRoundSettlement,
  rebuildMetaSystem,
} from "./meta-system.mjs";
import {
  backfillCompetitionSystem,
  getCompetitionAdminState,
  getCompetitionConfig,
  getCompetitionDashboard,
  getPublicProfile,
  initializeCompetitionSystem,
  invalidateCompetitionSettlement,
  onCompetitiveWalletUpdated,
  processCompetitionSettlement,
  rebuildCompetitionSystem,
  setActiveTitle,
  setProfileShowcase,
  updateCompetitionConfig,
} from "./competition-system.mjs";
import {
  createClub,
  createTournament,
  joinClub,
  joinTournament,
  leaveClub,
  rebuildClubCompetition,
  recordMultiplayerMatch,
  recordTournamentResults,
} from "./competition-phase7.mjs";

const API_PREFIX = "/api/casino-data";
const healthPayloadCache = new WeakMap();

const finiteNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function normalizeRecord(kind, incoming) {
  if (kind !== "rounds") return incoming;
  const stake = Math.max(0, finiteNumber(incoming.stake));
  const grossPayout = Math.max(0, finiteNumber(incoming.grossPayout));
  const net = finiteNumber(incoming.net, grossPayout - stake);
  const balanceBefore = Number.isFinite(Number(incoming.balanceBefore))
    ? Number(incoming.balanceBefore)
    : undefined;
  const balanceAfter = Number.isFinite(Number(incoming.balanceAfter))
    ? Number(incoming.balanceAfter)
    : balanceBefore === undefined
      ? undefined
      : balanceBefore + net;
  return {
    ...incoming,
    stake,
    grossPayout,
    net,
    ...(balanceBefore === undefined ? {} : { balanceBefore }),
    ...(balanceAfter === undefined ? {} : { balanceAfter }),
  };
}

const TABLES = {
  rounds: {
    table: "game_rounds",
    columns: [
      "id",
      "round_id",
      "game",
      "source",
      "player_participated",
      "settled_at",
      "stake",
      "gross_payout",
      "net",
      "outcome",
      "user_id",
      "payload_json",
    ],
    values: (record) => [
      record.id,
      record.roundId,
      record.game,
      record.source,
      record.playerParticipated ? 1 : 0,
      record.settledAt,
      record.stake,
      record.grossPayout,
      record.net,
      record.outcome,
      record.userId,
      JSON.stringify(record),
    ],
    order: "settled_at DESC",
  },
  ledger: {
    table: "wallet_ledger",
    columns: [
      "id",
      "round_id",
      "game",
      "occurred_at",
      "user_id",
      "payload_json",
    ],
    values: (record) => [
      record.id,
      record.roundId ?? null,
      record.game ?? null,
      record.occurredAt,
      record.userId,
      JSON.stringify(record),
    ],
    order: "occurred_at DESC",
  },
  events: {
    table: "game_events",
    columns: [
      "id",
      "round_id",
      "game",
      "occurred_at",
      "user_id",
      "payload_json",
    ],
    values: (record) => [
      record.id,
      record.roundId ?? null,
      record.game,
      record.occurredAt,
      record.userId,
      JSON.stringify(record),
    ],
    order: "occurred_at DESC",
  },
  conversations: {
    table: "ai_conversations",
    columns: [
      "id",
      "session_id",
      "round_id",
      "game",
      "character",
      "occurred_at",
      "user_id",
      "payload_json",
    ],
    values: (record) => [
      record.id,
      record.sessionId,
      record.roundId ?? null,
      record.game,
      record.character,
      record.occurredAt,
      record.userId,
      JSON.stringify(record),
    ],
    order: "occurred_at DESC",
  },
};

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024 * 1024) {
        reject(new Error("İstek 64 MB sınırını aşıyor."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolveBody(
          chunks.length
            ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
            : {},
        );
      } catch {
        reject(new Error("Geçersiz JSON."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  const body = Buffer.from(
    JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", body.length);
  response.end(body);
}

function initialize(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS game_rounds (
      id TEXT PRIMARY KEY, round_id TEXT NOT NULL, game TEXT NOT NULL,
      settled_at TEXT NOT NULL, payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rounds_game_time ON game_rounds(game, settled_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rounds_round_id ON game_rounds(round_id);
    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id TEXT PRIMARY KEY, round_id TEXT, game TEXT,
      occurred_at TEXT NOT NULL, payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_game_time ON wallet_ledger(game, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS game_events (
      id TEXT PRIMARY KEY, round_id TEXT, game TEXT NOT NULL,
      occurred_at TEXT NOT NULL, payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_game_time ON game_events(game, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, round_id TEXT,
      game TEXT NOT NULL, character TEXT NOT NULL,
      occurred_at TEXT NOT NULL, payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_game_time ON ai_conversations(game, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_character_time ON ai_conversations(character, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS casino_meta (
      key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schema_info (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    INSERT INTO schema_info(key, value) VALUES ('schema_version', '3')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `);
  const roundColumns = new Set(
    database
      .prepare("PRAGMA table_info(game_rounds)")
      .all()
      .map((column) => column.name),
  );
  const additions = [
    ["source", "TEXT"],
    ["player_participated", "INTEGER"],
    ["stake", "REAL"],
    ["gross_payout", "REAL"],
    ["net", "REAL"],
    ["outcome", "TEXT"],
  ];
  for (const [name, type] of additions)
    if (!roundColumns.has(name))
      database.exec(`ALTER TABLE game_rounds ADD COLUMN ${name} ${type}`);
  database.exec(`
    UPDATE game_rounds SET
      source = COALESCE(source, json_extract(payload_json, '$.source')),
      player_participated = COALESCE(player_participated, json_extract(payload_json, '$.playerParticipated')),
      stake = COALESCE(stake, json_extract(payload_json, '$.stake')),
      gross_payout = COALESCE(gross_payout, json_extract(payload_json, '$.grossPayout')),
      net = COALESCE(net, json_extract(payload_json, '$.net')),
      outcome = COALESCE(outcome, json_extract(payload_json, '$.outcome'));
    CREATE INDEX IF NOT EXISTS idx_rounds_participated_time ON game_rounds(player_participated, settled_at DESC);
    UPDATE game_rounds SET
      stake = COALESCE(stake, 0),
      gross_payout = COALESCE(gross_payout, 0),
      net = COALESCE(net, COALESCE(gross_payout, 0) - COALESCE(stake, 0)),
      payload_json = json_set(
        payload_json,
        '$.stake', COALESCE(stake, 0),
        '$.grossPayout', COALESCE(gross_payout, 0),
        '$.net', COALESCE(net, COALESCE(gross_payout, 0) - COALESCE(stake, 0)),
        '$.balanceAfter', CASE
          WHEN json_type(payload_json, '$.balanceBefore') IN ('integer', 'real')
          THEN json_extract(payload_json, '$.balanceBefore') + COALESCE(net, COALESCE(gross_payout, 0) - COALESCE(stake, 0))
          ELSE json_extract(payload_json, '$.balanceAfter')
        END,
        '$.result.grossPayout', COALESCE(json_extract(payload_json, '$.result.grossPayout'), COALESCE(gross_payout, 0)),
        '$.result.currentMultiplier', COALESCE(json_extract(payload_json, '$.result.currentMultiplier'), 0)
      )
    WHERE stake IS NULL OR gross_payout IS NULL OR net IS NULL;
    UPDATE schema_info SET value = '5' WHERE key = 'schema_version';
  `);
}

function upsertRecord(database, kind, record) {
  const definition = TABLES[kind];
  if (!definition || !record?.id)
    throw new Error("Geçersiz kayıt türü veya kimliği.");
  const placeholders = definition.columns.map(() => "?").join(", ");
  const updates = definition.columns
    .filter((column) => column !== "id")
    .map((column) => `${column}=excluded.${column}`)
    .join(", ");
  // A settled game round is immutable. Other research records keep their
  // previous upsert behaviour for backwards compatibility.
  if (kind === "rounds")
    return database
      .prepare(
        `INSERT INTO ${definition.table} (${definition.columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(id) DO NOTHING`,
      )
      .run(...definition.values(record));
  return database
    .prepare(
      `INSERT INTO ${definition.table} (${definition.columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
    )
    .run(...definition.values(record));
}

function health(database, databasePath, includePayloadBytes = false) {
  const counts = Object.fromEntries(
    Object.entries(TABLES).map(([kind, definition]) => [
      kind,
      Number(
        database
          .prepare(`SELECT COUNT(*) AS count FROM ${definition.table}`)
          .get().count,
      ),
    ]),
  );
  counts.meta = Number(
    database.prepare("SELECT COUNT(*) AS count FROM casino_meta").get().count,
  );
  let payloadBytes;
  if (includePayloadBytes) {
    let payload = healthPayloadCache.get(database);
    if (!payload || Date.now() - payload.measuredAt > 60_000) {
      payload = {
        measuredAt: Date.now(),
        bytes: Object.fromEntries(
          Object.entries(TABLES).map(([kind, definition]) => [
            kind,
            Number(
              database
                .prepare(
                  `SELECT COALESCE(SUM(length(payload_json)), 0) AS bytes FROM ${definition.table}`,
                )
                .get().bytes,
            ),
          ]),
        ),
      };
      healthPayloadCache.set(database, payload);
    }
    payloadBytes = payload.bytes;
  }
  let sqliteBytes = 0;
  try {
    sqliteBytes = statSync(databasePath).size;
  } catch {
    /* File can be created between startup and first write. */
  }
  counts.settlements = Number(
    database
      .prepare("SELECT COUNT(*) AS count FROM meta_round_settlements")
      .get().count,
  );
  counts.statAggregates = Number(
    database.prepare("SELECT COUNT(*) AS count FROM game_stat_aggregates").get()
      .count,
  );
  const schemaVersion = Number(
    database
      .prepare("SELECT value FROM schema_info WHERE key='schema_version'")
      .get()?.value ?? 0,
  );
  return {
    ok: true,
    backend: "sqlite",
    schemaVersion,
    databasePath,
    sqliteBytes,
    counts,
    ...(payloadBytes ? { payloadBytes } : {}),
  };
}

function summary(database, userId) {
  const where = userId ? "WHERE user_id = ?" : "";
  const parameters = userId ? [userId] : [];
  const rows = database
    .prepare(
      `
    SELECT game,
      COUNT(*) AS rounds,
      SUM(CASE WHEN player_participated = 1 THEN 1 ELSE 0 END) AS played_rounds,
      SUM(CASE WHEN player_participated = 1 AND outcome = 'win' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN player_participated = 1 AND outcome = 'loss' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN player_participated = 1 AND outcome = 'push' THEN 1 ELSE 0 END) AS pushes,
      COALESCE(SUM(CASE WHEN player_participated = 1 THEN COALESCE(stake, 0) ELSE 0 END), 0) AS total_stake,
      COALESCE(SUM(CASE WHEN player_participated = 1 THEN COALESCE(gross_payout, 0) ELSE 0 END), 0) AS total_payout,
      COALESCE(SUM(CASE WHEN player_participated = 1 THEN COALESCE(net, COALESCE(gross_payout, 0) - COALESCE(stake, 0)) ELSE 0 END), 0) AS net
    FROM game_rounds ${where} GROUP BY game
  `,
    )
    .all(...parameters);
  const byGame = rows
    .map((row) => ({
      game: row.game,
      rounds: Number(row.rounds),
      playedRounds: Number(row.played_rounds),
      wins: Number(row.wins),
      losses: Number(row.losses),
      pushes: Number(row.pushes),
      totalStake: finiteNumber(row.total_stake),
      totalPayout: finiteNumber(row.total_payout),
      net: finiteNumber(row.net),
      rtp: finiteNumber(row.total_stake)
        ? finiteNumber(row.total_payout) / finiteNumber(row.total_stake)
        : 0,
    }))
    .sort((a, b) => b.playedRounds - a.playedRounds);
  const total = byGame.reduce(
    (result, game) => ({
      rounds: result.rounds + game.rounds,
      playedRounds: result.playedRounds + game.playedRounds,
      wins: result.wins + game.wins,
      losses: result.losses + game.losses,
      pushes: result.pushes + game.pushes,
      totalStake: result.totalStake + game.totalStake,
      totalPayout: result.totalPayout + game.totalPayout,
      net: result.net + game.net,
    }),
    {
      rounds: 0,
      playedRounds: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      totalStake: 0,
      totalPayout: 0,
      net: 0,
    },
  );
  const liveRounds = Number(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM game_rounds WHERE source = 'live-table'${userId ? " AND user_id = ?" : ""}`,
      )
      .get(...parameters).count,
  );
  return {
    generatedAt: new Date().toISOString(),
    ...total,
    liveRounds,
    rtp: total.totalStake ? total.totalPayout / total.totalStake : 0,
    byGame,
  };
}

export function casinoSqlitePlugin(options = {}) {
  const applicationData = process.env.LOCALAPPDATA
    ? resolve(process.env.LOCALAPPDATA, "PehlevanRoyale")
    : resolve(".local-data", "PehlevanRoyale");
  const databasePath = resolve(
    options.databasePath ?? applicationData,
    "pehlevan-royale.sqlite",
  );
  const legacyPath = resolve("data/pehlevan-royale.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });
  if (!existsSync(databasePath) && existsSync(legacyPath))
    copyFileSync(legacyPath, databasePath);
  const database = new DatabaseSync(databasePath);
  initialize(database);
  const accounts = createAccountSystem(database);
  initializeMetaSystem(database);
  initializeCompetitionSystem(database);
  backfillMetaSettlements(database);
  backfillCompetitionSystem(database);
  const backupDirectory = resolve(dirname(databasePath), "backups");
  const backupDate = new Date().toISOString().slice(0, 10);
  const dailyBackupPath = resolve(
    backupDirectory,
    `pehlevan-royale-${backupDate}-schema-v11.sqlite`,
  );
  if (!existsSync(dailyBackupPath)) {
    mkdirSync(backupDirectory, { recursive: true });
    const escapedBackupPath = dailyBackupPath.replaceAll("'", "''");
    database.exec(`VACUUM INTO '${escapedBackupPath}'`);
  }

  const shareUser = (process.env.PEHLEVAN_SHARE_USER ?? "Pehlevan").trim();
  const sharePasswordHash =
    process.env.PEHLEVAN_SHARE_PASSWORD_HASH?.trim().toLowerCase();

  const requestAuthorized = (authorization) => {
    if (!sharePasswordHash) return true;
    if (!authorization?.startsWith("Basic ")) return false;
    try {
      const credentials = Buffer.from(
        authorization.slice(6),
        "base64",
      ).toString("utf8");
      const separator = credentials.indexOf(":");
      if (separator < 0) return false;
      const suppliedUser = credentials.slice(0, separator);
      const suppliedPassword = credentials.slice(separator + 1);
      const suppliedHash = createHash("sha256")
        .update(suppliedPassword, "utf8")
        .digest();
      const expectedHash = Buffer.from(sharePasswordHash, "hex");
      return (
        suppliedUser.localeCompare(shareUser, "tr", {
          sensitivity: "accent",
        }) === 0 &&
        suppliedHash.length === expectedHash.length &&
        timingSafeEqual(suppliedHash, expectedHash)
      );
    } catch {
      return false;
    }
  };

  const proxyLocalService = async (request, response, prefix, target) => {
    const suffix = request.url.slice(prefix.length) || "/";
    const upstream = await fetch(`${target}${suffix}`, {
      method: request.method,
      headers: {
        "content-type": request.headers["content-type"] ?? "application/json",
      },
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : JSON.stringify(await readBody(request)),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    response.statusCode = upstream.status;
    response.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ?? "application/octet-stream",
    );
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Length", payload.length);
    response.end(payload);
  };

  const attach = (server) => {
    server.httpServer?.once("close", () => {
      try {
        database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        /* best-effort shutdown checkpoint */
      }
      database.close();
    });
    server.middlewares.use(async (request, response, next) => {
      const startedAt = performance.now();
      response.once("finish", () => {
        const durationMs = Math.round(performance.now() - startedAt);
        if (durationMs >= 1000 && request.url?.startsWith("/api/")) {
          console.warn(JSON.stringify({ event: "slow-api", method: request.method,
            route: request.url.split("?")[0].replace(/\/users\/[^/]+/g, "/users/:id"),
            durationMs, status: response.statusCode }));
        }
      });
      if (
        process.env.PEHLEVAN_EMERGENCY_GATE === "1" &&
        !requestAuthorized(request.headers.authorization)
      ) {
        response.statusCode = 401;
        response.setHeader(
          "WWW-Authenticate",
          'Basic realm="Pehlevan Royale - Pehlevan", charset="UTF-8"',
        );
        response.setHeader("Cache-Control", "no-store");
        response.end("Pehlevan Royale erişim kodu gerekli.");
        return;
      }
      try {
        const accountUrl = new URL(request.url ?? "/", "http://localhost");
        if (await accounts.handleAuth(request, response, accountUrl)) return;
        if (request.url?.startsWith("/api/local-ai")) {
          if (!accounts.currentSession(request)) {
            sendJson(response, 401, { error: "Oturum gerekli." });
            return;
          }
          await proxyLocalService(
            request,
            response,
            "/api/local-ai",
            "http://127.0.0.1:11434",
          );
          return;
        }
        if (request.url?.startsWith("/api/local-voice")) {
          if (!accounts.currentSession(request)) {
            sendJson(response, 401, { error: "Oturum gerekli." });
            return;
          }
          await proxyLocalService(
            request,
            response,
            "/api/local-voice",
            "http://127.0.0.1:8765",
          );
          return;
        }
      } catch (error) {
        sendJson(response, 502, {
          error:
            error instanceof Error
              ? error.message
              : "Yerel servis yanıt vermedi.",
        });
        return;
      }
      if (!request.url?.startsWith(API_PREFIX)) {
        next();
        return;
      }
      try {
        const url = new URL(request.url, "http://localhost");
        const parts = url.pathname
          .slice(API_PREFIX.length)
          .split("/")
          .filter(Boolean);
        const auth = accounts.requireSession(request, response);
        if (!auth) return;
        if (request.method === "GET" && parts[0] === "health") {
          sendJson(
            response,
            200,
            health(
              database,
              databasePath,
              url.searchParams.get("details") === "storage",
            ),
          );
          return;
        }
        if (request.method === "GET" && parts[0] === "summary") {
          const ownScope = url.searchParams.get("scope") === "me";
          sendJson(
            response,
            200,
            summary(
              database,
              ownScope || !["owner", "admin"].includes(auth.user.role)
                ? auth.user.id
                : undefined,
            ),
          );
          return;
        }
        if (
          request.method === "GET" &&
          parts[0] === "competition" &&
          parts[1] === "stats"
        ) {
          sendJson(response, 200, getMetaStats(database, auth.user.id));
          return;
        }
        if (
          request.method === "GET" &&
          parts[0] === "competition" &&
          parts[1] === "config"
        ) {
          sendJson(response, 200, META_SYSTEM_CONFIG);
          return;
        }
        if (
          request.method === "GET" &&
          parts[0] === "competition" &&
          parts[1] === "dashboard"
        ) {
          sendJson(
            response,
            200,
            getCompetitionDashboard(database, auth.user.id),
          );
          return;
        }
        if (
          request.method === "GET" &&
          parts[0] === "competition" &&
          parts[1] === "profile" &&
          parts[2]
        ) {
          sendJson(
            response,
            200,
            getPublicProfile(
              database,
              decodeURIComponent(parts[2]),
              auth.user.id,
            ),
          );
          return;
        }
        if (
          request.method === "POST" &&
          parts[0] === "competition" &&
          parts[1] === "title"
        ) {
          const payload = await readBody(request);
          setActiveTitle(database, auth.user.id, String(payload.titleId ?? ""));
          sendJson(response, 200, { ok: true });
          return;
        }
        if (
          request.method === "POST" &&
          parts[0] === "competition" &&
          parts[1] === "showcase"
        ) {
          const payload = await readBody(request);
          setProfileShowcase(database, auth.user.id, payload.items);
          sendJson(response, 200, { ok: true });
          return;
        }
        if (
          request.method === "POST" &&
          parts[0] === "competition" &&
          parts[1] === "clubs"
        ) {
          const payload = await readBody(request),
            action = String(parts[2] ?? "");
          if (action === "create") {
            const clubId = createClub(database, auth.user.id, payload);
            sendJson(response, 201, {
              ok: true,
              clubId,
              dashboard: getCompetitionDashboard(database, auth.user.id),
            });
            return;
          }
          if (action === "join") {
            joinClub(database, auth.user.id, String(payload.clubId ?? ""));
            sendJson(response, 200, {
              ok: true,
              dashboard: getCompetitionDashboard(database, auth.user.id),
            });
            return;
          }
          if (action === "leave") {
            leaveClub(database, auth.user.id);
            sendJson(response, 200, {
              ok: true,
              dashboard: getCompetitionDashboard(database, auth.user.id),
            });
            return;
          }
        }
        if (
          request.method === "POST" &&
          parts[0] === "competition" &&
          parts[1] === "tournaments" &&
          parts[2] === "join"
        ) {
          const payload = await readBody(request);
          joinTournament(
            database,
            auth.user.id,
            String(payload.tournamentId ?? ""),
          );
          sendJson(response, 200, {
            ok: true,
            dashboard: getCompetitionDashboard(database, auth.user.id),
          });
          return;
        }
        if (parts[0] === "competition" && parts[1] === "admin") {
          if (!["owner", "admin"].includes(auth.user.role)) {
            sendJson(response, 403, {
              error: "Rekabet yönetimi yetkiniz yok.",
            });
            return;
          }
          if (request.method === "GET" && parts.length === 3 && parts[2] === "config") {
            sendJson(response, 200, { config: getCompetitionConfig(database) });
            return;
          }
          if (request.method === "GET" && parts.length === 2) {
            sendJson(response, 200, getCompetitionAdminState(database));
            return;
          }
          if (request.method === "POST" && parts[2] === "config") {
            const payload = await readBody(request);
            sendJson(response, 200, {
              ok: true,
              config: updateCompetitionConfig(database, auth.user.id, payload),
              state: getCompetitionAdminState(database),
            });
            return;
          }
          if (request.method === "POST" && parts[2] === "invalidate") {
            const payload = await readBody(request);
            invalidateCompetitionSettlement(
              database,
              auth.user.id,
              String(payload.eventId ?? ""),
              String(payload.reason ?? ""),
            );
            const rebuilt = rebuildMetaSystem(database),
              competitionRebuilt = rebuildCompetitionSystem(database),
              clubRebuilt = rebuildClubCompetition(database);
            sendJson(response, 200, {
              ok: true,
              rebuilt,
              competitionRebuilt,
              clubRebuilt,
              state: getCompetitionAdminState(database),
            });
            return;
          }
          if (
            request.method === "POST" &&
            parts[2] === "tournaments" &&
            parts[3] === "create"
          ) {
            const payload = await readBody(request),
              tournamentId = createTournament(database, auth.user.id, payload);
            sendJson(response, 201, {
              ok: true,
              tournamentId,
              dashboard: getCompetitionDashboard(database, auth.user.id),
            });
            return;
          }
          if (
            request.method === "POST" &&
            parts[2] === "tournaments" &&
            parts[3] === "results"
          ) {
            const payload = await readBody(request),
              result = recordTournamentResults(database, auth.user.id, payload);
            sendJson(response, 200, {
              ok: true,
              result,
              dashboard: getCompetitionDashboard(database, auth.user.id),
            });
            return;
          }
          if (request.method === "POST" && parts[2] === "matches") {
            const payload = await readBody(request),
              result = recordMultiplayerMatch(database, auth.user.id, payload);
            sendJson(response, 200, {
              ok: true,
              result,
              dashboard: getCompetitionDashboard(database, auth.user.id),
            });
            return;
          }
        }
        if (
          request.method === "POST" &&
          parts[0] === "competition" &&
          parts[1] === "rebuild"
        ) {
          if (!["owner", "admin"].includes(auth.user.role)) {
            sendJson(response, 403, {
              error: "Meta istatistiklerini yeniden hesaplama yetkiniz yok.",
            });
            return;
          }
          const rebuilt = rebuildMetaSystem(database);
          const competitionRebuilt = rebuildCompetitionSystem(database);
          const clubRebuilt = rebuildClubCompetition(database);
          sendJson(response, 200, {
            ok: true,
            rebuilt,
            competitionRebuilt,
            clubRebuilt,
          });
          return;
        }
        if (
          request.method === "GET" &&
          parts[0] === "records" &&
          TABLES[parts[1]]
        ) {
          const definition = TABLES[parts[1]];
          const limit = Math.min(
            10_000,
            Math.max(1, Number(url.searchParams.get("limit") ?? 5000)),
          );
          const offset = Math.max(
            0,
            Number(url.searchParams.get("offset") ?? 0),
          );
          const canReadAll =
            ["owner", "admin"].includes(auth.user.role) &&
            url.searchParams.get("scope") === "all";
          const requestedUser = canReadAll
            ? url.searchParams.get("userId")
            : auth.user.id;
          const filter = requestedUser ? " WHERE user_id = ?" : "";
          const records = database
            .prepare(
              `SELECT payload_json FROM ${definition.table}${filter} ORDER BY ${definition.order} LIMIT ? OFFSET ?`,
            )
            .all(
              ...(requestedUser
                ? [requestedUser, limit, offset]
                : [limit, offset]),
            )
            .map((row) =>
              normalizeRecord(parts[1], JSON.parse(row.payload_json)),
            );
          const total = Number(
            database
              .prepare(
                `SELECT COUNT(*) AS count FROM ${definition.table}${filter}`,
              )
              .get(...(requestedUser ? [requestedUser] : [])).count,
          );
          sendJson(response, 200, { records, total, limit, offset });
          return;
        }
        if (
          request.method === "POST" &&
          parts[0] === "records" &&
          TABLES[parts[1]]
        ) {
          const incoming = await readBody(request);
          const profile =
            parts[1] === "rounds" && incoming.game
              ? accounts.effectiveProfile(auth.user.id, incoming.game)
              : null;
          const record = normalizeRecord(parts[1], {
            ...incoming,
            userId: auth.user.id,
            ...(profile ? { effectiveProfile: profile } : {}),
          });
          const wallet =
            parts[1] === "ledger"
              ? accounts.applyGameLedger(auth, record)
              : undefined;
          let meta;
          let competitionSignals = [];
          if (parts[1] === "rounds") {
            database.exec("BEGIN IMMEDIATE");
            try {
              upsertRecord(database, parts[1], record);
              meta = processRoundSettlement(database, record);
              if (meta.inserted && !meta.settlement.invalidated)
                meta.competition = processCompetitionSettlement(
                  database,
                  meta.settlement,
                );
              database.exec("COMMIT");
            } catch (error) {
              database.exec("ROLLBACK");
              throw error;
            }
          } else {
            upsertRecord(database, parts[1], record);
            if (parts[1] === "ledger")
              competitionSignals = onCompetitiveWalletUpdated(
                database,
                auth.user.id,
                record.occurredAt ?? new Date().toISOString(),
              );
          }
          sendJson(response, 200, {
            ok: true,
            ...(wallet ?? {}),
            ...(competitionSignals.length
              ? { signals: competitionSignals }
              : {}),
            ...(meta
              ? {
                  meta: {
                    accepted: meta.inserted,
                    competitiveEligible: meta.settlement.competitiveEligible,
                    signals: meta.competition?.signals ?? [],
                  },
                }
              : {}),
          });
          return;
        }
        if (request.method === "GET" && parts[0] === "meta" && parts[1]) {
          const rawKey = decodeURIComponent(parts.slice(1).join("/"));
          const globalKey = rawKey === "account:pehlivan:admin-settings-v1";
          const key = globalKey ? rawKey : `account:${auth.user.id}:${rawKey}`;
          const row = database
            .prepare("SELECT value_json FROM casino_meta WHERE key = ?")
            .get(key);
          sendJson(response, 200, {
            found: Boolean(row),
            value: row ? JSON.parse(row.value_json) : null,
          });
          return;
        }
        if (request.method === "POST" && parts[0] === "meta") {
          const payload = await readBody(request);
          if (!payload?.key) throw new Error("Meta anahtarı eksik.");
          const globalKey =
            payload.key === "account:pehlivan:admin-settings-v1";
          if (globalKey && !["owner", "admin"].includes(auth.user.role)) {
            sendJson(response, 403, {
              error: "Yönetim ayarlarını değiştirme yetkiniz yok.",
            });
            return;
          }
          const key = globalKey
            ? payload.key
            : `account:${auth.user.id}:${payload.key}`;
          database
            .prepare(
              "INSERT INTO casino_meta(key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
            )
            .run(key, JSON.stringify(payload.value), new Date().toISOString());
          sendJson(response, 200, { ok: true });
          return;
        }
        if (request.method === "POST" && parts[0] === "migrate") {
          if (auth.user.role !== "owner") {
            sendJson(response, 403, {
              error:
                "Eski tarayıcı verisini yalnız Muharrem Pehlevan taşıyabilir.",
            });
            return;
          }
          const payload = await readBody(request);
          database.exec("BEGIN IMMEDIATE");
          try {
            for (const kind of Object.keys(TABLES))
              for (const incomingRecord of payload[kind] ?? []) {
                const record = { ...incomingRecord, userId: auth.user.id };
                upsertRecord(database, kind, record);
                if (kind === "rounds")
                  processRoundSettlement(
                    database,
                    normalizeRecord(kind, record),
                  );
              }
            for (const entry of payload.meta ?? []) {
              if (!entry?.key) continue;
              const key = `account:${auth.user.id}:${entry.key}`;
              database
                .prepare(
                  "INSERT INTO casino_meta(key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
                )
                .run(
                  key,
                  JSON.stringify(entry.value),
                  new Date().toISOString(),
                );
            }
            database.exec("COMMIT");
          } catch (error) {
            database.exec("ROLLBACK");
            throw error;
          }
          sendJson(response, 200, {
            ok: true,
            ...health(database, databasePath),
          });
          return;
        }
        if (request.method === "DELETE" && parts[0] === "all") {
          if (auth.user.role !== "owner") {
            sendJson(response, 403, {
              error: "Yalnız Muharrem Pehlevan silebilir.",
            });
            return;
          }
          database.exec(
            "BEGIN IMMEDIATE; DELETE FROM meta_round_settlements; DELETE FROM meta_settlement_invalidations; DELETE FROM game_stat_aggregates; DELETE FROM game_rounds; DELETE FROM wallet_ledger; DELETE FROM game_events; DELETE FROM ai_conversations; DELETE FROM casino_meta; COMMIT; PRAGMA wal_checkpoint(TRUNCATE);",
          );
          sendJson(response, 200, { ok: true });
          return;
        }
        sendJson(response, 404, {
          error: "Casino veri uç noktası bulunamadı.",
        });
      } catch (error) {
        sendJson(response, 500, {
          error:
            error instanceof Error ? error.message : "SQLite işlemi başarısız.",
        });
      }
    });
  };

  return {
    name: "pehlevan-royale-sqlite",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
