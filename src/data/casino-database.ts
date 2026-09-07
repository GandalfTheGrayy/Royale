import { accountRequest, getAccountUserId } from "../auth/auth-api";
import { withCasinoRoundTelemetryAudit } from "./round-telemetry";

export type CasinoGameId =
  | "blackjack"
  | "roulette"
  | "poker"
  | "kiraz-77"
  | "neon-kasasi"
  | "kaptan-mercan"
  | "sekerhane-1024"
  | "allahin-lutfu"
  | "baykus-madeni"
  | "altin-rota"
  | "limbo"
  | "obsidyen-damari"
  | "mines"
  | "keno"
  | "son-on"
  | "plinko"
  | "hilo"
  | "yedi-cevher";
export type CasinoRoundSource = "player" | "live-table";
export type CasinoRoundOutcome = "win" | "loss" | "push" | "watch";

export type CasinoRoundRecord = {
  id: string;
  roundId: string;
  game: CasinoGameId;
  variant: string;
  source: CasinoRoundSource;
  playerParticipated: boolean;
  startedAt: string;
  settledAt: string;
  stake: number;
  grossPayout: number;
  net: number;
  outcome: CasinoRoundOutcome;
  balanceBefore?: number;
  balanceAfter?: number;
  result: Record<string, unknown>;
  modifiers?: Record<string, unknown>;
};

export type WalletLedgerRecord = {
  userId?: string;
  id: string;
  roundId?: string;
  game?: CasinoGameId;
  occurredAt: string;
  type: "stake" | "payout" | "credit" | "adjustment";
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  note: string;
};

export type CasinoEventRecord = {
  id: string;
  roundId?: string;
  game: CasinoGameId;
  occurredAt: string;
  type: string;
  payload: Record<string, unknown>;
};

export type AIConversationRecord = {
  id: string;
  sessionId: string;
  roundId?: string;
  game: CasinoGameId;
  character:
    | "Vera"
    | "Armand"
    | "Leyla"
    | "Rocco"
    | "Mira"
    | "Mercan"
    | "Narin"
    | "Lale"
    | "Ayla"
    | "Nihal";
  speaker: "user" | "assistant" | "system-event";
  occurredAt: string;
  text: string;
  context?: Record<string, unknown>;
  model?: string;
  latencyMs?: number;
};

export type CasinoStorageStats = {
  roundsBytes: number;
  ledgerBytes: number;
  eventsBytes: number;
  conversationsBytes: number;
  totalBytes: number;
  browserUsage?: number;
  browserQuota?: number;
  backend: "sqlite" | "indexeddb";
  sqliteConnected: boolean;
  sqliteBytes?: number;
  sqlitePath?: string;
  sqliteCounts?: Record<string, number>;
};

export type GameSummary = {
  game: CasinoGameId;
  rounds: number;
  playedRounds: number;
  wins: number;
  losses: number;
  pushes: number;
  totalStake: number;
  totalPayout: number;
  net: number;
  rtp: number;
};

export type CasinoSummary = {
  generatedAt: string;
  rounds: number;
  playedRounds: number;
  liveRounds: number;
  wins: number;
  losses: number;
  pushes: number;
  totalStake: number;
  totalPayout: number;
  net: number;
  rtp: number;
  byGame: GameSummary[];
};

export type SlotAuditSegment = {
  spins: number;
  totalStake: number;
  totalPayout: number;
  observedRtp: number;
  hitRate: number;
  profitHitRate: number;
  stakeReturnRate: number;
  fiveXRate: number;
  zeroRate: number;
  longestZeroStreak: number;
  longestBelowStakeStreak: number;
  averageWinX: number;
  medianWinX: number;
  p90WinX: number;
  p99WinX: number;
  maxWinX: number;
};

