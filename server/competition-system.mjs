import { createHash } from "node:crypto";
import {
  META_SYSTEM_CONFIG,
  rebuildMetaSystem,
  weekKeyFor,
} from "./meta-system.mjs";
import {
  getSocialCompetition,
  initializeCompetitionPhase7,
  processClubSettlement,
} from "./competition-phase7.mjs";

const MICRO_PR = 1_000_000;
const toPR = (value) => Number(value ?? 0) / MICRO_PR;
const now = () => new Date().toISOString();
const idFor = (...parts) =>
  createHash("sha256").update(parts.join("|")).digest("hex");
const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const titleById = new Map(
  META_SYSTEM_CONFIG.titles.map((title) => [title.id, title]),
);
const ensureColumn = (database, table, column, definition) => {
  if (
    !database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((row) => row.name === column)
  ) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const BASE_ACHIEVEMENTS = [
  {
    id: "ilk-is",
    name: "İlk İş",
    detail: "Casino kariyerindeki ilk geçerli turu tamamla.",
    rarity: "common",
    fame: 10,
    seasonPoints: 2,
    titleId: "kasa-ciragi",
  },
  {
    id: "on-kat",
    name: "On Kat",
    detail: "Tek turda 10× veya üstünü gör.",
    rarity: "common",
    fame: 20,
    seasonPoints: 3,
    titleId: "kasa-adami",
  },
  {
    id: "yuz-kat",
    name: "Yüz Kat",
    detail: "Tek turda 100× veya üstünü gör.",
    rarity: "rare",
    fame: 75,
    seasonPoints: 8,
    titleId: "masa-reisi",
  },
  {
    id: "milyoner",
    name: "Milyonluk Kasa",
    detail: "Rekabet bakiyesinde 1.000.000 PR barajını geç.",
    rarity: "rare",
    fame: 100,
    seasonPoints: 10,
    titleId: "mahalle-patronu",
  },
  {
    id: "ten-bagger",
    name: "Kasayı Ona Katla",
    detail: "Başlangıç rekabet bakiyeni on katına çıkar.",
    rarity: "epic",
    fame: 180,
    seasonPoints: 15,
    titleId: "kasa-baronu",
  },
  {
    id: "leviathan",
    name: "Leviathan",
    detail: "Kaptan Mercan’da 1.000× para balığı gör.",
    rarity: "mythic",
    fame: 500,
    seasonPoints: 30,
    titleId: "mercan-babasi",
  },
  {
    id: "seker-firtinasi",
    name: "Şeker Fırtınası",
    detail: "Şekerhane’de 15 veya daha fazla cascade yap.",
    rarity: "legendary",
    fame: 300,
    seasonPoints: 24,
    titleId: "seker-baronu",
  },
  {
    id: "neon-patronu",
    name: "Neon Patronu",
    detail: "Neon Kasası’nda 100× veya üstü çarpan gör.",
    rarity: "legendary",
    fame: 300,
    seasonPoints: 24,
    titleId: "neon-patronu",
  },
  {
    id: "yikim-uzmani",
    name: "Yıkım Uzmanı",
    detail: "Obsidyen Damarı’nda 15 güvenli hücre aç.",
    rarity: "epic",
    fame: 180,
    seasonPoints: 15,
    titleId: null,
  },
  {
    id: "pilot",
    name: "Pilot",
    detail: "Altın Rota’da 100× başarılı çıkış yap.",
    rarity: "legendary",
    fame: 300,
    seasonPoints: 24,
    titleId: null,
  },
  {
    id: "geri-donus",
    name: "Büyük Geri Dönüş",
    detail: "Zirvenin beşte birine düştükten sonra eski zirveyi geç.",
    rarity: "mythic",
    fame: 600,
    seasonPoints: 35,
    titleId: "divan-babasi",
  },
  {
    id: "kasayi-devirdi",
    name: "Kasayı Devirdi",
    detail:
      "Players vs House haftasında oyuncular tarafında yer al ve kasayı yen.",
    rarity: "legendary",
    fame: 180,
    seasonPoints: 15,
    titleId: null,
  },
];

const ACHIEVEMENT_CONDITIONS = Object.freeze({
  "ilk-is": { trigger: "settlement" },
  "on-kat": {
    trigger: "settlement",
    metric: "multiplier",
    thresholdConfig: "thresholds.tenX",
  },
  "yuz-kat": {
    trigger: "settlement",
    metric: "multiplier",
    thresholdConfig: "thresholds.hundredX",
  },
  milyoner: { trigger: "wallet", metric: "balance", threshold: 1_000_000 },
  "ten-bagger": {
    trigger: "wallet-ratio",
    metric: "bankrollGrowth",
    threshold: 10,
  },
  leviathan: {
    trigger: "settlement",
    gameId: "kaptan-mercan",
    metric: "metadata.fishMultiplier",
    thresholdConfig: "thresholds.leviathan",
  },
  "seker-firtinasi": {
    trigger: "settlement",
    gameId: "sekerhane-1024",
    metric: "metadata.cascadeCount",
    thresholdConfig: "thresholds.sugarCascade",
  },
  "neon-patronu": {
    trigger: "settlement",
    gameId: "neon-kasasi",
    metric: "multiplier",
    thresholdConfig: "thresholds.neonMultiplier",
  },
  "yikim-uzmani": {
    trigger: "settlement",
    gameId: "obsidyen-damari",
    metric: "metadata.tilesCleared",
    thresholdConfig: "thresholds.minesTiles",
  },
  pilot: {
    trigger: "settlement",
    gameId: "altin-rota",
    metric: "metadata.cashoutMultiplier",
    thresholdConfig: "thresholds.pilotCashout",
  },
  "geri-donus": { trigger: "comeback" },
  "kasayi-devirdi": { trigger: "house-event" },
});

const ACHIEVEMENTS = BASE_ACHIEVEMENTS.map((item) => ({
  ...item,
  condition: ACHIEVEMENT_CONDITIONS[item.id],
}));

const MILESTONES = [
  [250_000, "kasa-adami"],
  [1_000_000, "mahalle-patronu"],
  [5_000_000, "kasa-baronu"],
  [10_000_000, "divan-babasi"],
  [25_000_000, "buyuk-patron"],
  [50_000_000, "konsey-babasi"],
  [100_000_000, "son-patron"],
];

const PASSPORT_GOALS = [
  ["first-round", "İlk iş", 1],
  ["10x", "10× vuruş", 10],
  ["50x", "50× vuruş", 50],
  ["100x", "100× vuruş", 100],
  ["500x", "500× vuruş", 500],
  ["1000x", "1.000× vuruş", 1000],
];

export const DEFAULT_COMPETITION_CONFIG = Object.freeze({
  version: 1,
  economy: { startingPiar: 5000 },
  season: { durationDays: 28, nameTemplate: "Sezon {n} · Büyük Hesaplaşma" },
  schedule: { timeZone: "Europe/Istanbul" },
  scoring: {
    fiveX: 1,
    tenX: 2,
    twentyFiveX: 3,
    hundredX: 5,
    casinoRecord: 10,
    rivalVictory: 12,
    rivalFame: 30,
  },
  thresholds: {
    tenX: 10,
    hundredX: 100,
    leviathan: 1000,
    sugarCascade: 15,
    neonMultiplier: 100,
    minesTiles: 15,
    pilotCashout: 100,
    comebackDropRatio: 0.2,
  },
  mastery: { silver: 100, gold: 300, diamond: 800, legendary: 2000 },
  milestones: MILESTONES.map(([value, titleId]) => ({ value, titleId })),
  records: {
    biggestPayout: true,
    highestMultiplier: true,
    fishMultiplier: true,
    longestCascade: true,
    cellMultiplier: true,
    tilesCleared: true,
    cashoutMultiplier: true,
    naturalBlackjacks: true,
    pokerPot: true,
    safeSteps: true,
    hardestMines: true,
  },
  playersVsHouse: { enabled: true, rewardAchievement: "kasayi-devirdi" },
  eligibility: { excludedUserIds: [] },
  feed: {
    enabled: true,
    limit: 30,
    repeatWindowMinutes: 10,
    bigHitMultiplier: 100,
    legendaryHitMultiplier: 500,
    winningStreak: 5,
  },
  leaderboards: {
    wealth: true,
    profit: true,
    seasonProfit: true,
    weekly: true,
    growth: true,
    crown: true,
    season: true,
    career: true,
  },
});

const mergeCompetitionConfig = (saved = {}) => ({
  ...DEFAULT_COMPETITION_CONFIG,
  ...saved,
  economy: { ...DEFAULT_COMPETITION_CONFIG.economy, ...saved.economy },
  season: { ...DEFAULT_COMPETITION_CONFIG.season, ...saved.season },
  schedule: { ...DEFAULT_COMPETITION_CONFIG.schedule, ...saved.schedule },
  scoring: { ...DEFAULT_COMPETITION_CONFIG.scoring, ...saved.scoring },
  thresholds: { ...DEFAULT_COMPETITION_CONFIG.thresholds, ...saved.thresholds },
  mastery: { ...DEFAULT_COMPETITION_CONFIG.mastery, ...saved.mastery },
  milestones: Array.isArray(saved.milestones)
    ? saved.milestones
    : DEFAULT_COMPETITION_CONFIG.milestones,
  records: { ...DEFAULT_COMPETITION_CONFIG.records, ...saved.records },
  playersVsHouse: {
    ...DEFAULT_COMPETITION_CONFIG.playersVsHouse,
    ...saved.playersVsHouse,
  },
  eligibility: {
    ...DEFAULT_COMPETITION_CONFIG.eligibility,
    ...saved.eligibility,
    excludedUserIds: Array.isArray(saved.eligibility?.excludedUserIds)
      ? saved.eligibility.excludedUserIds.map(String)
      : [],
  },
  feed: { ...DEFAULT_COMPETITION_CONFIG.feed, ...saved.feed },
  leaderboards: {
    ...DEFAULT_COMPETITION_CONFIG.leaderboards,
    ...saved.leaderboards,
  },
});

export function getCompetitionConfig(database) {
  const row = database
    .prepare("SELECT config_json FROM competition_settings WHERE id='global'")
    .get();
  return mergeCompetitionConfig(row ? JSON.parse(row.config_json) : {});
}

const competitionWeekKey = (database, value = new Date()) =>
  weekKeyFor(value, getCompetitionConfig(database).schedule.timeZone);

export function initializeCompetitionSystem(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_careers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, fame INTEGER NOT NULL DEFAULT 0,
      active_title_id TEXT, championships INTEGER NOT NULL DEFAULT 0, records_broken INTEGER NOT NULL DEFAULT 0,
      comeback_anchor_micro INTEGER, comeback_trough_micro INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active','archived')),created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_seasons_status_time ON seasons(status,starts_at DESC);
    CREATE TABLE IF NOT EXISTS season_scores (
      season_id TEXT NOT NULL REFERENCES seasons(id),user_id TEXT NOT NULL REFERENCES users(id),season_points INTEGER NOT NULL DEFAULT 0,
      net_profit_micro INTEGER NOT NULL DEFAULT 0,rounds INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,
      achievements INTEGER NOT NULL DEFAULT 0,records INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,
      PRIMARY KEY(season_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_season_rank ON season_scores(season_id,season_points DESC,net_profit_micro DESC);
    CREATE TABLE IF NOT EXISTS season_results (
      season_id TEXT NOT NULL REFERENCES seasons(id),user_id TEXT NOT NULL REFERENCES users(id),rank INTEGER NOT NULL,
      season_points INTEGER NOT NULL,net_profit_micro INTEGER NOT NULL,recorded_at TEXT NOT NULL,
      PRIMARY KEY(season_id,rank),UNIQUE(season_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS achievement_definitions (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,detail TEXT NOT NULL,rarity TEXT NOT NULL,fame INTEGER NOT NULL,
      season_points INTEGER NOT NULL,title_id TEXT,config_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id TEXT NOT NULL REFERENCES users(id),achievement_id TEXT NOT NULL REFERENCES achievement_definitions(id),
      unlocked_at TEXT NOT NULL,round_id TEXT,metadata_json TEXT NOT NULL,PRIMARY KEY(user_id,achievement_id)
    );
    CREATE TABLE IF NOT EXISTS user_titles (
      user_id TEXT NOT NULL REFERENCES users(id),title_id TEXT NOT NULL,unlocked_at TEXT NOT NULL,source TEXT NOT NULL,
      PRIMARY KEY(user_id,title_id)
    );
    CREATE TABLE IF NOT EXISTS player_game_mastery (
      user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,xp INTEGER NOT NULL DEFAULT 0,tier TEXT NOT NULL DEFAULT 'Bronze',
      rounds INTEGER NOT NULL DEFAULT 0,best_multiplier REAL NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,game_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mastery_game_xp ON player_game_mastery(game_id,xp DESC);
    CREATE TABLE IF NOT EXISTS passport_progress (
      user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,goal_id TEXT NOT NULL,label TEXT NOT NULL,
      achieved_at TEXT NOT NULL,round_id TEXT,PRIMARY KEY(user_id,game_id,goal_id)
    );
    CREATE TABLE IF NOT EXISTS player_personal_records (
      user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,metric_id TEXT NOT NULL,metric_label TEXT NOT NULL,
      value REAL NOT NULL,round_id TEXT NOT NULL,achieved_at TEXT NOT NULL,metadata_json TEXT NOT NULL,
      PRIMARY KEY(user_id,game_id,metric_id)
    );
    CREATE TABLE IF NOT EXISTS game_records (
      game_id TEXT NOT NULL,metric_id TEXT NOT NULL,metric_label TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),
      value REAL NOT NULL,round_id TEXT NOT NULL,achieved_at TEXT NOT NULL,previous_user_id TEXT,previous_value REAL,
      PRIMARY KEY(game_id,metric_id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_holder ON game_records(user_id,achieved_at DESC);
    CREATE TABLE IF NOT EXISTS season_game_records (
      season_id TEXT NOT NULL REFERENCES seasons(id),game_id TEXT NOT NULL,metric_id TEXT NOT NULL,metric_label TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),value REAL NOT NULL,round_id TEXT NOT NULL,achieved_at TEXT NOT NULL,
      previous_user_id TEXT,previous_value REAL,PRIMARY KEY(season_id,game_id,metric_id)
    );
    CREATE INDEX IF NOT EXISTS idx_season_records_holder ON season_game_records(season_id,user_id,achieved_at DESC);
    CREATE TABLE IF NOT EXISTS game_record_history (
      id TEXT PRIMARY KEY,game_id TEXT NOT NULL,metric_id TEXT NOT NULL,user_id TEXT NOT NULL,value REAL NOT NULL,
      round_id TEXT NOT NULL,previous_user_id TEXT,previous_value REAL,achieved_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),type TEXT NOT NULL,severity TEXT NOT NULL,
      title TEXT NOT NULL,message TEXT NOT NULL,game_id TEXT,entity_id TEXT,occurred_at TEXT NOT NULL,metadata_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_events(occurred_at DESC);
    CREATE TABLE IF NOT EXISTS bankroll_snapshots (
      user_id TEXT NOT NULL REFERENCES users(id),snapshot_date TEXT NOT NULL,open_micro INTEGER NOT NULL,low_micro INTEGER NOT NULL,
      high_micro INTEGER NOT NULL,close_micro INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,snapshot_date)
    );
    CREATE TABLE IF NOT EXISTS crown_reigns (
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),acquired_at TEXT NOT NULL,released_at TEXT,
      acquired_balance_micro INTEGER NOT NULL,released_balance_micro INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_crown_current ON crown_reigns(released_at,acquired_at DESC);
    CREATE TABLE IF NOT EXISTS rivalries (
      week_key TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),rival_user_id TEXT NOT NULL REFERENCES users(id),
      assigned_at TEXT NOT NULL,PRIMARY KEY(week_key,user_id)
    );
    CREATE TABLE IF NOT EXISTS profile_showcase (
      user_id TEXT NOT NULL REFERENCES users(id),slot INTEGER NOT NULL,item_type TEXT NOT NULL,item_id TEXT NOT NULL,
      selected_at TEXT NOT NULL,PRIMARY KEY(user_id,slot)
    );
    CREATE TABLE IF NOT EXISTS competition_processed_settlements (
      event_id TEXT PRIMARY KEY,processed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS house_events (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,status TEXT NOT NULL,
      target_net_micro INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS house_event_scores (
      event_id TEXT PRIMARY KEY REFERENCES house_events(id),players_net_micro INTEGER NOT NULL DEFAULT 0,
      house_net_micro INTEGER NOT NULL DEFAULT 0,eligible_rounds INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS house_event_contributions (
      event_id TEXT NOT NULL REFERENCES house_events(id),user_id TEXT NOT NULL REFERENCES users(id),net_micro INTEGER NOT NULL DEFAULT 0,
      rounds INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(event_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS house_event_results (
      event_id TEXT PRIMARY KEY REFERENCES house_events(id),players_won INTEGER NOT NULL,players_net_micro INTEGER NOT NULL,
      house_net_micro INTEGER NOT NULL,participants INTEGER NOT NULL,finalized_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rival_results (
      week_key TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),rival_user_id TEXT NOT NULL REFERENCES users(id),
      player_profit_micro INTEGER NOT NULL,rival_profit_micro INTEGER NOT NULL,result TEXT NOT NULL,
      season_points INTEGER NOT NULL DEFAULT 0,fame INTEGER NOT NULL DEFAULT 0,finalized_at TEXT NOT NULL,
      PRIMARY KEY(week_key,user_id)
    );
    CREATE TABLE IF NOT EXISTS competition_settings (
      id TEXT PRIMARY KEY,config_json TEXT NOT NULL,updated_by TEXT REFERENCES users(id),updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS competition_admin_audit (
      id TEXT PRIMARY KEY,actor_user_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,
      entity_id TEXT,before_json TEXT,after_json TEXT,reason TEXT,occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_competition_admin_audit_time ON competition_admin_audit(occurred_at DESC);
    CREATE TABLE IF NOT EXISTS clubs (
      id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,tag TEXT UNIQUE,created_by TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS club_members (
      club_id TEXT NOT NULL REFERENCES clubs(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,
      contribution_points INTEGER NOT NULL DEFAULT 0,joined_at TEXT NOT NULL,PRIMARY KEY(club_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS club_events (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,status TEXT NOT NULL,
      per_player_cap INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS club_scores (
      event_id TEXT NOT NULL REFERENCES club_events(id),club_id TEXT NOT NULL REFERENCES clubs(id),score INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,PRIMARY KEY(event_id,club_id)
    );
    CREATE TABLE IF NOT EXISTS multiplayer_ratings (
      user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 1000,
      wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,
      tournament_wins INTEGER NOT NULL DEFAULT 0,final_tables INTEGER NOT NULL DEFAULT 0,heads_up_wins INTEGER NOT NULL DEFAULT 0,
      largest_pot_micro INTEGER NOT NULL DEFAULT 0,best_hand TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,game_id)
    );
    CREATE TABLE IF NOT EXISTS tournament_results (
      id TEXT PRIMARY KEY,tournament_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,
      placement INTEGER NOT NULL,field_size INTEGER NOT NULL,reward_micro INTEGER NOT NULL DEFAULT 0,rating_delta INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL,recorded_at TEXT NOT NULL,UNIQUE(tournament_id,user_id)
    );
  `);
  ensureColumn(database, "clubs", "tag", "TEXT");
  ensureColumn(database, "clubs", "status", "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn(
    database,
    "club_members",
    "contribution_points",
    "INTEGER NOT NULL DEFAULT 0",
  );
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_tag ON clubs(tag) WHERE tag IS NOT NULL",
  );
  database
    .prepare(
      `INSERT INTO competition_settings(id,config_json,updated_at) VALUES('global',?,?) ON CONFLICT(id) DO NOTHING`,
    )
    .run(JSON.stringify(DEFAULT_COMPETITION_CONFIG), now());
  const persistedConfig = database
    .prepare("SELECT config_json FROM competition_settings WHERE id='global'")
    .get();
  const upgradedConfig = JSON.stringify(
    mergeCompetitionConfig(JSON.parse(persistedConfig.config_json)),
  );
  if (upgradedConfig !== persistedConfig.config_json)
    database
      .prepare(
        "UPDATE competition_settings SET config_json=?,updated_at=? WHERE id='global'",
      )
      .run(upgradedConfig, now());
  const achievementInsert =
    database.prepare(`INSERT INTO achievement_definitions(id,name,detail,rarity,fame,season_points,title_id,config_json)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,detail=excluded.detail,rarity=excluded.rarity,title_id=excluded.title_id,config_json=excluded.config_json`);
  for (const item of ACHIEVEMENTS)
    achievementInsert.run(
      item.id,
      item.name,
      item.detail,
      item.rarity,
      item.fame,
      item.seasonPoints,
      item.titleId,
      JSON.stringify(item),
    );
  const timestamp = now();
  database
    .prepare(
      `INSERT INTO player_careers(user_id,created_at,updated_at) SELECT id,?,? FROM users
    WHERE 1 ON CONFLICT(user_id) DO NOTHING`,
    )
    .run(timestamp, timestamp);
  ensureSeason(database, timestamp);
  reconcileCrown(database, timestamp);
  initializeCompetitionPhase7(database);
}

function ensureCareer(database, userId, at = now()) {
  database
    .prepare(
      `INSERT INTO player_careers(user_id,created_at,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING`,
    )
    .run(userId, at, at);
}

function emitActivity(database, event) {
  let repeatWindowMinutes = 0;
  try {
    repeatWindowMinutes = finite(
      getCompetitionConfig(database).feed.repeatWindowMinutes,
    );
  } catch {
    /* Schema bootstrap. */
  }
  if (!event.id && repeatWindowMinutes > 0) {
    const cutoff = new Date(
      new Date(event.occurredAt).getTime() - repeatWindowMinutes * 60_000,
    ).toISOString();
    const duplicate = database
      .prepare(
        `SELECT 1 FROM activity_events WHERE type=? AND COALESCE(user_id,'')=COALESCE(?,'')
      AND COALESCE(entity_id,'')=COALESCE(?,'') AND occurred_at>=? LIMIT 1`,
      )
      .get(event.type, event.userId ?? null, event.entityId ?? null, cutoff);
    if (duplicate) return;
  }
  const id =
    event.id ??
    idFor(
      event.type,
      event.userId ?? "",
      event.entityId ?? "",
      event.occurredAt,
      event.message,
    );
  database
    .prepare(
      `INSERT INTO activity_events(id,user_id,type,severity,title,message,game_id,entity_id,occurred_at,metadata_json)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
    )
    .run(
      id,
      event.userId ?? null,
      event.type,
      event.severity ?? "normal",
      event.title,
      event.message,
      event.gameId ?? null,
      event.entityId ?? null,
      event.occurredAt,
      event.metadata ? JSON.stringify(event.metadata) : "{}",
    );
}

export function ensureSeason(database, at = now()) {
  const config = getCompetitionConfig(database);
  let active = database
    .prepare(
      "SELECT * FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1",
    )
    .get();
  if (active && active.ends_at <= at) {
    const ranking = database
      .prepare(
        "SELECT season_id,user_id,season_points,CAST(net_profit_micro AS REAL) net_profit_micro FROM season_scores WHERE season_id=? ORDER BY season_points DESC,net_profit_micro DESC,user_id LIMIT 3",
      )
      .all(active.id);
    const insert = database.prepare(
      "INSERT INTO season_results(season_id,user_id,rank,season_points,net_profit_micro,recorded_at) VALUES(?,?,?,?,?,?) ON CONFLICT(season_id,rank) DO NOTHING",
    );
    ranking.forEach((row, index) =>
      insert.run(
        active.id,
        row.user_id,
        index + 1,
        row.season_points,
        row.net_profit_micro,
        at,
      ),
    );
    if (ranking[0]) {
      database
        .prepare(
          "UPDATE player_careers SET championships=championships+1,updated_at=? WHERE user_id=?",
        )
        .run(at, ranking[0].user_id);
      emitActivity(database, {
        type: "season-champion",
        severity: "legendary",
        title: "SEZON ŞAMPİYONU",
        message: `${displayName(database, ranking[0].user_id)} sezonu patron olarak kapattı.`,
        userId: ranking[0].user_id,
        entityId: active.id,
        occurredAt: at,
      });
    }
    database
      .prepare("UPDATE seasons SET status='archived' WHERE id=?")
      .run(active.id);
    active = null;
  }
  if (!active) {
    const count =
      Number(
        database.prepare("SELECT COUNT(*) count FROM seasons").get().count,
      ) + 1;
    const starts = new Date(at);
    const ends = new Date(
      starts.getTime() +
        Math.max(1, finite(config.season.durationDays)) * 24 * 60 * 60 * 1000,
    );
    const id = `season-${count}-${starts.toISOString().slice(0, 10)}`;
    const seasonName = String(
      config.season.nameTemplate ||
        DEFAULT_COMPETITION_CONFIG.season.nameTemplate,
    ).replace("{n}", String(count));
    database
      .prepare(
        "INSERT INTO seasons(id,name,starts_at,ends_at,status,created_at) VALUES(?,?,?,?, 'active',?)",
      )
      .run(id, seasonName, starts.toISOString(), ends.toISOString(), at);
    active = database.prepare("SELECT * FROM seasons WHERE id=?").get(id);
  }
  return active;
}

function finalizeHouseEvents(database, at = now()) {
  const expired = database
    .prepare(
      `SELECT e.id,e.ends_at,CAST(s.players_net_micro AS REAL) players_net_micro,CAST(s.house_net_micro AS REAL) house_net_micro
    FROM house_events e JOIN house_event_scores s ON s.event_id=e.id WHERE e.status='active' AND e.ends_at<=?`,
    )
    .all(at);
  for (const event of expired) {
    const playersWon =
      Number(event.players_net_micro) > Number(event.house_net_micro);
    const participants = database
      .prepare(
        "SELECT user_id FROM house_event_contributions WHERE event_id=? AND rounds>0",
      )
      .all(event.id);
    database
      .prepare("UPDATE house_events SET status=? WHERE id=?")
      .run("archived", event.id);
    const inserted = database
      .prepare(
        `INSERT INTO house_event_results(event_id,players_won,players_net_micro,house_net_micro,participants,finalized_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,
      )
      .run(
        event.id,
        playersWon ? 1 : 0,
        event.players_net_micro,
        event.house_net_micro,
        participants.length,
        at,
      );
    if (!inserted.changes) continue;
    const config = getCompetitionConfig(database);
    if (playersWon) {
      const season = ensureSeason(database, event.ends_at);
      for (const participant of participants)
        awardAchievement(
          database,
          season,
          participant.user_id,
          config.playersVsHouse.rewardAchievement,
          null,
          { eventId: event.id },
          at,
        );
    }
    emitActivity(database, {
      type: "house-event-result",
      severity: playersWon ? "legendary" : "important",
      title: playersWon ? "THE HOUSE HAS FALLEN" : "HOUSE HOLDS",
      message: playersWon
        ? `Oyuncular ${toPR(event.players_net_micro).toLocaleString("tr-TR")} PR net ile kasayı devirdi.`
        : `Kasa haftayı ${toPR(event.house_net_micro).toLocaleString("tr-TR")} PR önde kapattı.`,
      entityId: event.id,
      occurredAt: at,
      metadata: { playersWon, participants: participants.length },
    });
  }
}

export function ensureHouseEvent(database, at = now()) {
  finalizeHouseEvents(database, at);
  const weekKey = competitionWeekKey(database, at);
  const eventId = `house-${weekKey}`;
  const startsAt = new Date(`${weekKey}T00:00:00.000Z`);
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const status = new Date(at) >= endsAt ? "archived" : "active";
  database
    .prepare(
      `INSERT INTO house_events(id,name,starts_at,ends_at,status,target_net_micro,created_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
    )
    .run(
      eventId,
      `Players vs House · ${weekKey}`,
      startsAt.toISOString(),
      endsAt.toISOString(),
      status,
      0,
      at,
    );
  database
    .prepare(
      `INSERT INTO house_event_scores(event_id,updated_at) VALUES(?,?) ON CONFLICT(event_id) DO NOTHING`,
    )
    .run(eventId, at);
  return database
    .prepare(
      `SELECT e.*,CAST(s.players_net_micro AS REAL) players_net_micro,CAST(s.house_net_micro AS REAL) house_net_micro,
    s.eligible_rounds,s.updated_at FROM house_events e JOIN house_event_scores s ON s.event_id=e.id WHERE e.id=?`,
    )
    .get(eventId);
}

function updateHouseEvent(database, settlement) {
  if (!getCompetitionConfig(database).playersVsHouse.enabled) return;
  const event = ensureHouseEvent(database, settlement.settledAt);
  database
    .prepare(
      `UPDATE house_event_scores SET players_net_micro=players_net_micro+?,house_net_micro=house_net_micro-?,
    eligible_rounds=eligible_rounds+1,updated_at=? WHERE event_id=?`,
    )
    .run(
      settlement.netMicro,
      settlement.netMicro,
      settlement.settledAt,
      event.id,
    );
  database
    .prepare(
      `INSERT INTO house_event_contributions(event_id,user_id,net_micro,rounds,updated_at) VALUES(?,?,?,1,?)
    ON CONFLICT(event_id,user_id) DO UPDATE SET net_micro=net_micro+excluded.net_micro,rounds=rounds+1,updated_at=excluded.updated_at`,
    )
    .run(
      event.id,
      settlement.userId,
      settlement.netMicro,
      settlement.settledAt,
    );
}

function displayName(database, userId) {
  return (
    database.prepare("SELECT display_name FROM users WHERE id=?").get(userId)
      ?.display_name ?? "Bilinmeyen oyuncu"
  );
}

function addSeason(database, seasonId, userId, values, at) {
  database
    .prepare(
      `INSERT INTO season_scores(season_id,user_id,season_points,net_profit_micro,rounds,wins,achievements,records,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(season_id,user_id) DO UPDATE SET
      season_points=season_points+excluded.season_points,net_profit_micro=net_profit_micro+excluded.net_profit_micro,
      rounds=rounds+excluded.rounds,wins=wins+excluded.wins,achievements=achievements+excluded.achievements,
      records=records+excluded.records,updated_at=excluded.updated_at`,
    )
    .run(
      seasonId,
      userId,
      values.points ?? 0,
      values.netMicro ?? 0,
      values.rounds ?? 0,
      values.wins ?? 0,
      values.achievements ?? 0,
      values.records ?? 0,
      at,
    );
}

function awardTitle(database, userId, titleId, source, at) {
  if (!titleId || !titleById.has(titleId)) return false;
  const result = database
    .prepare(
      "INSERT INTO user_titles(user_id,title_id,unlocked_at,source) VALUES(?,?,?,?) ON CONFLICT(user_id,title_id) DO NOTHING",
    )
    .run(userId, titleId, at, source);
  if (result.changes)
    database
      .prepare(
        "UPDATE player_careers SET active_title_id=COALESCE(active_title_id,?),updated_at=? WHERE user_id=?",
      )
      .run(titleId, at, userId);
  return Boolean(result.changes);
}

function awardAchievement(
  database,
  season,
  userId,
  achievementId,
  roundId,
  metadata,
  at,
) {
  const stored = database
    .prepare("SELECT * FROM achievement_definitions WHERE id=?")
    .get(achievementId);
  const definition = stored
    ? {
        ...stored,
        seasonPoints: Number(stored.season_points),
        titleId: stored.title_id,
      }
    : null;
  if (!definition) return false;
  const result = database
    .prepare(
      `INSERT INTO user_achievements(user_id,achievement_id,unlocked_at,round_id,metadata_json)
    VALUES(?,?,?,?,?) ON CONFLICT(user_id,achievement_id) DO NOTHING`,
    )
    .run(
      userId,
      achievementId,
      at,
      roundId ?? null,
      JSON.stringify(metadata ?? {}),
    );
  if (!result.changes) return false;
  database
    .prepare(
      "UPDATE player_careers SET fame=fame+?,updated_at=? WHERE user_id=?",
    )
    .run(definition.fame, at, userId);
  addSeason(
    database,
    season.id,
    userId,
    { points: definition.seasonPoints, achievements: 1 },
    at,
  );
  awardTitle(
    database,
    userId,
    definition.titleId,
    `achievement:${achievementId}`,
    at,
  );
  emitActivity(database, {
    type: "achievement",
    severity: ["legendary", "mythic"].includes(definition.rarity)
      ? "legendary"
      : "important",
    title: "BAŞARIM AÇILDI",
    message: `${displayName(database, userId)} “${definition.name}” başarımını açtı.`,
    userId,
    entityId: achievementId,
    occurredAt: at,
    metadata: { rarity: definition.rarity },
  });
  return true;
}

function valueAtPath(source, path) {
  return String(path ?? "")
    .split(".")
    .filter(Boolean)
    .reduce(
      (value, key) =>
        value && typeof value === "object" ? value[key] : undefined,
      source,
    );
}

function settlementAchievementMatches(condition, settlement, config) {
  if (!condition || condition.trigger !== "settlement") return false;
  if (condition.gameId && condition.gameId !== settlement.gameId) return false;
  if (!condition.metric) return true;
  const metric = finite(valueAtPath(settlement, condition.metric));
  const threshold = condition.thresholdConfig
    ? finite(valueAtPath(config, condition.thresholdConfig))
    : finite(condition.threshold);
  return metric >= threshold;
}

function evaluateSettlementAchievements(database, season, settlement, config) {
  const definitions = database
    .prepare("SELECT id,config_json FROM achievement_definitions")
    .all();
  const unlocked = [];
  for (const definition of definitions) {
    let condition;
    try {
      condition = JSON.parse(definition.config_json)?.condition;
    } catch {
      continue;
    }
    if (!settlementAchievementMatches(condition, settlement, config)) continue;
    if (
      awardAchievement(
        database,
        season,
        settlement.userId,
        definition.id,
        settlement.roundId,
        {
          gameId: settlement.gameId,
          multiplier: settlement.multiplier,
          ...settlement.metadata,
        },
        settlement.settledAt,
      )
    )
      unlocked.push(definition.id);
  }
  return unlocked;
}

function masteryTier(xp, thresholds = DEFAULT_COMPETITION_CONFIG.mastery) {
  if (xp >= thresholds.legendary) return "Legendary";
  if (xp >= thresholds.diamond) return "Diamond";
  if (xp >= thresholds.gold) return "Gold";
  if (xp >= thresholds.silver) return "Silver";
  return "Bronze";
}

const RECORD_DEFINITIONS = Object.freeze([
  {
    configKey: "biggestPayout",
    metricId: "biggest-payout",
    label: "En büyük ödeme",
    source: "payout",
  },
  {
    configKey: "highestMultiplier",
    metricId: "highest-multiplier",
    label: "En yüksek çarpan",
    source: "multiplier",
  },
  {
    configKey: "fishMultiplier",
    metricId: "fish-multiplier",
    label: "En büyük para balığı",
    games: ["kaptan-mercan"],
    source: "metadata.fishMultiplier",
  },
  {
    configKey: "longestCascade",
    metricId: "longest-cascade",
    label: "En uzun patlama zinciri",
    games: ["sekerhane-1024", "neon-kasasi"],
    source: "metadata.cascadeCount",
  },
  {
    configKey: "cellMultiplier",
    metricId: "cell-multiplier",
    label: "En büyük hücre çarpanı",
    games: ["sekerhane-1024"],
    source: "metadata.maxCellMultiplier",
  },
  {
    configKey: "tilesCleared",
    metricId: "tiles-cleared",
    label: "En çok güvenli hücre",
    games: ["obsidyen-damari"],
    source: "metadata.tilesCleared",
  },
  {
    configKey: "hardestMines",
    metricId: "mine-count",
    label: "Tamamlanan en zor mayın düzeni",
    games: ["obsidyen-damari"],
    source: "metadata.mineCount",
    outcomes: ["win"],
  },
  {
    configKey: "cashoutMultiplier",
    metricId: "cashout-multiplier",
    label: "En yüksek başarılı çıkış",
    games: ["altin-rota"],
    source: "metadata.cashoutMultiplier",
    outcomes: ["win"],
  },
  {
    configKey: "naturalBlackjacks",
    metricId: "natural-blackjacks",
    label: "Bir elde en çok doğal blackjack",
    games: ["blackjack"],
    source: "metadata.naturalBlackjacks",
  },
  {
    configKey: "pokerPot",
    metricId: "largest-pot",
    label: "En büyük pot",
    games: ["poker"],
    source: "metadata.potSize",
  },
  {
    configKey: "safeSteps",
    metricId: "safe-steps",
    label: "En çok güvenli adım",
    games: ["son-on"],
    source: "metadata.safeSteps",
  },
]);

function metricCandidates(database, settlement) {
  const enabled = getCompetitionConfig(database).records;
  return RECORD_DEFINITIONS.filter(
    (definition) =>
      enabled[definition.configKey] !== false &&
      (!definition.games || definition.games.includes(settlement.gameId)) &&
      (!definition.outcomes ||
        definition.outcomes.includes(settlement.outcome)),
  )
    .map((definition) => {
      const value =
        definition.source === "payout"
          ? settlement.payoutMicro / MICRO_PR
          : finite(valueAtPath(settlement, definition.source));
      return [definition.metricId, definition.label, value];
    })
    .filter(([, , value]) => value > 0);
}

function processRecords(database, season, settlement) {
  const config = getCompetitionConfig(database);
  let newRecords = 0;
  const personalBests = [];
  for (const [metricId, metricLabel, value] of metricCandidates(
    database,
    settlement,
  )) {
    const personal = database
      .prepare(
        "SELECT value FROM player_personal_records WHERE user_id=? AND game_id=? AND metric_id=?",
      )
      .get(settlement.userId, settlement.gameId, metricId);
    if (!personal || value > personal.value) {
      database
        .prepare(
          `INSERT INTO player_personal_records(user_id,game_id,metric_id,metric_label,value,round_id,achieved_at,metadata_json)
        VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,game_id,metric_id) DO UPDATE SET metric_label=excluded.metric_label,value=excluded.value,round_id=excluded.round_id,achieved_at=excluded.achieved_at,metadata_json=excluded.metadata_json`,
        )
        .run(
          settlement.userId,
          settlement.gameId,
          metricId,
          metricLabel,
          value,
          settlement.roundId,
          settlement.settledAt,
          JSON.stringify(settlement.metadata),
        );
      personalBests.push({
        metricId,
        metricLabel,
        value,
        previousValue: personal?.value ?? null,
      });
    }
    const seasonRecord = database
      .prepare(
        "SELECT * FROM season_game_records WHERE season_id=? AND game_id=? AND metric_id=?",
      )
      .get(season.id, settlement.gameId, metricId);
    if (!seasonRecord || value > seasonRecord.value) {
      database
        .prepare(
          `INSERT INTO season_game_records(season_id,game_id,metric_id,metric_label,user_id,value,round_id,achieved_at,previous_user_id,previous_value)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(season_id,game_id,metric_id) DO UPDATE SET metric_label=excluded.metric_label,user_id=excluded.user_id,
        value=excluded.value,round_id=excluded.round_id,achieved_at=excluded.achieved_at,previous_user_id=excluded.previous_user_id,previous_value=excluded.previous_value`,
        )
        .run(
          season.id,
          settlement.gameId,
          metricId,
          metricLabel,
          settlement.userId,
          value,
          settlement.roundId,
          settlement.settledAt,
          seasonRecord?.user_id ?? null,
          seasonRecord?.value ?? null,
        );
    }
    const current = database
      .prepare("SELECT * FROM game_records WHERE game_id=? AND metric_id=?")
      .get(settlement.gameId, metricId);
    if (current && value <= current.value) continue;
    database
      .prepare(
        `INSERT INTO game_records(game_id,metric_id,metric_label,user_id,value,round_id,achieved_at,previous_user_id,previous_value)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(game_id,metric_id) DO UPDATE SET metric_label=excluded.metric_label,user_id=excluded.user_id,value=excluded.value,round_id=excluded.round_id,achieved_at=excluded.achieved_at,previous_user_id=excluded.previous_user_id,previous_value=excluded.previous_value`,
      )
      .run(
        settlement.gameId,
        metricId,
        metricLabel,
        settlement.userId,
        value,
        settlement.roundId,
        settlement.settledAt,
        current?.user_id ?? null,
        current?.value ?? null,
      );
    database
      .prepare(
        "INSERT INTO game_record_history(id,game_id,metric_id,user_id,value,round_id,previous_user_id,previous_value,achieved_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        idFor(settlement.eventId, metricId),
        settlement.gameId,
        metricId,
        settlement.userId,
        value,
        settlement.roundId,
        current?.user_id ?? null,
        current?.value ?? null,
        settlement.settledAt,
      );
    database
      .prepare(
        "UPDATE player_careers SET fame=fame+25,records_broken=records_broken+1,updated_at=? WHERE user_id=?",
      )
      .run(settlement.settledAt, settlement.userId);
    addSeason(
      database,
      season.id,
      settlement.userId,
      { points: config.scoring.casinoRecord, records: 1 },
      settlement.settledAt,
    );
    emitActivity(database, {
      type: "new-record",
      severity: value >= 100 ? "legendary" : "important",
      title: "YENİ CASINO REKORU",
      message: `${displayName(database, settlement.userId)}, ${META_SYSTEM_CONFIG.games[settlement.gameId]?.label ?? settlement.gameId} oyununda ${metricLabel.toLocaleLowerCase("tr-TR")} rekorunu ${Number(value).toLocaleString("tr-TR")} yaptı.`,
      userId: settlement.userId,
      gameId: settlement.gameId,
      entityId: `${settlement.gameId}:${metricId}`,
      occurredAt: settlement.settledAt,
      metadata: {
        value,
        previousValue: current?.value ?? null,
        previousUserId: current?.user_id ?? null,
      },
    });
    if (current?.user_id && current.user_id !== settlement.userId)
      emitActivity(database, {
        type: "record-lost",
        severity: "important",
        title: "REKOR EL DEĞİŞTİRDİ",
        message: `${displayName(database, current.user_id)} rekorunu ${displayName(database, settlement.userId)} kırdı: ${Number(value).toLocaleString("tr-TR")}.`,
        userId: current.user_id,
        gameId: settlement.gameId,
        entityId: `${settlement.gameId}:${metricId}:${settlement.eventId}`,
        occurredAt: settlement.settledAt,
        metadata: {
          newUserId: settlement.userId,
          value,
          previousValue: current.value,
        },
      });
    newRecords += 1;
  }
  return { newRecords, personalBests };
}

function updateMasteryAndPassport(database, settlement) {
  const config = getCompetitionConfig(database);
  const qualityXp = Math.min(100, Math.floor(settlement.multiplier));
  const xp = 5 + qualityXp + (settlement.outcome === "win" ? 5 : 0);
  const current = database
    .prepare(
      "SELECT xp,tier FROM player_game_mastery WHERE user_id=? AND game_id=?",
    )
    .get(settlement.userId, settlement.gameId);
  const nextXp = Number(current?.xp ?? 0) + xp;
  const tier = masteryTier(nextXp, config.mastery);
  database
    .prepare(
      `INSERT INTO player_game_mastery(user_id,game_id,xp,tier,rounds,best_multiplier,updated_at)
    VALUES(?,?,?,?,1,?,?) ON CONFLICT(user_id,game_id) DO UPDATE SET xp=excluded.xp,tier=excluded.tier,rounds=rounds+1,best_multiplier=MAX(best_multiplier,excluded.best_multiplier),updated_at=excluded.updated_at`,
    )
    .run(
      settlement.userId,
      settlement.gameId,
      nextXp,
      tier,
      settlement.multiplier,
      settlement.settledAt,
    );
  if (current && current.tier !== tier)
    emitActivity(database, {
      type: "mastery-tier",
      severity: ["Diamond", "Legendary"].includes(tier)
        ? "legendary"
        : "important",
      title: "OYUN USTALIĞI",
      message: `${displayName(database, settlement.userId)}, ${META_SYSTEM_CONFIG.games[settlement.gameId]?.label ?? settlement.gameId} oyununda ${tier} seviyesine çıktı.`,
      userId: settlement.userId,
      gameId: settlement.gameId,
      entityId: tier,
      occurredAt: settlement.settledAt,
    });
  const insert = database.prepare(
    "INSERT INTO passport_progress(user_id,game_id,goal_id,label,achieved_at,round_id) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,game_id,goal_id) DO NOTHING",
  );
  for (const [goalId, label, threshold] of PASSPORT_GOALS)
    if (goalId === "first-round" || settlement.multiplier >= threshold)
      insert.run(
        settlement.userId,
        settlement.gameId,
        goalId,
        label,
        settlement.settledAt,
        settlement.roundId,
      );
}

export function processCompetitionSettlement(database, settlement) {
  if (!settlement.competitiveEligible) return { processed: false };
  const config = getCompetitionConfig(database);
  if (config.eligibility.excludedUserIds.includes(settlement.userId))
    return { processed: false, reason: "excluded-user" };
  const accepted = database
    .prepare(
      "INSERT INTO competition_processed_settlements(event_id,processed_at) VALUES(?,?) ON CONFLICT(event_id) DO NOTHING",
    )
    .run(settlement.eventId, now());
  if (!accepted.changes) return { processed: false };
  ensureCareer(database, settlement.userId, settlement.settledAt);
  const season = ensureSeason(database, settlement.settledAt);
  const hadSeasonScore = Boolean(
    database
      .prepare("SELECT 1 FROM season_scores WHERE season_id=? AND user_id=?")
      .get(season.id, settlement.userId),
  );
  const previousSeasonRank =
    leaderboard(database, "season", settlement.userId, season).self?.rank ??
    null;
  // Ordinary wins and wager volume do not score. Only meaningful 5×+ results,
  // records and one-time achievements move the season race.
  const basePoints =
    settlement.multiplier >= 100
      ? config.scoring.hundredX
      : settlement.multiplier >= 25
        ? config.scoring.twentyFiveX
        : settlement.multiplier >= 10
          ? config.scoring.tenX
          : settlement.multiplier >= 5
            ? config.scoring.fiveX
            : 0;
  addSeason(
    database,
    season.id,
    settlement.userId,
    {
      points: basePoints,
      netMicro: settlement.netMicro,
      rounds: 1,
      wins: settlement.outcome === "win" ? 1 : 0,
    },
    settlement.settledAt,
  );
  updateHouseEvent(database, settlement);
  updateMasteryAndPassport(database, settlement);
  const records = processRecords(database, season, settlement);
  evaluateSettlementAchievements(database, season, settlement, config);
  if (
    config.feed.enabled &&
    settlement.multiplier >= config.feed.bigHitMultiplier
  ) {
    emitActivity(database, {
      id: idFor("big-hit", settlement.eventId),
      type: "big-hit",
      severity:
        settlement.multiplier >= config.feed.legendaryHitMultiplier
          ? "legendary"
          : "important",
      title: "BÜYÜK VURUŞ",
      message: `${displayName(database, settlement.userId)}, ${META_SYSTEM_CONFIG.games[settlement.gameId]?.label ?? settlement.gameId} oyununda ${Number(settlement.multiplier).toLocaleString("tr-TR")}× vurdu.`,
      userId: settlement.userId,
      gameId: settlement.gameId,
      entityId: settlement.roundId,
      occurredAt: settlement.settledAt,
      metadata: {
        multiplier: settlement.multiplier,
        payout: toPR(settlement.payoutMicro),
      },
    });
  }
  const winningStreak = Math.floor(finite(config.feed.winningStreak));
  if (config.feed.enabled && winningStreak >= 2) {
    const recentOutcomes = database
      .prepare(
        `SELECT outcome FROM meta_round_settlements
        WHERE user_id=? AND competitive_eligible=1 AND invalidated_at IS NULL
        ORDER BY settled_at DESC,event_id DESC LIMIT ?`,
      )
      .all(settlement.userId, winningStreak + 1);
    const reachedNow =
      recentOutcomes.length >= winningStreak &&
      recentOutcomes
        .slice(0, winningStreak)
        .every((round) => round.outcome === "win") &&
      recentOutcomes[winningStreak]?.outcome !== "win";
    if (reachedNow)
      emitActivity(database, {
        id: idFor("winning-streak", settlement.eventId),
        type: "winning-streak",
        severity: winningStreak >= 10 ? "legendary" : "important",
        title: "MASA SERİSİ",
        message: `${displayName(database, settlement.userId)} üst üste ${winningStreak} geçerli tur kazandı.`,
        userId: settlement.userId,
        gameId: settlement.gameId,
        entityId: settlement.roundId,
        occurredAt: settlement.settledAt,
        metadata: { winningStreak },
      });
  }
  const achievements = database
    .prepare(
      `SELECT d.id,d.name,d.rarity FROM user_achievements ua JOIN achievement_definitions d ON d.id=ua.achievement_id
    WHERE ua.user_id=? AND ua.round_id=? ORDER BY ua.unlocked_at`,
    )
    .all(settlement.userId, settlement.roundId);
  const clubSignal = processClubSettlement(database, settlement);
  const currentWeekKey = competitionWeekKey(database);
  const isCurrentWeek =
    competitionWeekKey(database, settlement.settledAt) === currentWeekKey;
  const rivalry = isCurrentWeek
    ? ensureRival(database, settlement.userId, season)
    : null;
  const rivalGap = rivalry?.rival
    ? (rivalry.player?.weeklyProfit ?? 0) - rivalry.rival.weeklyProfit
    : null;
  const previousGap =
    rivalGap === null ? null : rivalGap - toPR(settlement.netMicro);
  if (previousGap !== null && previousGap <= 0 && rivalGap > 0) {
    emitActivity(database, {
      id: idFor("rival-overtake", currentWeekKey, settlement.userId),
      type: "rival-overtake",
      severity: "important",
      title: "RAKİBİNİ GEÇTİ",
      message: `${displayName(database, settlement.userId)}, haftalık rakibi ${rivalry.rival.displayName} önünde.`,
      userId: settlement.userId,
      entityId: `${currentWeekKey}:${settlement.userId}:overtake`,
      occurredAt: settlement.settledAt,
      metadata: { rivalId: rivalry.rival.userId, gap: rivalGap },
    });
  }
  const seasonRank =
    leaderboard(database, "season", settlement.userId, season).self?.rank ??
    null;
  if (
    seasonRank !== null &&
    seasonRank <= 3 &&
    (!hadSeasonScore || previousSeasonRank === null || previousSeasonRank > 3)
  )
    emitActivity(database, {
      id: idFor("season-top-three", season.id, settlement.userId),
      type: "season-top-three",
      severity: "important",
      title: "SEZON ZİRVESİNE GİRDİ",
      message: `${displayName(database, settlement.userId)} sezon sıralamasında #${seasonRank} koltuğuna çıktı.`,
      userId: settlement.userId,
      entityId: `${season.id}:${settlement.userId}`,
      occurredAt: settlement.settledAt,
      metadata: { seasonId: season.id, rank: seasonRank },
    });
  const signals = [
    ...(settlement.netMicro > 0 &&
    (settlement.multiplier >= 5 || records.newRecords || achievements.length)
      ? [
          {
            type: "round-summary",
            gameId: settlement.gameId,
            net: toPR(settlement.netMicro),
            seasonRank,
            previousSeasonRank,
            rivalGap,
          },
        ]
      : []),
    ...records.personalBests.map((item) => ({
      type: "personal-best",
      gameId: settlement.gameId,
      ...item,
    })),
    ...(records.newRecords
      ? [
          {
            type: "casino-record",
            gameId: settlement.gameId,
            count: records.newRecords,
          },
        ]
      : []),
    ...achievements.map((item) => ({ type: "achievement", ...item })),
    ...(clubSignal ? [clubSignal] : []),
  ];
  return { processed: true, records: records.newRecords, signals };
}

function reconcileCrown(database, at = now()) {
  const excluded = new Set(
    getCompetitionConfig(database).eligibility.excludedUserIds,
  );
  const leader = database
    .prepare(
      `SELECT a.user_id,CAST(a.competitive_balance_micro AS REAL) competitive_balance_micro FROM meta_player_accounts a JOIN users u ON u.id=a.user_id
    WHERE u.status='active' ORDER BY a.competitive_balance_micro DESC,a.user_id`,
    )
    .all()
    .find((row) => !excluded.has(row.user_id));
  const current = database
    .prepare(
      "SELECT id,user_id,acquired_at,released_at,CAST(acquired_balance_micro AS REAL) acquired_balance_micro,CAST(released_balance_micro AS REAL) released_balance_micro FROM crown_reigns WHERE released_at IS NULL ORDER BY acquired_at DESC LIMIT 1",
    )
    .get();
  if (!leader || current?.user_id === leader.user_id) return current;
  if (current) {
    database
      .prepare(
        "UPDATE crown_reigns SET released_at=?,released_balance_micro=? WHERE id=?",
      )
      .run(
        at,
        database
          .prepare(
            "SELECT CAST(competitive_balance_micro AS REAL) competitive_balance_micro FROM meta_player_accounts WHERE user_id=?",
          )
          .get(current.user_id)?.competitive_balance_micro ?? 0,
        current.id,
      );
  }
  const id = `crown-${idFor(leader.user_id, at)}`;
  database
    .prepare(
      "INSERT INTO crown_reigns(id,user_id,acquired_at,acquired_balance_micro) VALUES(?,?,?,?)",
    )
    .run(id, leader.user_id, at, leader.competitive_balance_micro);
  emitActivity(database, {
    type: "crown-gained",
    severity: "legendary",
    title: "KASA TACI EL DEĞİŞTİRDİ",
    message: `${displayName(database, leader.user_id)} artık Casino’nun Kasa Patronu.`,
    userId: leader.user_id,
    entityId: id,
    occurredAt: at,
    metadata: { balance: toPR(leader.competitive_balance_micro) },
  });
  return database
    .prepare(
      "SELECT id,user_id,acquired_at,released_at,CAST(acquired_balance_micro AS REAL) acquired_balance_micro,CAST(released_balance_micro AS REAL) released_balance_micro FROM crown_reigns WHERE id=?",
    )
    .get(id);
}

function evaluateWalletAchievements(database, userId, at) {
  ensureCareer(database, userId, at);
  const season = ensureSeason(database, at);
  const account = database
    .prepare(
      "SELECT user_id,CAST(starting_balance_micro AS REAL) starting_balance_micro,CAST(competitive_balance_micro AS REAL) competitive_balance_micro,CAST(peak_competitive_balance_micro AS REAL) peak_competitive_balance_micro FROM meta_player_accounts WHERE user_id=?",
    )
    .get(userId);
  const config = getCompetitionConfig(database);
  if (!account) return;
  if (config.eligibility.excludedUserIds.includes(userId)) return;
  const balance = toPR(account.competitive_balance_micro);
  for (const milestone of config.milestones) {
    const threshold = finite(milestone.value),
      titleId = String(milestone.titleId ?? "");
    if (balance >= threshold) {
      const unlocked = awardTitle(
        database,
        userId,
        titleId,
        `milestone:${threshold}`,
        at,
      );
      if (unlocked)
        emitActivity(database, {
          type: "wealth-milestone",
          severity: threshold >= 10_000_000 ? "legendary" : "important",
          title: "KASA BARAJI GEÇİLDİ",
          message: `${displayName(database, userId)} ${threshold.toLocaleString("tr-TR")} PR barajını geçti: ${titleById.get(titleId)?.name}.`,
          userId,
          entityId: String(threshold),
          occurredAt: at,
        });
    }
  }
  if (balance >= 1_000_000)
    awardAchievement(
      database,
      season,
      userId,
      "milyoner",
      null,
      { balance },
      at,
    );
  if (
    account.starting_balance_micro > 0 &&
    account.competitive_balance_micro >= account.starting_balance_micro * 10
  )
    awardAchievement(
      database,
      season,
      userId,
      "ten-bagger",
      null,
      { balance },
      at,
    );
  const career = database
    .prepare(
      `SELECT user_id,fame,active_title_id,championships,records_broken,
      CAST(comeback_anchor_micro AS REAL) comeback_anchor_micro,
      CAST(comeback_trough_micro AS REAL) comeback_trough_micro,created_at,updated_at
      FROM player_careers WHERE user_id=?`,
    )
    .get(userId);
  const peak = Number(account.peak_competitive_balance_micro);
  let anchor = career.comeback_anchor_micro,
    trough = career.comeback_trough_micro;
  if (
    !anchor &&
    peak > 0 &&
    account.competitive_balance_micro <=
      peak * config.thresholds.comebackDropRatio
  ) {
    anchor = peak;
    trough = account.competitive_balance_micro;
  } else if (anchor)
    trough = Math.min(
      Number(trough ?? account.competitive_balance_micro),
      Number(account.competitive_balance_micro),
    );
  if (anchor && account.competitive_balance_micro >= anchor) {
    awardAchievement(
      database,
      season,
      userId,
      "geri-donus",
      null,
      { anchor: toPR(anchor), trough: toPR(trough) },
      at,
    );
    anchor = null;
    trough = null;
  }
  database
    .prepare(
      "UPDATE player_careers SET comeback_anchor_micro=?,comeback_trough_micro=?,updated_at=? WHERE user_id=?",
    )
    .run(anchor ?? null, trough ?? null, at, userId);
}

export function onCompetitiveWalletUpdated(database, userId, at = now()) {
  const account = database
    .prepare(
      "SELECT CAST(competitive_balance_micro AS REAL) competitive_balance_micro FROM meta_player_accounts WHERE user_id=?",
    )
    .get(userId);
  if (!account) return [];
  const value = Number(account.competitive_balance_micro),
    date = at.slice(0, 10);
  const previousHigh = database
    .prepare(
      "SELECT MAX(CAST(high_micro AS REAL)) highMicro FROM bankroll_snapshots WHERE user_id=?",
    )
    .get(userId)?.highMicro;
  database
    .prepare(
      `INSERT INTO bankroll_snapshots(user_id,snapshot_date,open_micro,low_micro,high_micro,close_micro,updated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,snapshot_date) DO UPDATE SET low_micro=MIN(low_micro,excluded.close_micro),high_micro=MAX(high_micro,excluded.close_micro),close_micro=excluded.close_micro,updated_at=excluded.updated_at`,
    )
    .run(userId, date, value, value, value, value, at);
  evaluateWalletAchievements(database, userId, at);
  reconcileCrown(database, at);
  return previousHigh != null && value > Number(previousHigh)
    ? [
        {
          type: "personal-best",
          gameId: "casino",
          metricId: "peak-bankroll",
          metricLabel: "Peak bankroll",
          value: toPR(value),
          previousValue: toPR(previousHigh),
        },
      ]
    : [];
}

function leaderboard(database, category, userId, season) {
  let source,
    valueType = "PR";
  if (category === "wealth")
    source = `SELECT u.id userId,u.display_name displayName,CAST(a.competitive_balance_micro AS REAL) score,c.active_title_id titleId FROM users u JOIN meta_player_accounts a ON a.user_id=u.id LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
  else if (category === "profit")
    source = `SELECT u.id userId,u.display_name displayName,CAST(COALESCE(s.net_micro,0) AS REAL) score,c.active_title_id titleId FROM users u LEFT JOIN game_stat_aggregates s ON s.user_id=u.id AND s.period_type='lifetime' AND s.period_key='all' AND s.scope_type='casino' AND s.scope_id='*' LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
  else if (category === "weekly")
    source = `SELECT u.id userId,u.display_name displayName,CAST(COALESCE(s.net_micro,0) AS REAL) score,c.active_title_id titleId FROM users u LEFT JOIN game_stat_aggregates s ON s.user_id=u.id AND s.period_type='week' AND s.period_key='${competitionWeekKey(database)}' AND s.scope_type='casino' AND s.scope_id='*' LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
  else if (category === "seasonProfit")
    source = `SELECT u.id userId,u.display_name displayName,CAST(COALESCE(s.net_profit_micro,0) AS REAL) score,c.active_title_id titleId FROM users u LEFT JOIN season_scores s ON s.user_id=u.id AND s.season_id='${season.id.replaceAll("'", "''")}' LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
  else if (category === "growth") {
    source = `SELECT u.id userId,u.display_name displayName,CASE WHEN a.starting_balance_micro>0 THEN CAST(a.competitive_balance_micro AS REAL)/a.starting_balance_micro ELSE 0 END score,c.active_title_id titleId FROM users u JOIN meta_player_accounts a ON a.user_id=u.id LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
    valueType = "RATIO";
  } else if (category === "crown") {
    source = `SELECT u.id userId,u.display_name displayName,COALESCE(SUM((julianday(COALESCE(r.released_at,'${now()}'))-julianday(r.acquired_at))*86400),0) score,c.active_title_id titleId FROM users u LEFT JOIN crown_reigns r ON r.user_id=u.id LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active' GROUP BY u.id`;
    valueType = "DURATION";
  } else if (category === "season") {
    source = `SELECT u.id userId,u.display_name displayName,CAST(COALESCE(s.season_points,0) AS REAL) score,c.active_title_id titleId FROM users u LEFT JOIN season_scores s ON s.user_id=u.id AND s.season_id='${season.id.replaceAll("'", "''")}' LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
    valueType = "POINT";
  } else {
    source = `SELECT u.id userId,u.display_name displayName,COALESCE(c.fame,0) score,c.active_title_id titleId FROM users u LEFT JOIN player_careers c ON c.user_id=u.id WHERE u.status='active'`;
    valueType = "FAME";
  }
  const excluded = getCompetitionConfig(database).eligibility.excludedUserIds;
  const excludedSql = excluded.length
    ? excluded.map((id) => `'${String(id).replaceAll("'", "''")}'`).join(",")
    : "";
  const eligibleSource = excludedSql
    ? `SELECT * FROM (${source}) WHERE userId NOT IN (${excludedSql})`
    : source;
  const rows = database
    .prepare(
      `WITH ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY score DESC,userId) rank FROM (${eligibleSource})) SELECT * FROM ranked ORDER BY rank`,
    )
    .all();
  const mapped = rows.map((row) => ({
    ...row,
    score: valueType === "PR" ? toPR(row.score) : Number(row.score),
    valueType,
    title: titleById.get(row.titleId)?.name ?? null,
  }));
  const self = mapped.find((row) => row.userId === userId);
  const around = self
    ? mapped.filter((row) => Math.abs(row.rank - self.rank) <= 1)
    : [];
  return { top: mapped.slice(0, 10), self, around };
}

function finalizeRivalries(database, currentWeek, season, at = now()) {
  const config = getCompetitionConfig(database);
  const rows = database
    .prepare(
      `SELECT r.* FROM rivalries r LEFT JOIN rival_results x ON x.week_key=r.week_key AND x.user_id=r.user_id
    WHERE r.week_key<? AND x.user_id IS NULL ORDER BY r.week_key,r.user_id`,
    )
    .all(currentWeek);
  for (const row of rows) {
    const values = database
      .prepare(
        `SELECT u.id,CAST(COALESCE(a.net_micro,0) AS REAL) net_micro FROM users u LEFT JOIN game_stat_aggregates a
      ON a.user_id=u.id AND a.period_type='week' AND a.period_key=? AND a.scope_type='casino' AND a.scope_id='*' WHERE u.id IN (?,?)`,
      )
      .all(row.week_key, row.user_id, row.rival_user_id);
    const player = Number(
        values.find((item) => item.id === row.user_id)?.net_micro ?? 0,
      ),
      rival = Number(
        values.find((item) => item.id === row.rival_user_id)?.net_micro ?? 0,
      );
    const result = player === rival ? "draw" : player > rival ? "win" : "loss",
      points = result === "win" ? finite(config.scoring.rivalVictory) : 0,
      fame = result === "win" ? finite(config.scoring.rivalFame) : 0;
    database
      .prepare(
        `INSERT INTO rival_results(week_key,user_id,rival_user_id,player_profit_micro,rival_profit_micro,result,season_points,fame,finalized_at)
      VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        row.week_key,
        row.user_id,
        row.rival_user_id,
        player,
        rival,
        result,
        points,
        fame,
        at,
      );
    if (result === "win") {
      addSeason(database, season.id, row.user_id, { points }, at);
      database
        .prepare(
          "UPDATE player_careers SET fame=fame+?,updated_at=? WHERE user_id=?",
        )
        .run(fame, at, row.user_id);
      emitActivity(database, {
        type: "rival-victory",
        severity: "important",
        title: "HAFTALIK HESAP KAPANDI",
        message: `${displayName(database, row.user_id)}, haftalık rakibi ${displayName(database, row.rival_user_id)} karşısında hesabı kazandı.`,
        userId: row.user_id,
        entityId: `${row.week_key}:${row.user_id}`,
        occurredAt: at,
        metadata: { points, fame },
      });
    }
  }
}

function ensureRival(database, userId, season) {
  const weekKey = competitionWeekKey(database);
  finalizeRivalries(database, weekKey, season);
  let row = database
    .prepare(
      "SELECT rival_user_id FROM rivalries WHERE week_key=? AND user_id=?",
    )
    .get(weekKey, userId);
  if (!row) {
    const wealth = leaderboard(database, "wealth", userId, season).top;
    const all = database
      .prepare(
        `SELECT a.user_id FROM meta_player_accounts a JOIN users u ON u.id=a.user_id WHERE u.status='active' ORDER BY a.competitive_balance_micro DESC,a.user_id`,
      )
      .all();
    const index = all.findIndex((item) => item.user_id === userId);
    const rival = all[index > 0 ? index - 1 : index + 1];
    if (!rival) return null;
    database
      .prepare(
        "INSERT INTO rivalries(week_key,user_id,rival_user_id,assigned_at) VALUES(?,?,?,?)",
      )
      .run(weekKey, userId, rival.user_id, now());
    row = { rival_user_id: rival.user_id };
    void wealth;
  }
  const details = database
    .prepare(
      `SELECT u.id userId,u.display_name displayName,CAST(a.competitive_balance_micro AS REAL) balanceMicro,
    CAST(COALESCE(w.net_micro,0) AS REAL) weeklyNetMicro,COALESCE(s.season_points,0) seasonPoints
    FROM users u JOIN meta_player_accounts a ON a.user_id=u.id
    LEFT JOIN game_stat_aggregates w ON w.user_id=u.id AND w.period_type='week' AND w.period_key=? AND w.scope_type='casino' AND w.scope_id='*'
    LEFT JOIN season_scores s ON s.user_id=u.id AND s.season_id=? WHERE u.id IN (?,?)`,
    )
    .all(weekKey, season.id, userId, row.rival_user_id)
    .map((item) => ({
      ...item,
      balance: toPR(item.balanceMicro),
      weeklyProfit: toPR(item.weeklyNetMicro),
    }));
  return {
    weekKey,
    player: details.find((item) => item.userId === userId),
    rival: details.find((item) => item.userId === row.rival_user_id),
  };
}

function profile(database, userId) {
  const user = database
    .prepare(
      "SELECT id,username_display username,display_name displayName,role,avatar_id avatarId,created_at createdAt FROM users WHERE id=?",
    )
    .get(userId);
  if (!user) return null;
  const account = database
    .prepare(
      "SELECT user_id,CAST(starting_balance_micro AS REAL) starting_balance_micro,CAST(competitive_balance_micro AS REAL) competitive_balance_micro,CAST(peak_competitive_balance_micro AS REAL) peak_competitive_balance_micro,updated_at FROM meta_player_accounts WHERE user_id=?",
    )
    .get(userId);
  const career = database
    .prepare(
      `SELECT user_id,fame,active_title_id,championships,records_broken,
      CAST(comeback_anchor_micro AS REAL) comeback_anchor_micro,
      CAST(comeback_trough_micro AS REAL) comeback_trough_micro,created_at,updated_at
      FROM player_careers WHERE user_id=?`,
    )
    .get(userId);
  const aggregate = database
    .prepare(
      "SELECT rounds,CAST(net_micro AS REAL) net_micro,CAST(biggest_payout_micro AS REAL) biggest_payout_micro,max_multiplier FROM game_stat_aggregates WHERE user_id=? AND period_type='lifetime' AND period_key='all' AND scope_type='casino' AND scope_id='*'",
    )
    .get(userId);
  const achievements = database
    .prepare(
      `SELECT d.*,ua.unlocked_at unlockedAt FROM achievement_definitions d LEFT JOIN user_achievements ua ON ua.achievement_id=d.id AND ua.user_id=? ORDER BY CASE d.rarity WHEN 'mythic' THEN 5 WHEN 'legendary' THEN 4 WHEN 'epic' THEN 3 WHEN 'rare' THEN 2 ELSE 1 END DESC`,
    )
    .all(userId);
  const mastery = database
    .prepare(
      "SELECT * FROM player_game_mastery WHERE user_id=? ORDER BY xp DESC",
    )
    .all(userId)
    .map((row) => ({
      ...row,
      gameLabel: META_SYSTEM_CONFIG.games[row.game_id]?.label ?? row.game_id,
    }));
  const showcase = database
    .prepare("SELECT * FROM profile_showcase WHERE user_id=? ORDER BY slot")
    .all(userId);
  const titles = database
    .prepare(
      "SELECT title_id titleId,unlocked_at unlockedAt,source FROM user_titles WHERE user_id=? ORDER BY unlocked_at",
    )
    .all(userId)
    .map((row) => ({
      ...row,
      name: titleById.get(row.titleId)?.name ?? row.titleId,
      rarity: titleById.get(row.titleId)?.rarity ?? "common",
    }));
  const favorite = database
    .prepare(
      `SELECT scope_id gameId,rounds FROM game_stat_aggregates WHERE user_id=? AND period_type='lifetime' AND period_key='all'
    AND scope_type='game' ORDER BY rounds DESC,scope_id LIMIT 1`,
    )
    .get(userId);
  const crown = database
    .prepare(
      `SELECT COALESCE(SUM((julianday(COALESCE(released_at,?))-julianday(acquired_at))*86400),0) totalSeconds,
    COALESCE(MAX((julianday(COALESCE(released_at,?))-julianday(acquired_at))*86400),0) longestSeconds,COUNT(*) reigns FROM crown_reigns WHERE user_id=?`,
    )
    .get(now(), now(), userId);
  const showcaseCatalog = [
    ...achievements
      .filter((item) => item.unlockedAt)
      .map((item) => ({
        itemType: "achievement",
        itemId: item.id,
        label: item.name,
        detail: item.rarity,
      })),
    ...titles.map((item) => ({
      itemType: "title",
      itemId: item.titleId,
      label: item.name,
      detail: item.rarity,
    })),
    ...mastery
      .filter((item) => item.tier !== "Bronze")
      .map((item) => ({
        itemType: "mastery",
        itemId: item.game_id,
        label: `${item.gameLabel} ${item.tier}`,
        detail: "ustalık",
      })),
  ];
  const resolvedShowcase = showcase
    .map((selected) => ({
      ...selected,
      item:
        showcaseCatalog.find(
          (item) =>
            item.itemType === selected.item_type &&
            item.itemId === selected.item_id,
        ) ?? null,
    }))
    .filter((selected) => selected.item);
  const ownedRecords = database
    .prepare(
      "SELECT game_id gameId,metric_id metricId,metric_label metricLabel,value,achieved_at achievedAt FROM game_records WHERE user_id=? ORDER BY achieved_at DESC",
    )
    .all(userId)
    .map((row) => ({
      ...row,
      gameLabel: META_SYSTEM_CONFIG.games[row.gameId]?.label ?? row.gameId,
    }));
  const seasonHistory = database
    .prepare(
      `SELECT sr.rank,sr.season_points seasonPoints,CAST(sr.net_profit_micro AS REAL) netProfitMicro,s.name,s.ends_at endsAt
    FROM season_results sr JOIN seasons s ON s.id=sr.season_id WHERE sr.user_id=? ORDER BY s.starts_at DESC`,
    )
    .all(userId)
    .map((row) => ({ ...row, netProfit: toPR(row.netProfitMicro) }));
  const multiplayer = database
    .prepare(
      `SELECT game_id gameId,rating,wins,losses,draws,tournament_wins tournamentWins,final_tables finalTables,
    heads_up_wins headsUpWins,CAST(largest_pot_micro AS REAL) largestPotMicro,best_hand bestHand FROM multiplayer_ratings WHERE user_id=? ORDER BY rating DESC`,
    )
    .all(userId)
    .map((row) => ({ ...row, largestPot: toPR(row.largestPotMicro) }));
  return {
    user,
    account: account
      ? {
          startingBalance: toPR(account.starting_balance_micro),
          competitiveBalance: toPR(account.competitive_balance_micro),
          peakBalance: toPR(account.peak_competitive_balance_micro),
          growth:
            account.starting_balance_micro > 0
              ? Number(account.competitive_balance_micro) /
                Number(account.starting_balance_micro)
              : 0,
        }
      : null,
    career: {
      fame: Number(career?.fame ?? 0),
      titleId: career?.active_title_id ?? null,
      title: titleById.get(career?.active_title_id)?.name ?? null,
      championships: Number(career?.championships ?? 0),
      recordsBroken: Number(career?.records_broken ?? 0),
    },
    stats: {
      rounds: Number(aggregate?.rounds ?? 0),
      netProfit: toPR(aggregate?.net_micro),
      biggestPayout: toPR(aggregate?.biggest_payout_micro),
      maxMultiplier: finite(aggregate?.max_multiplier),
      favoriteGameId: favorite?.gameId ?? null,
      favoriteGame: META_SYSTEM_CONFIG.games[favorite?.gameId]?.label ?? null,
    },
    achievements,
    mastery,
    showcase: resolvedShowcase,
    showcaseCatalog,
    titles,
    recordsOwned: ownedRecords.length,
    ownedRecords,
    seasonHistory,
    multiplayer,
    crown: {
      totalSeconds: finite(crown?.totalSeconds),
      longestSeconds: finite(crown?.longestSeconds),
      reigns: Number(crown?.reigns ?? 0),
    },
  };
}

function hallOfFame(database) {
  const timestamp = now();
  const champions = database
    .prepare(
      `SELECT sr.season_id,sr.user_id,sr.rank,sr.season_points,CAST(sr.net_profit_micro AS REAL) net_profit_micro,sr.recorded_at,s.name seasonName,u.display_name displayName FROM season_results sr JOIN seasons s ON s.id=sr.season_id JOIN users u ON u.id=sr.user_id ORDER BY s.starts_at DESC,sr.rank LIMIT 30`,
    )
    .all()
    .map((row) => ({ ...row, netProfit: toPR(row.net_profit_micro) }));
  const crown = database
    .prepare(
      `SELECT u.id userId,u.display_name displayName,COALESCE(SUM((julianday(COALESCE(r.released_at,?))-julianday(r.acquired_at))*86400),0) totalSeconds,
    COALESCE(MAX((julianday(COALESCE(r.released_at,?))-julianday(r.acquired_at))*86400),0) longestSeconds,COUNT(r.id) reigns FROM users u LEFT JOIN crown_reigns r ON r.user_id=u.id GROUP BY u.id ORDER BY totalSeconds DESC LIMIT 10`,
    )
    .all(timestamp, timestamp);
  const fame = database
    .prepare(
      `SELECT u.id userId,u.display_name displayName,c.fame score FROM player_careers c JOIN users u ON u.id=c.user_id ORDER BY c.fame DESC LIMIT 10`,
    )
    .all();
  const recordHolders = database
    .prepare(
      `SELECT u.id userId,u.display_name displayName,COUNT(*) score FROM game_records r JOIN users u ON u.id=r.user_id GROUP BY u.id ORDER BY score DESC LIMIT 10`,
    )
    .all();
  const biggestWin = database
    .prepare(
      `SELECT r.user_id userId,u.display_name displayName,CAST(r.payout_micro AS REAL) payoutMicro,r.multiplier,r.game_id gameId,r.settled_at settledAt FROM meta_round_settlements r JOIN users u ON u.id=r.user_id WHERE r.competitive_eligible=1 AND r.invalidated_at IS NULL ORDER BY r.payout_micro DESC LIMIT 1`,
    )
    .get();
  const highestMultiplier = database
    .prepare(
      `SELECT r.user_id userId,u.display_name displayName,r.multiplier,r.game_id gameId,r.settled_at settledAt FROM meta_round_settlements r JOIN users u ON u.id=r.user_id WHERE r.competitive_eligible=1 AND r.invalidated_at IS NULL ORDER BY r.multiplier DESC LIMIT 1`,
    )
    .get();
  const richestSnapshots = database
    .prepare(
      `WITH ranked AS (SELECT b.snapshot_date snapshotDate,b.user_id userId,u.display_name displayName,CAST(b.close_micro AS REAL) closeMicro,
    ROW_NUMBER() OVER(PARTITION BY b.snapshot_date ORDER BY b.close_micro DESC,b.user_id) rank FROM bankroll_snapshots b JOIN users u ON u.id=b.user_id)
    SELECT * FROM ranked WHERE rank=1 ORDER BY snapshotDate DESC LIMIT 30`,
    )
    .all()
    .map((row) => ({ ...row, balance: toPR(row.closeMicro) }));
  const legendaryAchievements = database
    .prepare(
      `SELECT ua.user_id userId,u.display_name displayName,d.name,d.rarity,ua.unlocked_at unlockedAt
    FROM user_achievements ua JOIN achievement_definitions d ON d.id=ua.achievement_id JOIN users u ON u.id=ua.user_id
    WHERE d.rarity IN ('legendary','mythic') ORDER BY ua.unlocked_at DESC LIMIT 30`,
    )
    .all();
  const comebacks = database
    .prepare(
      `SELECT ua.user_id userId,u.display_name displayName,ua.metadata_json metadataJson,ua.unlocked_at unlockedAt
    FROM user_achievements ua JOIN users u ON u.id=ua.user_id WHERE ua.achievement_id='geri-donus' ORDER BY ua.unlocked_at`,
    )
    .all()
    .map((row) => ({ ...row, ...JSON.parse(row.metadataJson) }));
  const biggestComeback =
    comebacks.sort(
      (a, b) =>
        finite(b.anchor) -
        finite(b.trough) -
        (finite(a.anchor) - finite(a.trough)),
    )[0] ?? null;
  const oldestRecord = database
    .prepare(
      `SELECT r.game_id gameId,r.metric_label metricLabel,r.value,r.achieved_at achievedAt,u.display_name displayName,
    (julianday(?)-julianday(r.achieved_at)) ageDays FROM game_records r JOIN users u ON u.id=r.user_id ORDER BY r.achieved_at LIMIT 1`,
    )
    .get(timestamp);
  const houseHistory = database
    .prepare(
      `SELECT r.event_id eventId,r.players_won playersWon,CAST(r.players_net_micro AS REAL) playersNetMicro,CAST(r.house_net_micro AS REAL) houseNetMicro,r.participants,r.finalized_at finalizedAt,e.name
    FROM house_event_results r JOIN house_events e ON e.id=r.event_id ORDER BY e.starts_at DESC LIMIT 20`,
    )
    .all()
    .map((row) => ({
      ...row,
      playersNet: toPR(row.playersNetMicro),
      houseNet: toPR(row.houseNetMicro),
    }));
  const tournamentChampions = database
    .prepare(
      `SELECT r.tournament_id tournamentId,t.name tournamentName,r.game_id gameId,r.user_id userId,
    u.display_name displayName,r.field_size fieldSize,r.rating_delta ratingDelta,r.recorded_at recordedAt FROM tournament_results r
    JOIN tournaments t ON t.id=r.tournament_id JOIN users u ON u.id=r.user_id WHERE r.placement=1 ORDER BY r.recorded_at DESC LIMIT 30`,
    )
    .all();
  return {
    champions,
    crown,
    fame,
    recordHolders,
    biggestWin: biggestWin
      ? { ...biggestWin, payout: toPR(biggestWin.payoutMicro) }
      : null,
    highestMultiplier,
    richestSnapshots,
    legendaryAchievements,
    biggestComeback,
    oldestRecord,
    houseHistory,
    tournamentChampions,
  };
}

export function getPublicProfile(database, userId, viewerId = userId) {
  const season = ensureSeason(database);
  const publicProfile = profile(database, userId);
  if (!publicProfile) throw new Error("Oyuncu bulunamadı.");
  return {
    profile: publicProfile,
    ranks: {
      wealth: leaderboard(database, "wealth", userId, season).self,
      season: leaderboard(database, "season", userId, season).self,
      career: leaderboard(database, "career", userId, season).self,
    },
    isSelf: userId === viewerId,
  };
}

export function setProfileShowcase(database, userId, items) {
  const ownProfile = profile(database, userId);
  if (!Array.isArray(items) || items.length > 3)
    throw new Error("Vitrinde en fazla üç parça sergilenebilir.");
  const unique = new Set();
  for (const item of items) {
    const key = `${item.itemType}:${item.itemId}`;
    if (
      unique.has(key) ||
      !ownProfile.showcaseCatalog.some(
        (entry) =>
          entry.itemType === item.itemType && entry.itemId === item.itemId,
      )
    )
      throw new Error("Vitrin seçimi geçersiz.");
    unique.add(key);
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare("DELETE FROM profile_showcase WHERE user_id=?")
      .run(userId);
    const insert = database.prepare(
      "INSERT INTO profile_showcase(user_id,slot,item_type,item_id,selected_at) VALUES(?,?,?,?,?)",
    );
    items.forEach((item, index) =>
      insert.run(userId, index + 1, item.itemType, item.itemId, now()),
    );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getCompetitionDashboard(database, userId) {
  const timestamp = now(),
    season = ensureSeason(database, timestamp);
  const runtimeConfig = getCompetitionConfig(database);
  reconcileCrown(database, timestamp);
  const houseEvent = ensureHouseEvent(database, timestamp);
  const currentCrown = database
    .prepare(
      `SELECT r.id,r.user_id,r.acquired_at,r.released_at,CAST(r.acquired_balance_micro AS REAL) acquired_balance_micro,CAST(r.released_balance_micro AS REAL) released_balance_micro,u.display_name displayName FROM crown_reigns r JOIN users u ON u.id=r.user_id WHERE r.released_at IS NULL ORDER BY r.acquired_at DESC LIMIT 1`,
    )
    .get();
  const feed = runtimeConfig.feed.enabled
    ? database
        .prepare(
          `SELECT e.*,u.display_name displayName FROM activity_events e LEFT JOIN users u ON u.id=e.user_id ORDER BY occurred_at DESC LIMIT ?`,
        )
        .all(Math.max(5, Math.min(100, finite(runtimeConfig.feed.limit))))
    : [];
  const records = database
    .prepare(
      `SELECT r.*,u.display_name displayName FROM game_records r JOIN users u ON u.id=r.user_id ORDER BY r.achieved_at DESC LIMIT 50`,
    )
    .all()
    .map((row) => ({
      ...row,
      gameLabel: META_SYSTEM_CONFIG.games[row.game_id]?.label ?? row.game_id,
    }));
  const seasonRecords = database
    .prepare(
      `SELECT r.*,u.display_name displayName FROM season_game_records r JOIN users u ON u.id=r.user_id WHERE r.season_id=? ORDER BY r.achieved_at DESC LIMIT 50`,
    )
    .all(season.id)
    .map((row) => ({
      ...row,
      gameLabel: META_SYSTEM_CONFIG.games[row.game_id]?.label ?? row.game_id,
    }));
  const snapshots = database
    .prepare(
      "SELECT snapshot_date date,CAST(open_micro AS REAL) open_micro,CAST(low_micro AS REAL) low_micro,CAST(high_micro AS REAL) high_micro,CAST(close_micro AS REAL) close_micro FROM bankroll_snapshots WHERE user_id=? ORDER BY snapshot_date DESC LIMIT 60",
    )
    .all(userId)
    .map((row) => ({
      date: row.date,
      open: toPR(row.open_micro),
      low: toPR(row.low_micro),
      high: toPR(row.high_micro),
      close: toPR(row.close_micro),
    }))
    .reverse();
  const passport = database
    .prepare(
      "SELECT game_id gameId,goal_id goalId,label,achieved_at achievedAt FROM passport_progress WHERE user_id=? ORDER BY game_id,achieved_at",
    )
    .all(userId);
  const seasonRanking = leaderboard(database, "season", userId, season);
  const weekly = leaderboard(database, "weekly", userId, season);
  const currentWeekKey = competitionWeekKey(database);
  const weekScanStart = new Date(`${currentWeekKey}T00:00:00.000Z`);
  weekScanStart.setUTCDate(weekScanStart.getUTCDate() - 1);
  const belongsToCurrentWeek = (value) =>
    competitionWeekKey(database, value) === currentWeekKey;
  const excludedIds = new Set(runtimeConfig.eligibility.excludedUserIds);
  const biggestHit = database
    .prepare(
      `SELECT s.user_id userId,u.display_name displayName,s.game_id gameId,
      CAST(s.payout_micro AS REAL) payoutMicro,s.multiplier,s.settled_at settledAt
      FROM meta_round_settlements s JOIN users u ON u.id=s.user_id
      WHERE s.competitive_eligible=1 AND s.invalidated_at IS NULL AND s.settled_at>=?
      ORDER BY s.payout_micro DESC,s.settled_at LIMIT 20`,
    )
    .all(weekScanStart.toISOString())
    .find(
      (row) =>
        belongsToCurrentWeek(row.settledAt) && !excludedIds.has(row.userId),
    );
  const comeback = database
    .prepare(
      `SELECT ua.user_id userId,u.display_name displayName,ua.metadata_json metadataJson,ua.unlocked_at unlockedAt
      FROM user_achievements ua JOIN users u ON u.id=ua.user_id
      WHERE ua.achievement_id='geri-donus' AND ua.unlocked_at>=?
      ORDER BY ua.unlocked_at DESC LIMIT 20`,
    )
    .all(weekScanStart.toISOString())
    .find(
      (row) =>
        belongsToCurrentWeek(row.unlockedAt) && !excludedIds.has(row.userId),
    );
  const closestRace = database
    .prepare(
      `SELECT r.user_id userId,u.display_name displayName,r.rival_user_id rivalUserId,v.display_name rivalName,
      CAST(ABS(COALESCE(a.net_micro,0)-COALESCE(b.net_micro,0)) AS REAL) gapMicro
      FROM rivalries r JOIN users u ON u.id=r.user_id JOIN users v ON v.id=r.rival_user_id
      LEFT JOIN game_stat_aggregates a ON a.user_id=r.user_id AND a.period_type='week' AND a.period_key=r.week_key AND a.scope_type='casino' AND a.scope_id='*'
      LEFT JOIN game_stat_aggregates b ON b.user_id=r.rival_user_id AND b.period_type='week' AND b.period_key=r.week_key AND b.scope_type='casino' AND b.scope_id='*'
      WHERE r.week_key=? ORDER BY gapMicro,r.user_id LIMIT 50`,
    )
    .all(currentWeekKey)
    .find(
      (row) =>
        !excludedIds.has(row.userId) && !excludedIds.has(row.rivalUserId),
    );
  let comebackMetadata = {};
  try {
    comebackMetadata = comeback ? JSON.parse(comeback.metadataJson) : {};
  } catch {
    comebackMetadata = {};
  }
  const hotGame = Object.entries(
    database
      .prepare(
        `SELECT game_id gameId,user_id userId,settled_at settledAt FROM meta_round_settlements
        WHERE competitive_eligible=1 AND invalidated_at IS NULL AND settled_at>=?
        ORDER BY settled_at DESC`,
      )
      .all(weekScanStart.toISOString())
      .filter(
        (row) =>
          belongsToCurrentWeek(row.settledAt) && !excludedIds.has(row.userId),
      )
      .reduce((totals, row) => {
        totals[row.gameId] = (totals[row.gameId] ?? 0) + 1;
        return totals;
      }, {}),
  )
    .map(([gameId, count]) => ({ gameId, count }))
    .sort((a, b) => b.count - a.count)[0];
  const newspaper = {
    weekKey: currentWeekKey,
    richest: leaderboard(database, "wealth", userId, season).top[0] ?? null,
    weeklyWinner: weekly.top[0] ?? null,
    biggestRecord:
      records.find((record) => belongsToCurrentWeek(record.achieved_at)) ??
      null,
    biggestHit: biggestHit
      ? { ...biggestHit, payout: toPR(biggestHit.payoutMicro) }
      : null,
    comeback: comeback
      ? {
          userId: comeback.userId,
          displayName: comeback.displayName,
          anchor: finite(comebackMetadata.anchor),
          trough: finite(comebackMetadata.trough),
          unlockedAt: comeback.unlockedAt,
        }
      : null,
    closestRace: closestRace
      ? { ...closestRace, gap: toPR(closestRace.gapMicro) }
      : null,
    hotGame: hotGame ?? null,
  };
  return {
    generatedAt: timestamp,
    season: {
      ...season,
      remainingMs: Math.max(0, new Date(season.ends_at).getTime() - Date.now()),
    },
    profile: profile(database, userId),
    leaderboards: {
      wealth: leaderboard(database, "wealth", userId, season),
      profit: leaderboard(database, "profit", userId, season),
      seasonProfit: leaderboard(database, "seasonProfit", userId, season),
      weekly,
      growth: leaderboard(database, "growth", userId, season),
      crown: leaderboard(database, "crown", userId, season),
      season: seasonRanking,
      career: leaderboard(database, "career", userId, season),
    },
    crown: currentCrown
      ? { ...currentCrown, balance: toPR(currentCrown.acquired_balance_micro) }
      : null,
    rival: ensureRival(database, userId, season),
    feed,
    records,
    seasonRecords,
    hall: hallOfFame(database),
    houseEvent: {
      id: houseEvent.id,
      name: houseEvent.name,
      startsAt: houseEvent.starts_at,
      endsAt: houseEvent.ends_at,
      playersNet: toPR(houseEvent.players_net_micro),
      houseNet: toPR(houseEvent.house_net_micro),
      eligibleRounds: Number(houseEvent.eligible_rounds),
      remainingMs: Math.max(
        0,
        new Date(houseEvent.ends_at).getTime() - Date.now(),
      ),
    },
    snapshots,
    passport,
    newspaper,
    social: getSocialCompetition(database, userId),
    config: {
      titles: META_SYSTEM_CONFIG.titles,
      games: META_SYSTEM_CONFIG.games,
      passportGoals: PASSPORT_GOALS.map(([id, label]) => ({ id, label })),
      runtime: runtimeConfig,
      future: { clubs: false, multiplayerRatings: false, tournaments: false },
    },
  };
}

export function setActiveTitle(database, userId, titleId) {
  const unlocked = database
    .prepare("SELECT 1 FROM user_titles WHERE user_id=? AND title_id=?")
    .get(userId, titleId);
  if (!unlocked) throw new Error("Bu unvan henüz açılmadı.");
  database
    .prepare(
      "UPDATE player_careers SET active_title_id=?,updated_at=? WHERE user_id=?",
    )
    .run(titleId, now(), userId);
}

function competitionAdminAudit(
  database,
  actorUserId,
  action,
  entityType,
  entityId,
  before,
  after,
  reason,
) {
  database
    .prepare(
      `INSERT INTO competition_admin_audit(id,actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,occurred_at)
    VALUES(?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      `competition-audit-${idFor(actorUserId, action, entityId ?? "", now(), Math.random())}`,
      actorUserId,
      action,
      entityType,
      entityId ?? null,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      reason ?? null,
      now(),
    );
}

const positive = (value, fallback, min = 0, max = 1_000_000) =>
  Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback),
  );

const validTimeZone = (value, fallback) => {
  const timeZone = String(value || fallback);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    throw new Error("Geçerli bir IANA saat dilimi seçilmeli.");
  }
};

export function updateCompetitionConfig(database, actorUserId, payload = {}) {
  const before = getCompetitionConfig(database),
    incoming = mergeCompetitionConfig(payload.config ?? {});
  const validUserIds = new Set(
    database
      .prepare("SELECT id FROM users WHERE status='active'")
      .all()
      .map((row) => row.id),
  );
  const next = {
    ...incoming,
    economy: {
      startingPiar: positive(
        incoming.economy.startingPiar,
        before.economy.startingPiar,
        0,
        1_000_000_000,
      ),
    },
    season: {
      ...incoming.season,
      durationDays: positive(
        incoming.season.durationDays,
        before.season.durationDays,
        1,
        365,
      ),
      nameTemplate: String(
        incoming.season.nameTemplate || before.season.nameTemplate,
      ).slice(0, 100),
    },
    schedule: {
      timeZone: validTimeZone(
        incoming.schedule.timeZone,
        before.schedule.timeZone,
      ),
    },
    scoring: Object.fromEntries(
      Object.entries(incoming.scoring).map(([key, value]) => [
        key,
        positive(value, before.scoring[key] ?? 0, 0, 10_000),
      ]),
    ),
    thresholds: Object.fromEntries(
      Object.entries(incoming.thresholds).map(([key, value]) => [
        key,
        positive(
          value,
          before.thresholds[key] ?? 0,
          key === "comebackDropRatio" ? 0.01 : 0,
          key === "comebackDropRatio" ? 0.95 : 1_000_000,
        ),
      ]),
    ),
    mastery: {
      silver: positive(incoming.mastery.silver, before.mastery.silver, 1),
      gold: positive(incoming.mastery.gold, before.mastery.gold, 1),
      diamond: positive(incoming.mastery.diamond, before.mastery.diamond, 1),
      legendary: positive(
        incoming.mastery.legendary,
        before.mastery.legendary,
        1,
      ),
    },
    milestones: incoming.milestones
      .map((item, index) => ({
        value: positive(
          item.value,
          before.milestones[index]?.value ?? 0,
          1,
          1_000_000_000,
        ),
        titleId: String(
          item.titleId ?? before.milestones[index]?.titleId ?? "",
        ),
      }))
      .sort((a, b) => a.value - b.value),
    eligibility: {
      excludedUserIds: [
        ...new Set(
          incoming.eligibility.excludedUserIds
            .map(String)
            .filter((userId) => validUserIds.has(userId)),
        ),
      ],
    },
    feed: {
      enabled: Boolean(incoming.feed.enabled),
      limit: positive(incoming.feed.limit, before.feed.limit, 5, 100),
      repeatWindowMinutes: positive(
        incoming.feed.repeatWindowMinutes,
        before.feed.repeatWindowMinutes,
        0,
        1440,
      ),
      bigHitMultiplier: positive(
        incoming.feed.bigHitMultiplier,
        before.feed.bigHitMultiplier,
        5,
        1_000_000,
      ),
      legendaryHitMultiplier: positive(
        incoming.feed.legendaryHitMultiplier,
        before.feed.legendaryHitMultiplier,
        5,
        1_000_000,
      ),
      winningStreak: Math.floor(
        positive(
          incoming.feed.winningStreak,
          before.feed.winningStreak,
          2,
          100,
        ),
      ),
    },
  };
  const eligibilityChanged =
    JSON.stringify(before.eligibility.excludedUserIds.slice().sort()) !==
    JSON.stringify(next.eligibility.excludedUserIds.slice().sort());
  const timeZoneChanged = before.schedule.timeZone !== next.schedule.timeZone;
  if (!(
    next.mastery.silver < next.mastery.gold &&
    next.mastery.gold < next.mastery.diamond &&
    next.mastery.diamond < next.mastery.legendary
  ))
    throw new Error("Ustalık eşikleri küçükten büyüğe sıralanmalı.");
  if (!Object.values(next.leaderboards).some(Boolean))
    throw new Error("En az bir leaderboard açık kalmalı.");
  if (next.feed.legendaryHitMultiplier < next.feed.bigHitMultiplier)
    throw new Error("Efsanevi vuruş eşiği büyük vuruş eşiğinden düşük olamaz.");
  const timestamp = now();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `INSERT INTO competition_settings(id,config_json,updated_by,updated_at) VALUES('global',?,?,?)
      ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      )
      .run(JSON.stringify(next), actorUserId, timestamp);
    for (const definition of payload.achievements ?? []) {
      const current = database
        .prepare("SELECT * FROM achievement_definitions WHERE id=?")
        .get(definition.id);
      if (!current) continue;
      database
        .prepare(
          "UPDATE achievement_definitions SET fame=?,season_points=? WHERE id=?",
        )
        .run(
          positive(definition.fame, current.fame, 0, 100_000),
          positive(definition.seasonPoints, current.season_points, 0, 100_000),
          definition.id,
        );
    }
    if (payload.season) {
      const active = database
        .prepare(
          "SELECT * FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1",
        )
        .get();
      if (active) {
        const endsAt = new Date(payload.season.endsAt ?? active.ends_at);
        if (
          Number.isNaN(endsAt.getTime()) ||
          endsAt <= new Date(active.starts_at)
        )
          throw new Error("Sezon bitişi başlangıçtan sonra olmalı.");
        database
          .prepare("UPDATE seasons SET name=?,ends_at=? WHERE id=?")
          .run(
            String(payload.season.name ?? active.name).slice(0, 100),
            endsAt.toISOString(),
            active.id,
          );
      }
    }
    competitionAdminAudit(
      database,
      actorUserId,
      "competition.config.update",
      "competition_settings",
      "global",
      before,
      next,
      payload.reason,
    );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  if (timeZoneChanged) {
    rebuildMetaSystem(database);
    rebuildCompetitionSystem(database);
  } else if (eligibilityChanged) rebuildCompetitionSystem(database);
  return getCompetitionConfig(database);
}

export function invalidateCompetitionSettlement(
  database,
  actorUserId,
  eventId,
  reason,
) {
  const current = database
    .prepare("SELECT source_record_id,invalidated_at FROM meta_round_settlements WHERE event_id=?")
    .get(eventId);
  if (!current) throw new Error("Rekabet sonucu bulunamadı.");
  if (current.invalidated_at)
    throw new Error("Bu sonuç zaten geçersiz kılınmış.");
  if (!String(reason ?? "").trim())
    throw new Error("Geçersiz kılma nedeni zorunlu.");
  const timestamp = now();
  database
    .prepare(
      `INSERT INTO meta_settlement_invalidations(event_id,invalidated_at,invalidated_by,reason,source_record_id)
    VALUES(?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,
    )
    .run(
      eventId,
      timestamp,
      actorUserId,
      String(reason).trim(),
      current.source_record_id,
    );
  database
    .prepare(
      "UPDATE meta_round_settlements SET invalidated_at=?,invalidated_by=?,invalidation_reason=? WHERE event_id=?",
    )
    .run(timestamp, actorUserId, String(reason).trim(), eventId);
  competitionAdminAudit(
    database,
    actorUserId,
    "settlement.invalidate",
    "meta_round_settlement",
    eventId,
    { invalidated: false },
    { invalidated: true },
    reason,
  );
}

export function getCompetitionAdminState(database) {
  const season = ensureSeason(database),
    config = getCompetitionConfig(database);
  finalizeHouseEvents(database);
  finalizeRivalries(database, competitionWeekKey(database), season);
  const achievements = database
    .prepare(
      "SELECT id,name,detail,rarity,fame,season_points seasonPoints,title_id titleId FROM achievement_definitions ORDER BY rarity,id",
    )
    .all();
  const settlements = database
    .prepare(
      `SELECT s.event_id eventId,s.round_id roundId,s.user_id userId,u.display_name displayName,s.game_id gameId,
    s.settled_at settledAt,CAST(s.wager_micro AS REAL) wagerMicro,CAST(s.payout_micro AS REAL) payoutMicro,s.multiplier,s.outcome,s.invalidated_at invalidatedAt,s.invalidation_reason invalidationReason
    FROM meta_round_settlements s JOIN users u ON u.id=s.user_id ORDER BY s.settled_at DESC LIMIT 100`,
    )
    .all()
    .map((row) => ({
      ...row,
      wager: toPR(row.wagerMicro),
      payout: toPR(row.payoutMicro),
    }));
  const houseHistory = database
    .prepare(
      `SELECT r.event_id,r.players_won,CAST(r.players_net_micro AS REAL) players_net_micro,
      CAST(r.house_net_micro AS REAL) house_net_micro,r.participants,r.finalized_at,
      e.name,e.starts_at startsAt,e.ends_at endsAt FROM house_event_results r
      JOIN house_events e ON e.id=r.event_id ORDER BY e.starts_at DESC LIMIT 20`,
    )
    .all()
    .map((row) => ({
      ...row,
      playersNet: toPR(row.players_net_micro),
      houseNet: toPR(row.house_net_micro),
    }));
  const rivalHistory = database
    .prepare(
      `SELECT r.week_key,r.user_id,r.rival_user_id,
      CAST(r.player_profit_micro AS REAL) player_profit_micro,
      CAST(r.rival_profit_micro AS REAL) rival_profit_micro,r.result,r.season_points,r.fame,r.finalized_at,
      u.display_name displayName,v.display_name rivalName FROM rival_results r
      JOIN users u ON u.id=r.user_id JOIN users v ON v.id=r.rival_user_id
      ORDER BY r.week_key DESC LIMIT 50`,
    )
    .all()
    .map((row) => ({
      ...row,
      playerProfit: toPR(row.player_profit_micro),
      rivalProfit: toPR(row.rival_profit_micro),
    }));
  const audit = database
    .prepare(
      "SELECT * FROM competition_admin_audit ORDER BY occurred_at DESC LIMIT 100",
    )
    .all();
  // Seek into each game's time index instead of ranking the entire history.
  const recentTelemetry = database.prepare(
    `SELECT metadata_json metadataJson FROM meta_round_settlements
     WHERE game_id=? AND invalidated_at IS NULL ORDER BY settled_at DESC LIMIT 20`,
  );
  const telemetry = Object.entries(META_SYSTEM_CONFIG.games).map(
    ([gameId, game]) => {
      const rows = recentTelemetry.all(gameId);
      const audits = rows
        .map((row) => {
          try {
            return JSON.parse(row.metadataJson)?.telemetryAudit;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const complete = audits.filter((item) => item.complete === true).length;
      const missing = {};
      for (const item of audits)
        for (const field of Array.isArray(item.missing) ? item.missing : [])
          missing[field] = (missing[field] ?? 0) + 1;
      return {
        gameId,
        label: game.label,
        rounds: rows.length,
        audited: audits.length,
        complete,
        missing: Object.entries(missing)
          .sort((a, b) => b[1] - a[1])
          .map(([field, count]) => ({ field, count })),
        status: !rows.length
          ? "no-data"
          : !audits.length
            ? "legacy"
            : complete === audits.length && audits.length === rows.length
              ? "healthy"
              : "warning",
      };
    },
  );
  const users = database
    .prepare(
      "SELECT id,display_name displayName,role,avatar_id avatarId FROM users WHERE status='active' ORDER BY display_name,id",
    )
    .all();
  return {
    config,
    season,
    achievements,
    settlements,
    houseHistory,
    rivalHistory,
    audit,
    telemetry,
    users,
    defaults: DEFAULT_COMPETITION_CONFIG,
  };
}

export function rebuildCompetitionSystem(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`DELETE FROM competition_processed_settlements;DELETE FROM passport_progress;DELETE FROM player_game_mastery;
      DELETE FROM player_personal_records;DELETE FROM game_record_history;DELETE FROM game_records;DELETE FROM season_game_records;DELETE FROM user_achievements;
      DELETE FROM user_titles;DELETE FROM season_scores;DELETE FROM season_results;DELETE FROM activity_events;DELETE FROM crown_reigns;
      DELETE FROM rival_results;DELETE FROM rivalries;DELETE FROM house_event_results;DELETE FROM house_event_contributions;DELETE FROM house_event_scores;DELETE FROM house_events;UPDATE player_careers SET fame=0,active_title_id=NULL,championships=0,records_broken=0,comeback_anchor_micro=NULL,comeback_trough_micro=NULL;`);
    const settlements = database
      .prepare(
        `SELECT event_id,source_record_id,round_id,user_id,game_id,game_family,settled_at,
        CAST(wager_micro AS REAL) wager_micro,CAST(payout_micro AS REAL) payout_micro,
        CAST(net_micro AS REAL) net_micro,multiplier,outcome,competitive_eligible,
        eligibility_reason,metadata_json,invalidated_at,invalidated_by,invalidation_reason,created_at
        FROM meta_round_settlements WHERE competitive_eligible=1 AND invalidated_at IS NULL
        ORDER BY settled_at,event_id`,
      )
      .all();
    for (const row of settlements)
      processCompetitionSettlement(database, {
        eventId: row.event_id,
        roundId: row.round_id,
        userId: row.user_id,
        gameId: row.game_id,
        gameFamily: row.game_family,
        settledAt: row.settled_at,
        wagerMicro: row.wager_micro,
        payoutMicro: row.payout_micro,
        netMicro: row.net_micro,
        multiplier: row.multiplier,
        outcome: row.outcome,
        competitiveEligible: true,
        metadata: JSON.parse(row.metadata_json),
      });
    for (const user of database
      .prepare("SELECT user_id FROM meta_player_accounts")
      .all())
      onCompetitiveWalletUpdated(database, user.user_id, now());
    database.exec("COMMIT");
    return settlements.length;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function backfillCompetitionSystem(database) {
  const settlements = database
    .prepare(
      `SELECT settlements.event_id,settlements.source_record_id,settlements.round_id,
      settlements.user_id,settlements.game_id,settlements.game_family,settlements.settled_at,
      CAST(settlements.wager_micro AS REAL) wager_micro,
      CAST(settlements.payout_micro AS REAL) payout_micro,
      CAST(settlements.net_micro AS REAL) net_micro,settlements.multiplier,settlements.outcome,
      settlements.competitive_eligible,settlements.eligibility_reason,settlements.metadata_json,
      settlements.invalidated_at,settlements.invalidated_by,settlements.invalidation_reason,settlements.created_at
      FROM meta_round_settlements settlements
    LEFT JOIN competition_processed_settlements processed ON processed.event_id=settlements.event_id
    WHERE settlements.competitive_eligible=1 AND settlements.invalidated_at IS NULL AND processed.event_id IS NULL
    ORDER BY settlements.settled_at,settlements.event_id`,
    )
    .all();
  if (!settlements.length) return 0;
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const row of settlements)
      processCompetitionSettlement(database, {
        eventId: row.event_id,
        roundId: row.round_id,
        userId: row.user_id,
        gameId: row.game_id,
        gameFamily: row.game_family,
        settledAt: row.settled_at,
        wagerMicro: row.wager_micro,
        payoutMicro: row.payout_micro,
        netMicro: row.net_micro,
        multiplier: row.multiplier,
        outcome: row.outcome,
        competitiveEligible: true,
        metadata: JSON.parse(row.metadata_json),
      });
    database.exec("COMMIT");
    return settlements.length;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export { ACHIEVEMENTS, MILESTONES, PASSPORT_GOALS };