export type SlotMathAudit = {
  game: "neon-kasasi" | "kaptan-mercan" | "sekerhane-1024";
  paidBase: SlotAuditSegment;
  freeSpins: SlotAuditSegment;
  bonusBuys: number;
  naturalBonusTriggers: number;
  bonusSessions: number;
  sampleWarning: boolean;
};

const DATABASE_NAME = "pehlevan-royale-research";
const DATABASE_VERSION = 2;
const ROUND_STORE = "game_rounds";
const LEDGER_STORE = "wallet_ledger";
const EVENT_STORE = "game_events";
const META_STORE = "meta";
const AI_STORE = "ai_conversations";
const SQLITE_API = "/api/casino-data";
const listeners = new Set<() => void>();
const memory = {
  rounds: [] as CasinoRoundRecord[],
  ledger: [] as WalletLedgerRecord[],
  events: [] as CasinoEventRecord[],
  conversations: [] as AIConversationRecord[],
  meta: new Map<string, unknown>(),
};

type SqliteHealth = {
  ok: boolean;
  backend: "sqlite";
  schemaVersion: number;
  databasePath: string;
  sqliteBytes: number;
  counts: Record<string, number>;
  payloadBytes?: Record<string, number>;
};

let sqliteReadyPromise: Promise<boolean> | undefined;
let walletWriteTail: Promise<void> = Promise.resolve();
let pendingWalletWrites = 0;
const walletRecovery = new Map<string, { record: WalletLedgerRecord; acknowledgedDelta: number }>();
const recoveryKey = (userId: string) => `pehlevan-pending-wallet-v1:${userId}`;
function persistWalletRecovery(userId: string) {
  if (typeof localStorage === "undefined" || !userId) return;
  localStorage.setItem(recoveryKey(userId), JSON.stringify([...walletRecovery.values()].filter(item => item.record.userId === userId).map(item => item.record)));
}
let latestWalletState:
  { userId: string; balance: number; version: number; updatedAt?: string; acknowledgedDelta: number } | undefined;

async function sqliteRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  // Analytics reads share the server process with SQLite aggregation. A hard
  // 2.5 second cutoff made healthy, populated responses look like empty local
  // data whenever the server was briefly busy.
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await accountRequest<T>(`${SQLITE_API}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function createRecordId(prefix: string, roundId?: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${roundId ?? "record"}:${random}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ROUND_STORE)) {
        const rounds = db.createObjectStore(ROUND_STORE, { keyPath: "id" });
        rounds.createIndex("game", "game");
        rounds.createIndex("roundId", "roundId");
        rounds.createIndex("settledAt", "settledAt");
        rounds.createIndex("source", "source");
      }
      if (!db.objectStoreNames.contains(LEDGER_STORE)) {
        const ledger = db.createObjectStore(LEDGER_STORE, { keyPath: "id" });
        ledger.createIndex("game", "game");
        ledger.createIndex("roundId", "roundId");
        ledger.createIndex("occurredAt", "occurredAt");
      }
      if (!db.objectStoreNames.contains(EVENT_STORE)) {
        const events = db.createObjectStore(EVENT_STORE, { keyPath: "id" });
        events.createIndex("game", "game");
        events.createIndex("roundId", "roundId");
        events.createIndex("occurredAt", "occurredAt");
      }
      if (!db.objectStoreNames.contains(META_STORE))
        db.createObjectStore(META_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(AI_STORE)) {
        const conversations = db.createObjectStore(AI_STORE, { keyPath: "id" });
        conversations.createIndex("game", "game");
        conversations.createIndex("character", "character");
        conversations.createIndex("sessionId", "sessionId");
        conversations.createIndex("occurredAt", "occurredAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, value: T) {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  if (!db) return [];
  const values = await new Promise<T[]>((resolve, reject) => {
    const request = db
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return values;
}

async function ensureSqliteReady() {
  if (typeof window === "undefined" || typeof fetch === "undefined")
    return false;
  if (sqliteReadyPromise) return sqliteReadyPromise;
  sqliteReadyPromise = (async () => {
    try {
      await sqliteRequest<SqliteHealth>("/health");
      // Legacy IndexedDB data was migrated when SQLite was introduced. It is
      // deliberately not replayed here: one browser may be used by multiple
      // accounts, while SQLite is already account scoped and authoritative.
      return true;
    } catch {
      window.setTimeout(() => {
        sqliteReadyPromise = undefined;
      }, 5000);
      return false;
    }
  })();
  return sqliteReadyPromise;
}

export type CompetitionResultSignal =
  | {
      type: "round-summary";
      gameId: string;
      net: number;
      seasonRank: number | null;
      previousSeasonRank: number | null;
      rivalGap: number | null;
    }
  | {
      type: "personal-best";
      gameId: string;
      metricId: string;
      metricLabel: string;
      value: number;
      previousValue: number | null;
    }
  | { type: "casino-record"; gameId: string; count: number }
  | { type: "achievement"; id: string; name: string; rarity: string }
  | {
      type: "club-contribution";
      score: number;
      clubId: string;
      eventId: string;
    };

type SqliteWriteResult = {
  ok: boolean;
  userId?: string;
  balance?: number;
  version?: number;
  updatedAt?: string;
  signals?: CompetitionResultSignal[];
  meta?: {
    accepted: boolean;
    competitiveEligible: boolean;
    signals?: CompetitionResultSignal[];
  };
};

async function writeSqlite(
  kind: "rounds" | "ledger" | "events" | "conversations",
  record: unknown,
) {
  if (!(await ensureSqliteReady())) return undefined;
  try {
    return await sqliteRequest<SqliteWriteResult>(`/records/${kind}`, {
      method: "POST",
      body: JSON.stringify(record),
    });
  } catch {
    return undefined;
  }
}

async function writeFallback<T>(storeName: string, collection: T[], record: T) {
  if (typeof indexedDB === "undefined") collection.push(record);
  else await put(storeName, record);
}

type DataScope = "me" | "all";

async function readSqlite<T>(
  kind: "rounds" | "ledger" | "events" | "conversations",
  scope: DataScope = "me",
  limit?: number,
) {
  if (!(await ensureSqliteReady())) return undefined;
  try {
    const query = new URLSearchParams({
      ...(scope === "all" ? { scope: "all" } : {}),
      ...(limit === undefined
        ? {}
        : { limit: String(Math.max(1, Math.min(10_000, Math.round(limit)))) }),
    });
    return (
      await sqliteRequest<{ records: T[] }>(
        `/records/${kind}${query.size ? `?${query}` : ""}`,
      )
    ).records;
  } catch {
    return undefined;
  }
}

async function readAllSqlite<T>(
  kind: "rounds" | "ledger" | "events" | "conversations",
  scope: DataScope = "me",
) {
  if (!(await ensureSqliteReady())) return undefined;
  try {
    const records: T[] = [];
    let total = 0;
    do {
      const query = new URLSearchParams({
        limit: "10000",
        offset: String(records.length),
        ...(scope === "all" ? { scope: "all" } : {}),
      });
      const page = await sqliteRequest<{ records: T[]; total: number }>(
        `/records/${kind}?${query}`,
      );
      records.push(...page.records);
      total = page.total;
    } while (records.length < total);
    return records;
  } catch {
    return undefined;
  }
}

export async function recordGameRound(record: CasinoRoundRecord) {
  const auditedRecord = withCasinoRoundTelemetryAudit(record);
  const result = await writeSqlite("rounds", auditedRecord);
  if (!result) await writeFallback(ROUND_STORE, memory.rounds, auditedRecord);
  else if (
    record.game !== "allahin-lutfu" &&
    result.meta?.signals?.length &&
    typeof window !== "undefined"
  )
    window.dispatchEvent(
      new CustomEvent("pehlevan-meta-result", {
        detail: { game: auditedRecord.game, signals: result.meta.signals },
      }),
    );
  notify();
}

export function recordWalletEntry(record: WalletLedgerRecord, acknowledgedDelta = record.amount) {
  const expectedUserId = getAccountUserId();
  record = { ...record, userId: expectedUserId };
  walletRecovery.set(record.id, { record, acknowledgedDelta });
  try { persistWalletRecovery(expectedUserId); } catch { /* in-memory recovery remains available */ }
  pendingWalletWrites += 1;
  const task = walletWriteTail
    .catch(() => undefined)
    .then(async () => {
      // Ledger writes must not share the 2.5s analytics timeout. Keep the
      // originating identity even when another tab changes the session cookie.
      let result: SqliteWriteResult | undefined;
      if (expectedUserId) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            result = await accountRequest<SqliteWriteResult>(`${SQLITE_API}/records/ledger`, {
              method: "POST", headers: { "X-Pehlevan-User": expectedUserId }, body: JSON.stringify(record),
            });
            break;
          } catch (error) {
            const status = (error as { status?: number }).status;
            if (status && status < 500) break;
            // The same record id is idempotent, including a lost response.
          }
        }
      }
      if (
        result &&
        result.userId === expectedUserId && expectedUserId === getAccountUserId() &&
        Number.isFinite(result.balance) &&
        Number.isFinite(result.version)
      ) {
        latestWalletState = {
          userId: expectedUserId,
          balance: result.balance!,
          version: result.version!,
          updatedAt: result.updatedAt,
          acknowledgedDelta: (latestWalletState?.userId === expectedUserId ? latestWalletState.acknowledgedDelta : 0) + acknowledgedDelta,
        };
        walletRecovery.delete(record.id);
        try { persistWalletRecovery(expectedUserId); } catch { /* idempotent recovery is safe */ }
        if (
          record.game !== "allahin-lutfu" &&
          result.signals?.length &&
          typeof window !== "undefined"
        )
          window.dispatchEvent(
            new CustomEvent("pehlevan-meta-result", {
              detail: {
                game: record.game ?? "casino",
                signals: result.signals,
              },
            }),
          );
      } else {
        await writeFallback(LEDGER_STORE, memory.ledger, { ...record, userId: expectedUserId });
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pehlevan-wallet-error", { detail: { userId: expectedUserId } }));
      }
    });
  walletWriteTail = task.then(
    () => undefined,
    () => undefined,
  );
  return task.finally(() => {
    pendingWalletWrites -= 1;
    // Stake and payout are often queued together. Publishing only after the
    // queue drains prevents the intermediate stake balance flashing over the
    // already-rendered payout balance.
    if (pendingWalletWrites === 0 && latestWalletState) {
      window.dispatchEvent(
        new CustomEvent("pehlevan-wallet-updated", {
          detail: latestWalletState,
        }),
      );
      latestWalletState = undefined;
    }
    notify();
  });
}

export async function flushCasinoWalletWrites() {
  await walletWriteTail;
  if ([...walletRecovery.values()].some(item => item.record.userId === getAccountUserId())) throw new Error("Cüzdan işlemleri henüz sunucuya ulaşmadı. Önce cüzdanı yeniden eşitleyin.");
}

export async function retryCasinoWalletWrites() {
  const userId = getAccountUserId();
  await walletWriteTail;
  if (typeof localStorage !== "undefined") {
    let stored: WalletLedgerRecord[] = [];
    try { stored = JSON.parse(localStorage.getItem(recoveryKey(userId)) ?? "[]") as WalletLedgerRecord[]; }
    catch { localStorage.removeItem(recoveryKey(userId)); }
    for (const record of stored) if (record.userId === userId && !walletRecovery.has(record.id)) walletRecovery.set(record.id, { record, acknowledgedDelta: 0 });
  }
  for (const item of [...walletRecovery.values()]) {
    if (item.record.userId !== userId || userId !== getAccountUserId()) continue;
    await recordWalletEntry(item.record, item.acknowledgedDelta);
  }
  await flushCasinoWalletWrites();
}

export async function recordGameEvent(record: CasinoEventRecord) {
  if (!(await writeSqlite("events", record)))
    await writeFallback(EVENT_STORE, memory.events, record);
  notify();
}

export async function recordAIConversation(record: AIConversationRecord) {
  if (!(await writeSqlite("conversations", record)))
    await writeFallback(AI_STORE, memory.conversations, record);
  notify();
}

export async function setCasinoMeta(key: string, value: unknown) {
  if (await ensureSqliteReady()) {
    try {
      await sqliteRequest("/meta", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      });
      return;
    } catch {
      /* Use the isolated fallback below. */
    }
  }
  if (typeof indexedDB === "undefined") memory.meta.set(key, value);
  else await put(META_STORE, { key, value });
}

/**
 * Reads only the computer-hosted SQLite value. Account hydration must never
 * mistake a fresh device's IndexedDB defaults for the shared owner account.
 */
export async function getSharedCasinoMeta<T>(
  key: string,
): Promise<T | undefined> {
  if (!(await ensureSqliteReady())) return undefined;
  try {
    const remote = await sqliteRequest<{ found: boolean; value: T }>(
      `/meta/${encodeURIComponent(key)}`,
    );
    return remote.found ? remote.value : undefined;
  } catch {
    return undefined;
  }
}

export async function getCasinoMeta<T>(key: string): Promise<T | undefined> {
  if (await ensureSqliteReady()) {
    try {
      const remote = await sqliteRequest<{ found: boolean; value: T }>(
        `/meta/${encodeURIComponent(key)}`,
      );
      if (remote.found) return remote.value;
    } catch {
      return undefined;
    }
  }
  if (typeof window !== "undefined") return undefined;
  if (typeof indexedDB === "undefined")
    return memory.meta.get(key) as T | undefined;
  const db = await openDatabase();
  if (!db) return undefined;
  const result = await new Promise<{ key: string; value: T } | undefined>(
    (resolve, reject) => {
      const request = db
        .transaction(META_STORE, "readonly")
        .objectStore(META_STORE)
        .get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return result?.value;
}

export async function getCasinoRounds(scope: DataScope = "me", limit?: number) {
  const values =
    (await readSqlite<CasinoRoundRecord>("rounds", scope, limit)) ??
    (typeof window !== "undefined" ? [] : [...memory.rounds]);
  return values.sort((a, b) => b.settledAt.localeCompare(a.settledAt));
}

export async function getWalletLedger(scope: DataScope = "me", limit?: number) {
  const values =
    (await readSqlite<WalletLedgerRecord>("ledger", scope, limit)) ??
    (typeof window !== "undefined" ? [] : [...memory.ledger]);
  return values.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function getCasinoEvents(scope: DataScope = "me", limit?: number) {
  const values =
    (await readSqlite<CasinoEventRecord>("events", scope, limit)) ??
    (typeof window !== "undefined" ? [] : [...memory.events]);
  return values.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function getAIConversations(scope: DataScope = "me", limit?: number) {
  const values =
    (await readSqlite<AIConversationRecord>("conversations", scope, limit)) ??
    (typeof window !== "undefined" ? [] : [...memory.conversations]);
  return values.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function getCasinoStorageStats(): Promise<CasinoStorageStats> {
  const estimate =
    typeof navigator !== "undefined" && navigator.storage?.estimate
      ? await navigator.storage.estimate()
      : undefined;
  let sqlite: SqliteHealth | undefined;
  if (await ensureSqliteReady()) {
    try {
      sqlite = await sqliteRequest<SqliteHealth>("/health?details=storage");
    } catch {
      /* IndexedDB stats remain available. */
    }
  }
  // Do not download and JSON-encode every table merely to render the admin
  // storage card. The SQLite file size/counts are the authoritative measure.
  // The small in-memory fallback remains measurable for tests/offline use.
  const bytes = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength;
  const roundsBytes = sqlite
    ? (sqlite.payloadBytes?.rounds ?? 0)
    : bytes(memory.rounds);
  const ledgerBytes = sqlite
    ? (sqlite.payloadBytes?.ledger ?? 0)
    : bytes(memory.ledger);
  const eventsBytes = sqlite
    ? (sqlite.payloadBytes?.events ?? 0)
    : bytes(memory.events);
  const conversationsBytes = sqlite
    ? (sqlite.payloadBytes?.conversations ?? 0)
    : bytes(memory.conversations);
  return {
    roundsBytes,
    ledgerBytes,
    eventsBytes,
    conversationsBytes,
    totalBytes: roundsBytes + ledgerBytes + eventsBytes + conversationsBytes,
    browserUsage: estimate?.usage,
    browserQuota: estimate?.quota,
    backend: sqlite ? "sqlite" : "indexeddb",
    sqliteConnected: Boolean(sqlite),
    sqliteBytes: sqlite?.sqliteBytes,
    sqlitePath: sqlite?.databasePath,
    sqliteCounts: sqlite?.counts,
  };
}

export function aggregateCasinoRounds(
  rounds: CasinoRoundRecord[],
): CasinoSummary {
  const safe = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const played = rounds.filter((round) => round.playerParticipated);
  const games = [...new Set(rounds.map((round) => round.game))];
  const summarize = (game: CasinoGameId): GameSummary => {
    const all = rounds.filter((round) => round.game === game);
    const gamePlayed = all.filter((round) => round.playerParticipated);
    const totalStake = gamePlayed.reduce(
      (sum, round) => sum + safe(round.stake),
      0,
    );
    const totalPayout = gamePlayed.reduce(
      (sum, round) => sum + safe(round.grossPayout),
      0,
    );
    return {
      game,
      rounds: all.length,
      playedRounds: gamePlayed.length,
      wins: gamePlayed.filter((round) => round.outcome === "win").length,
      losses: gamePlayed.filter((round) => round.outcome === "loss").length,
      pushes: gamePlayed.filter((round) => round.outcome === "push").length,
      totalStake,
      totalPayout,
      net: totalPayout - totalStake,
      rtp: totalStake ? totalPayout / totalStake : 0,
    };
  };
  const totalStake = played.reduce((sum, round) => sum + safe(round.stake), 0);
  const totalPayout = played.reduce(
    (sum, round) => sum + safe(round.grossPayout),
    0,
  );
  return {
    generatedAt: new Date().toISOString(),
    rounds: rounds.length,
    playedRounds: played.length,
    liveRounds: rounds.filter((round) => round.source === "live-table").length,
    wins: played.filter((round) => round.outcome === "win").length,
    losses: played.filter((round) => round.outcome === "loss").length,
    pushes: played.filter((round) => round.outcome === "push").length,
    totalStake,
    totalPayout,
    net: totalPayout - totalStake,
    rtp: totalStake ? totalPayout / totalStake : 0,
    byGame: games
      .map(summarize)
      .sort((a, b) => b.playedRounds - a.playedRounds),
  };
}

const numeric = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const roundField = (round: CasinoRoundRecord, key: string) =>
  numeric(round.result[key]);
const modifierField = (round: CasinoRoundRecord, key: string) =>
  round.modifiers?.[key];

function slotReferenceBet(round: CasinoRoundRecord) {
  return (
    numeric(modifierField(round, "wager")) ||
    roundField(round, "referenceBet") ||
    numeric(modifierField(round, "actualStake")) ||
    round.stake ||
    1
  );
}

function quantile(values: number[], percentile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile))
  ];
}

function auditSlotSegment(rounds: CasinoRoundRecord[]): SlotAuditSegment {
  let currentZero = 0;
  let longestZeroStreak = 0;
  let currentBelowStake = 0;
  let longestBelowStakeStreak = 0;
  const winMultiples: number[] = [];
  let referenceExposure = 0;
  rounds.forEach((round) => {
    const referenceBet = slotReferenceBet(round);
    const multiple = referenceBet ? round.grossPayout / referenceBet : 0;
    referenceExposure += referenceBet;
    if (round.grossPayout > 0) winMultiples.push(multiple);
    currentZero = round.grossPayout <= 0 ? currentZero + 1 : 0;
    currentBelowStake = multiple < 1 ? currentBelowStake + 1 : 0;
    longestZeroStreak = Math.max(longestZeroStreak, currentZero);
    longestBelowStakeStreak = Math.max(
      longestBelowStakeStreak,
      currentBelowStake,
    );
  });
  const totalStake = rounds.reduce((sum, round) => sum + round.stake, 0);
  const totalPayout = rounds.reduce((sum, round) => sum + round.grossPayout, 0);
  return {
    spins: rounds.length,
    totalStake,
    totalPayout,
    observedRtp:
      totalStake || referenceExposure
        ? totalPayout / (totalStake || referenceExposure)
        : 0,
    hitRate: rounds.length
      ? rounds.filter((round) => round.grossPayout > 0).length / rounds.length
      : 0,
    profitHitRate: rounds.length
      ? rounds.filter((round) => round.net > 0).length / rounds.length
      : 0,
    stakeReturnRate: rounds.length
      ? rounds.filter((round) => round.grossPayout >= slotReferenceBet(round))
          .length / rounds.length
      : 0,
    fiveXRate: rounds.length
      ? rounds.filter(
          (round) => round.grossPayout >= slotReferenceBet(round) * 5,
        ).length / rounds.length
      : 0,
    zeroRate: rounds.length
      ? rounds.filter((round) => round.grossPayout <= 0).length / rounds.length
      : 0,
    longestZeroStreak,
    longestBelowStakeStreak,
    averageWinX: winMultiples.length
      ? winMultiples.reduce((sum, value) => sum + value, 0) /
        winMultiples.length
      : 0,
    medianWinX: quantile(winMultiples, 0.5),
    p90WinX: quantile(winMultiples, 0.9),
    p99WinX: quantile(winMultiples, 0.99),
    maxWinX: winMultiples.length ? Math.max(...winMultiples) : 0,
  };
}

export function aggregateSlotMathAudits(
  rounds: CasinoRoundRecord[],
): SlotMathAudit[] {
  return (["neon-kasasi", "kaptan-mercan", "sekerhane-1024"] as const).map(
    (game) => {
      const gameRounds = rounds.filter(
        (round) => round.game === game && round.playerParticipated,
      );
      const isFreeSpin = (round: CasinoRoundRecord) =>
        modifierField(round, "freeSpin") === true ||
        modifierField(round, "source") === "free-spin";
      const isBonusBuy = (round: CasinoRoundRecord) =>
        modifierField(round, "source") === "bonus-buy" ||
        numeric(modifierField(round, "purchaseMultiplier")) > 0;
      const freeSpins = gameRounds.filter(isFreeSpin);
      const paidBase = gameRounds.filter(
        (round) => round.stake > 0 && !isFreeSpin(round) && !isBonusBuy(round),
      );
      const naturalBonusTriggers = paidBase.filter(
        (round) =>
          roundField(round, "freeSpinsAwarded") > 0 ||
          roundField(round, "bonusSpinsAwarded") > 0,
      ).length;
      const bonusSessions = new Set(
        freeSpins
          .map((round) => modifierField(round, "bonusSessionId"))
          .filter(Boolean),
      ).size;
      return {
        game,
        paidBase: auditSlotSegment(paidBase),
        freeSpins: auditSlotSegment(freeSpins),
        bonusBuys: gameRounds.filter(isBonusBuy).length,
        naturalBonusTriggers,
        bonusSessions,
        sampleWarning: paidBase.length < 1_000,
      };
    },
  );
}

export async function getSlotMathAudits(scope: DataScope = "me") {
  return aggregateSlotMathAudits(await getCasinoRounds(scope));
}

export async function getCasinoSummary(scope: DataScope = "me") {
  if (typeof window !== "undefined") {
    if (!(await ensureSqliteReady()))
      throw new Error("Sunucu istatistiklerine şu anda ulaşılamıyor.");
    // The browser fallback intentionally has no shared account data. Returning
    // an aggregate of that empty fallback used to replace real totals with 0.
    return sqliteRequest<CasinoSummary>(
      `/summary${scope === "me" ? "?scope=me" : ""}`,
    );
  }
  if (await ensureSqliteReady()) {
    try {
      return await sqliteRequest<CasinoSummary>(
        `/summary${scope === "me" ? "?scope=me" : ""}`,
      );
    } catch {
      /* Non-browser tools can still aggregate their in-memory records. */
    }
  }
  return aggregateCasinoRounds(await getCasinoRounds());
}

export async function clearCasinoResearchData() {
  if (typeof indexedDB === "undefined") {
    memory.rounds = [];
    memory.ledger = [];
    memory.events = [];
    memory.conversations = [];
    memory.meta.clear();
    if (await ensureSqliteReady())
      await sqliteRequest("/all", { method: "DELETE" }).catch(() => undefined);
    notify();
    return;
  }
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [ROUND_STORE, LEDGER_STORE, EVENT_STORE, META_STORE, AI_STORE],
      "readwrite",
    );
    transaction.objectStore(ROUND_STORE).clear();
    transaction.objectStore(LEDGER_STORE).clear();
    transaction.objectStore(EVENT_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    transaction.objectStore(AI_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  if (await ensureSqliteReady())
    await sqliteRequest("/all", { method: "DELETE" }).catch(() => undefined);
  notify();
}

export function subscribeCasinoDatabase(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportCasinoResearchJson(scope: DataScope = "me") {
  const [rounds, ledger, events, conversations, storage] = await Promise.all([
    readAllSqlite<CasinoRoundRecord>("rounds", scope).then(
      (records) => records ?? getCasinoRounds(scope),
    ),
    readAllSqlite<WalletLedgerRecord>("ledger", scope).then(
      (records) => records ?? getWalletLedger(scope),
    ),
    readAllSqlite<CasinoEventRecord>("events", scope).then(
      (records) => records ?? getCasinoEvents(scope),
    ),
    readAllSqlite<AIConversationRecord>("conversations", scope).then(
      (records) => records ?? getAIConversations(scope),
    ),
    getCasinoStorageStats(),
  ]);
  download(
    `pehlevan-royale-veri-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        summary: aggregateCasinoRounds(rounds),
        storage,
        rounds,
        ledger,
        events,
        conversations,
      },
      null,
      2,
    ),
    "application/json",
  );
}

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function exportCasinoRoundsCsv(scope: DataScope = "me") {
  const rounds =
    (await readAllSqlite<CasinoRoundRecord>("rounds", scope)) ??
    (await getCasinoRounds(scope));
  const columns: Array<keyof CasinoRoundRecord> = [
    "id",
    "roundId",
    "game",
    "variant",
    "source",
    "playerParticipated",
    "startedAt",
    "settledAt",
    "stake",
    "grossPayout",
    "net",
    "outcome",
    "balanceBefore",
    "balanceAfter",
    "result",
    "modifiers",
  ];
  const rows = rounds.map((round) =>
    columns
      .map((column) =>
        csvCell(
          typeof round[column] === "object"
            ? JSON.stringify(round[column])
            : round[column],
        ),
      )
      .join(","),
  );
  download(
    `pehlevan-royale-turlar-${new Date().toISOString().slice(0, 10)}.csv`,
    [columns.join(","), ...rows].join("\n"),
    "text/csv;charset=utf-8",
  );
}
