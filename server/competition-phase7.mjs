import { createHash } from "node:crypto";

const MICRO_PR = 1_000_000;
const now = () => new Date().toISOString();
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const idFor = (...parts) =>
  createHash("sha256").update(parts.join("|")).digest("hex");
const toPR = (value) => Number(value ?? 0) / MICRO_PR;

function mondayKey(at = now()) {
  const date = new Date(at);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function emitActivity(database, event) {
  const occurredAt = event.occurredAt ?? now();
  const id =
    event.id ??
    `phase7-${idFor(event.type, event.userId ?? "", event.entityId ?? "", occurredAt)}`;
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
      occurredAt,
      JSON.stringify(event.metadata ?? {}),
    );
}

export function initializeCompetitionPhase7(database) {
  if (
    !database
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((column) => column.name === "avatar_id")
  ) {
    database.exec(
      "ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'monogram-gold'",
    );
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS club_event_contributions (
      event_id TEXT NOT NULL REFERENCES club_events(id),club_id TEXT NOT NULL REFERENCES clubs(id),
      user_id TEXT NOT NULL REFERENCES users(id),score INTEGER NOT NULL DEFAULT 0,rounds INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,PRIMARY KEY(event_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_club_event_contributions_club ON club_event_contributions(event_id,club_id,score DESC);
    CREATE TABLE IF NOT EXISTS club_event_results (
      event_id TEXT NOT NULL REFERENCES club_events(id),club_id TEXT NOT NULL REFERENCES clubs(id),rank INTEGER NOT NULL,
      score INTEGER NOT NULL,members INTEGER NOT NULL,recorded_at TEXT NOT NULL,PRIMARY KEY(event_id,club_id),UNIQUE(event_id,rank)
    );
    CREATE TABLE IF NOT EXISTS club_processed_settlements (
      event_id TEXT PRIMARY KEY,club_event_id TEXT NOT NULL REFERENCES club_events(id),processed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS multiplayer_matches (
      id TEXT PRIMARY KEY,game_id TEXT NOT NULL,source TEXT NOT NULL,participants_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,recorded_by TEXT REFERENCES users(id),recorded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS multiplayer_rating_history (
      match_id TEXT NOT NULL REFERENCES multiplayer_matches(id),user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL,
      rating_before INTEGER NOT NULL,rating_after INTEGER NOT NULL,delta INTEGER NOT NULL,placement INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,PRIMARY KEY(match_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_multiplayer_rating_rank ON multiplayer_ratings(game_id,rating DESC,wins DESC);
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,game_id TEXT NOT NULL,status TEXT NOT NULL,
      starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,buy_in_micro INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES users(id),created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tournaments_time ON tournaments(status,starts_at DESC);
    CREATE TABLE IF NOT EXISTS tournament_entries (
      tournament_id TEXT NOT NULL REFERENCES tournaments(id),user_id TEXT NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL,PRIMARY KEY(tournament_id,user_id)
    );
  `);
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_club_members_single_club ON club_members(user_id)",
  );
  ensureClubEvent(database);
  database
    .prepare(
      "INSERT INTO schema_info(key,value) VALUES('schema_version','11') ON CONFLICT(key) DO UPDATE SET value='11'",
    )
    .run();
}

function finalizeClubEvents(database, at = now()) {
  const expired = database
    .prepare(
      "SELECT * FROM club_events WHERE status='active' AND ends_at<=? ORDER BY ends_at",
    )
    .all(at);
  for (const event of expired) {
    const rows = database
      .prepare(
        `SELECT c.id clubId,COALESCE(s.score,0) score,COUNT(m.user_id) members
      FROM clubs c LEFT JOIN club_scores s ON s.club_id=c.id AND s.event_id=?
      LEFT JOIN club_members m ON m.club_id=c.id WHERE c.status='active'
      GROUP BY c.id ORDER BY score DESC,c.created_at,c.id`,
      )
      .all(event.id);
    const insert =
      database.prepare(`INSERT INTO club_event_results(event_id,club_id,rank,score,members,recorded_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(event_id,club_id) DO NOTHING`);
    rows.forEach((row, index) =>
      insert.run(event.id, row.clubId, index + 1, row.score, row.members, at),
    );
    database
      .prepare("UPDATE club_events SET status='archived' WHERE id=?")
      .run(event.id);
    if (rows[0]?.score > 0) {
      const winner = database
        .prepare("SELECT name,tag FROM clubs WHERE id=?")
        .get(rows[0].clubId);
      emitActivity(database, {
        type: "club-event-won",
        severity: "legendary",
        title: "MASALAR BİRLİĞİ HAFTAYI KAPATTI",
        message: `${winner.name} [${winner.tag}] kulüp yarışını ${rows[0].score} puanla kazandı.`,
        entityId: event.id,
        occurredAt: at,
        metadata: { clubId: rows[0].clubId, score: rows[0].score },
      });
    }
  }
}

export function ensureClubEvent(database, at = now()) {
  finalizeClubEvents(database, at);
  const weekKey = mondayKey(at);
  const id = `club-week-${weekKey}`;
  let event = database.prepare("SELECT * FROM club_events WHERE id=?").get(id);
  if (!event) {
    const startsAt = new Date(`${weekKey}T00:00:00.000Z`);
    const endsAt = new Date(startsAt.getTime() + 7 * 86400000);
    database
      .prepare(
        `INSERT INTO club_events(id,name,starts_at,ends_at,status,per_player_cap,created_at)
      VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        `Kulüpler Gecesi · ${weekKey}`,
        startsAt.toISOString(),
        endsAt.toISOString(),
        "active",
        250,
        now(),
      );
    event = database.prepare("SELECT * FROM club_events WHERE id=?").get(id);
  }
  return event;
}

export function clubScoreForSettlement(settlement) {
  const multiplier = finite(settlement.multiplier);
  if (multiplier >= 100) return 12;
  if (multiplier >= 25) return 7;
  if (multiplier >= 10) return 4;
  if (multiplier >= 5) return 2;
  return 0;
}

export function processClubSettlement(database, settlement) {
  const score = clubScoreForSettlement(settlement);
  if (!settlement.competitiveEligible || score <= 0) return null;
  const membership = database
    .prepare(
      `SELECT m.club_id clubId,m.joined_at joinedAt,c.status FROM club_members m
    JOIN clubs c ON c.id=m.club_id WHERE m.user_id=?`,
    )
    .get(settlement.userId);
  if (
    !membership ||
    membership.status !== "active" ||
    membership.joinedAt > settlement.settledAt
  )
    return null;
  const event = ensureClubEvent(database, settlement.settledAt);
  const accepted = database
    .prepare(
      `INSERT INTO club_processed_settlements(event_id,club_event_id,processed_at)
    VALUES(?,?,?) ON CONFLICT(event_id) DO NOTHING`,
    )
    .run(settlement.eventId, event.id, now());
  if (!accepted.changes) return null;
  const current = database
    .prepare(
      "SELECT score FROM club_event_contributions WHERE event_id=? AND user_id=?",
    )
    .get(event.id, settlement.userId);
  const awarded = Math.max(
    0,
    Math.min(score, Number(event.per_player_cap) - Number(current?.score ?? 0)),
  );
  if (!awarded) return null;
  database
    .prepare(
      `INSERT INTO club_event_contributions(event_id,club_id,user_id,score,rounds,updated_at)
    VALUES(?,?,?,?,1,?) ON CONFLICT(event_id,user_id) DO UPDATE SET score=score+excluded.score,rounds=rounds+1,updated_at=excluded.updated_at`,
    )
    .run(
      event.id,
      membership.clubId,
      settlement.userId,
      awarded,
      settlement.settledAt,
    );
  database
    .prepare(
      `INSERT INTO club_scores(event_id,club_id,score,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(event_id,club_id) DO UPDATE SET score=score+excluded.score,updated_at=excluded.updated_at`,
    )
    .run(event.id, membership.clubId, awarded, settlement.settledAt);
  database
    .prepare(
      "UPDATE club_members SET contribution_points=contribution_points+? WHERE club_id=? AND user_id=?",
    )
    .run(awarded, membership.clubId, settlement.userId);
  return {
    type: "club-contribution",
    score: awarded,
    clubId: membership.clubId,
    eventId: event.id,
  };
}

function membershipFor(database, userId) {
  return database
    .prepare(
      `SELECT m.club_id clubId,m.role,m.contribution_points contributionPoints,m.joined_at joinedAt,
    c.name,c.tag,c.created_by createdBy,c.created_at createdAt FROM club_members m JOIN clubs c ON c.id=m.club_id
    WHERE m.user_id=? AND c.status='active'`,
    )
    .get(userId);
}

export function createClub(database, userId, payload = {}) {
  if (membershipFor(database, userId))
    throw new Error("Zaten bir kulübün üyesisin.");
  const name = String(payload.name ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
  const tag = String(payload.tag ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleUpperCase("tr-TR");
  if (name.length < 3 || name.length > 32)
    throw new Error("Kulüp adı 3–32 karakter olmalı.");
  if (!/^[A-Z0-9ÇĞİÖŞÜ]{2,6}$/u.test(tag))
    throw new Error("Kulüp etiketi 2–6 harf veya sayı olmalı.");
  const timestamp = now(),
    clubId = `club-${idFor(userId, name, tag, timestamp).slice(0, 20)}`;
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        "INSERT INTO clubs(id,name,tag,created_by,status,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(clubId, name, tag, userId, "active", timestamp);
    database
      .prepare(
        "INSERT INTO club_members(club_id,user_id,role,contribution_points,joined_at) VALUES(?,?,?,0,?)",
      )
      .run(clubId, userId, "leader", timestamp);
    emitActivity(database, {
      type: "club-created",
      severity: "important",
      title: "YENİ MASA BİRLİĞİ",
      message: `${name} [${tag}] kapılarını açtı.`,
      userId,
      entityId: clubId,
      occurredAt: timestamp,
      metadata: { clubId, tag },
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return clubId;
}

export function joinClub(database, userId, clubId) {
  if (membershipFor(database, userId))
    throw new Error("Önce mevcut kulübünden ayrılmalısın.");
  const club = database
    .prepare("SELECT * FROM clubs WHERE id=? AND status='active'")
    .get(clubId);
  if (!club) throw new Error("Kulüp bulunamadı veya kapalı.");
  const timestamp = now();
  database
    .prepare(
      "INSERT INTO club_members(club_id,user_id,role,contribution_points,joined_at) VALUES(?,?,?,0,?)",
    )
    .run(club.id, userId, "member", timestamp);
  emitActivity(database, {
    type: "club-joined",
    severity: "normal",
    title: "KULÜBE YENİ İSİM",
    message: `Bir oyuncu ${club.name} [${club.tag}] saflarına katıldı.`,
    userId,
    entityId: club.id,
    occurredAt: timestamp,
  });
}

export function leaveClub(database, userId) {
  const membership = membershipFor(database, userId);
  if (!membership) throw new Error("Bir kulübün üyesi değilsin.");
  database.exec("BEGIN IMMEDIATE");
  try {
    if (membership.role === "leader") {
      const successor = database
        .prepare(
          "SELECT user_id FROM club_members WHERE club_id=? AND user_id<>? ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END,joined_at LIMIT 1",
        )
        .get(membership.clubId, userId);
      if (successor)
        database
          .prepare(
            "UPDATE club_members SET role='leader' WHERE club_id=? AND user_id=?",
          )
          .run(membership.clubId, successor.user_id);
    }
    database
      .prepare("DELETE FROM club_members WHERE club_id=? AND user_id=?")
      .run(membership.clubId, userId);
    const remaining = database
      .prepare("SELECT COUNT(*) count FROM club_members WHERE club_id=?")
      .get(membership.clubId).count;
    if (!remaining)
      database
        .prepare("UPDATE clubs SET status='archived' WHERE id=?")
        .run(membership.clubId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function ensureRating(database, userId, gameId = "poker", at = now()) {
  database
    .prepare(
      `INSERT INTO multiplayer_ratings(user_id,game_id,rating,updated_at) VALUES(?,?,1000,?)
    ON CONFLICT(user_id,game_id) DO NOTHING`,
    )
    .run(userId, gameId, at);
  return database
    .prepare("SELECT * FROM multiplayer_ratings WHERE user_id=? AND game_id=?")
    .get(userId, gameId);
}

function applyRatingMatch(database, actorUserId, payload) {
  const matchId = String(payload.matchId ?? "").trim(),
    gameId = String(payload.gameId ?? "poker").trim();
  if (!matchId) throw new Error("Maç kimliği zorunlu.");
  const participants = (payload.participants ?? []).map((item) => ({
    userId: String(item.userId ?? ""),
    placement: Math.max(1, Math.floor(finite(item.placement, 999))),
    largestPot: Math.max(0, finite(item.largestPot)),
    bestHand: item.bestHand ? String(item.bestHand).slice(0, 80) : null,
  }));
  if (
    participants.length < 2 ||
    participants.length > 12 ||
    new Set(participants.map((item) => item.userId)).size !==
      participants.length
  )
    throw new Error("Dereceli maçta 2–12 farklı oyuncu olmalı.");
  const active = database
    .prepare(
      `SELECT id FROM users WHERE status='active' AND id IN (${participants.map(() => "?").join(",")})`,
    )
    .all(...participants.map((item) => item.userId));
  if (active.length !== participants.length)
    throw new Error("Katılımcılardan biri aktif oyuncu değil.");
  const accepted = database
    .prepare(
      `INSERT INTO multiplayer_matches(id,game_id,source,participants_json,metadata_json,recorded_by,recorded_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
    )
    .run(
      matchId,
      gameId,
      String(payload.source ?? "verified"),
      JSON.stringify(participants),
      JSON.stringify(payload.metadata ?? {}),
      actorUserId ?? null,
      String(payload.recordedAt ?? now()),
    );
  if (!accepted.changes) return { processed: false, matchId, deltas: [] };
  const ratings = new Map(
    participants.map((item) => [
      item.userId,
      ensureRating(database, item.userId, gameId),
    ]),
  );
  const k = Math.max(8, Math.min(64, finite(payload.kFactor, 32)));
  const deltas = participants.map((player) => {
    let actual = 0,
      expected = 0;
    for (const opponent of participants) {
      if (opponent.userId === player.userId) continue;
      actual +=
        player.placement < opponent.placement
          ? 1
          : player.placement === opponent.placement
            ? 0.5
            : 0;
      expected +=
        1 /
        (1 +
          10 **
            ((ratings.get(opponent.userId).rating -
              ratings.get(player.userId).rating) /
              400));
    }
    const divisor = participants.length - 1;
    return {
      ...player,
      before: ratings.get(player.userId).rating,
      delta: Math.round(k * (actual / divisor - expected / divisor)),
    };
  });
  const timestamp = String(payload.recordedAt ?? now());
  for (const item of deltas) {
    const after = Math.max(100, item.before + item.delta),
      isWinner =
        item.placement === Math.min(...participants.map((p) => p.placement)),
      isDraw = participants.every((p) => p.placement === item.placement);
    database
      .prepare(
        `UPDATE multiplayer_ratings SET rating=?,wins=wins+?,losses=losses+?,draws=draws+?,heads_up_wins=heads_up_wins+?,
      largest_pot_micro=MAX(largest_pot_micro,?),best_hand=COALESCE(?,best_hand),updated_at=? WHERE user_id=? AND game_id=?`,
      )
      .run(
        after,
        isWinner && !isDraw ? 1 : 0,
        !isWinner && !isDraw ? 1 : 0,
        isDraw ? 1 : 0,
        participants.length === 2 && isWinner && !isDraw ? 1 : 0,
        Math.round(item.largestPot * MICRO_PR),
        item.bestHand,
        timestamp,
        item.userId,
        gameId,
      );
    database
      .prepare(
        `INSERT INTO multiplayer_rating_history(match_id,user_id,game_id,rating_before,rating_after,delta,placement,recorded_at)
      VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        matchId,
        item.userId,
        gameId,
        item.before,
        after,
        item.delta,
        item.placement,
        timestamp,
      );
    item.after = after;
  }
  return { processed: true, matchId, deltas };
}

export function recordMultiplayerMatch(database, actorUserId, payload) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = applyRatingMatch(database, actorUserId, payload);
    if (result.processed) {
      const winner = result.deltas.toSorted(
        (a, b) => a.placement - b.placement,
      )[0];
      const name = database
        .prepare("SELECT display_name displayName FROM users WHERE id=?")
        .get(winner.userId).displayName;
      emitActivity(database, {
        type: "rated-match",
        severity: "important",
        title: "DERECELİ MASA KAPANDI",
        message: `${name}, doğrulanmış poker masasını kazandı ve ${winner.delta >= 0 ? "+" : ""}${winner.delta} rating aldı.`,
        userId: winner.userId,
        gameId: String(payload.gameId ?? "poker"),
        entityId: result.matchId,
        metadata: { deltas: result.deltas },
      });
    }
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function createTournament(database, actorUserId, payload = {}) {
  const name = String(payload.name ?? "")
      .normalize("NFKC")
      .trim(),
    gameId = String(payload.gameId ?? "poker");
  if (name.length < 3 || name.length > 60)
    throw new Error("Turnuva adı 3–60 karakter olmalı.");
  const startsAt = new Date(payload.startsAt ?? Date.now() + 3600000),
    endsAt = new Date(payload.endsAt ?? startsAt.getTime() + 86400000);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  )
    throw new Error("Turnuva tarihleri geçersiz.");
  const id = `tournament-${idFor(name, startsAt.toISOString(), actorUserId).slice(0, 20)}`;
  database
    .prepare(
      `INSERT INTO tournaments(id,name,game_id,status,starts_at,ends_at,buy_in_micro,created_by,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      name,
      gameId,
      "scheduled",
      startsAt.toISOString(),
      endsAt.toISOString(),
      Math.round(Math.max(0, finite(payload.buyIn)) * MICRO_PR),
      actorUserId,
      now(),
    );
  return id;
}

export function joinTournament(database, userId, tournamentId) {
  const tournament = database
    .prepare(
      "SELECT * FROM tournaments WHERE id=? AND status IN ('scheduled','active') AND ends_at>?",
    )
    .get(tournamentId, now());
  if (!tournament) throw new Error("Turnuva kayıt kabul etmiyor.");
  database
    .prepare(
      "INSERT INTO tournament_entries(tournament_id,user_id,joined_at) VALUES(?,?,?) ON CONFLICT(tournament_id,user_id) DO NOTHING",
    )
    .run(tournamentId, userId, now());
}

export function recordTournamentResults(database, actorUserId, payload = {}) {
  const tournament = database
    .prepare("SELECT * FROM tournaments WHERE id=? AND status<>'completed'")
    .get(String(payload.tournamentId ?? ""));
  if (!tournament) throw new Error("Açık turnuva bulunamadı.");
  const entries = database
    .prepare(
      "SELECT user_id userId FROM tournament_entries WHERE tournament_id=?",
    )
    .all(tournament.id);
  const placements = (payload.placements ?? []).map((item) => ({
    userId: String(item.userId ?? ""),
    placement: Math.max(1, Math.floor(finite(item.placement, 999))),
    largestPot: Math.max(0, finite(item.largestPot)),
    bestHand: item.bestHand ? String(item.bestHand) : null,
  }));
  if (
    placements.length < 2 ||
    placements.length !== entries.length ||
    new Set(placements.map((item) => item.userId)).size !== placements.length
  )
    throw new Error("Bütün kayıtlı oyunculara tek bir sıra verilmelidir.");
  if (
    placements.some(
      (item) => !entries.some((entry) => entry.userId === item.userId),
    )
  )
    throw new Error("Sonuçta kayıtlı olmayan oyuncu var.");
  if (
    new Set(placements.map((item) => item.placement)).size !== placements.length
  )
    throw new Error("Turnuva sıraları tekrar edemez.");
  database.exec("BEGIN IMMEDIATE");
  try {
    const timestamp = now();
    const rating = applyRatingMatch(database, actorUserId, {
      matchId: `tournament:${tournament.id}`,
      gameId: tournament.game_id,
      participants: placements,
      source: "tournament",
      recordedAt: timestamp,
      metadata: { tournamentId: tournament.id },
    });
    const insert =
      database.prepare(`INSERT INTO tournament_results(id,tournament_id,user_id,game_id,placement,field_size,reward_micro,rating_delta,metadata_json,recorded_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`);
    const season = database
      .prepare(
        "SELECT id FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1",
      )
      .get();
    for (const item of placements) {
      const delta =
        rating.deltas.find((row) => row.userId === item.userId)?.delta ?? 0;
      insert.run(
        `result-${idFor(tournament.id, item.userId)}`,
        tournament.id,
        item.userId,
        tournament.game_id,
        item.placement,
        placements.length,
        0,
        delta,
        JSON.stringify({
          bestHand: item.bestHand,
          largestPot: item.largestPot,
        }),
        timestamp,
      );
      database
        .prepare(
          `UPDATE multiplayer_ratings SET tournament_wins=tournament_wins+?,final_tables=final_tables+?,updated_at=? WHERE user_id=? AND game_id=?`,
        )
        .run(
          item.placement === 1 ? 1 : 0,
          item.placement <= Math.min(9, placements.length) ? 1 : 0,
          timestamp,
          item.userId,
          tournament.game_id,
        );
      const points =
        item.placement === 1
          ? 50
          : item.placement === 2
            ? 25
            : item.placement === 3
              ? 15
              : 5;
      const fame =
        item.placement === 1
          ? 250
          : item.placement === 2
            ? 100
            : item.placement === 3
              ? 50
              : 10;
      database
        .prepare(
          "INSERT INTO player_careers(user_id,fame,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET fame=fame+excluded.fame,updated_at=excluded.updated_at",
        )
        .run(item.userId, fame, timestamp, timestamp);
      if (season)
        database
          .prepare(
            `INSERT INTO season_scores(season_id,user_id,season_points,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(season_id,user_id) DO UPDATE SET season_points=season_points+excluded.season_points,updated_at=excluded.updated_at`,
          )
          .run(season.id, item.userId, points, timestamp);
    }
    database
      .prepare("UPDATE tournaments SET status='completed' WHERE id=?")
      .run(tournament.id);
    const winner = placements.toSorted((a, b) => a.placement - b.placement)[0];
    const winnerName = database
      .prepare("SELECT display_name displayName FROM users WHERE id=?")
      .get(winner.userId).displayName;
    emitActivity(database, {
      type: "tournament-won",
      severity: "legendary",
      title: "TURNUVA ŞAMPİYONU",
      message: `${winnerName}, ${tournament.name} turnuvasını kazandı.`,
      userId: winner.userId,
      gameId: tournament.game_id,
      entityId: tournament.id,
      occurredAt: timestamp,
    });
    database.exec("COMMIT");
    return rating;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function pokerHub(database, userId) {
  for (const user of database
    .prepare("SELECT id FROM users WHERE status='active'")
    .all())
    ensureRating(database, user.id, "poker");
  const leaderboard = database
    .prepare(
      `SELECT u.id userId,u.display_name displayName,u.avatar_id avatarId,r.rating,r.wins,r.losses,r.draws,
    r.tournament_wins tournamentWins,r.final_tables finalTables,r.heads_up_wins headsUpWins,CAST(r.largest_pot_micro AS REAL) largestPotMicro,r.best_hand bestHand,
    ROW_NUMBER() OVER(ORDER BY r.rating DESC,r.wins DESC,u.id) rank FROM multiplayer_ratings r JOIN users u ON u.id=r.user_id
    WHERE r.game_id='poker' AND u.status='active' ORDER BY rank`,
    )
    .all()
    .map((row) => ({ ...row, largestPot: toPR(row.largestPotMicro) }));
  const history = database
    .prepare(
      `SELECT h.*,u.display_name displayName,m.source FROM multiplayer_rating_history h JOIN users u ON u.id=h.user_id
    JOIN multiplayer_matches m ON m.id=h.match_id WHERE h.game_id='poker' ORDER BY h.recorded_at DESC LIMIT 40`,
    )
    .all();
  return {
    leaderboard,
    self: leaderboard.find((row) => row.userId === userId) ?? null,
    history,
  };
}

function tournamentHub(database, userId) {
  const timestamp = now();
  database
    .prepare(
      "UPDATE tournaments SET status='active' WHERE status='scheduled' AND starts_at<=? AND ends_at>?",
    )
    .run(timestamp, timestamp);
  const tournaments = database
    .prepare(
      `SELECT t.*,u.display_name creatorName,COUNT(DISTINCT e.user_id) entrants
    FROM tournaments t LEFT JOIN users u ON u.id=t.created_by LEFT JOIN tournament_entries e ON e.tournament_id=t.id
    GROUP BY t.id ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,t.starts_at DESC LIMIT 30`,
    )
    .all();
  return tournaments.map((item) => ({
    id: item.id,
    name: item.name,
    gameId: item.game_id,
    status: item.status,
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    buyIn: toPR(item.buy_in_micro),
    creatorName: item.creatorName,
    entrants: Number(item.entrants),
    joined: Boolean(
      database
        .prepare(
          "SELECT 1 FROM tournament_entries WHERE tournament_id=? AND user_id=?",
        )
        .get(item.id, userId),
    ),
    entries: database
      .prepare(
        `SELECT e.user_id userId,u.display_name displayName,u.avatar_id avatarId,e.joined_at joinedAt FROM tournament_entries e JOIN users u ON u.id=e.user_id WHERE e.tournament_id=? ORDER BY e.joined_at`,
      )
      .all(item.id),
    results: database
      .prepare(
        `SELECT r.user_id userId,u.display_name displayName,u.avatar_id avatarId,r.placement,r.field_size fieldSize,r.rating_delta ratingDelta,r.recorded_at recordedAt FROM tournament_results r JOIN users u ON u.id=r.user_id WHERE r.tournament_id=? ORDER BY r.placement`,
      )
      .all(item.id),
  }));
}

function clubHub(database, userId) {
  const event = ensureClubEvent(database);
  const clubs = database
    .prepare(
      `SELECT c.id,c.name,c.tag,c.created_by createdBy,c.created_at createdAt,COUNT(m.user_id) members,
    COALESCE(SUM(m.contribution_points),0) lifetimeScore FROM clubs c LEFT JOIN club_members m ON m.club_id=c.id
    WHERE c.status='active' GROUP BY c.id ORDER BY lifetimeScore DESC,c.created_at`,
    )
    .all();
  const standings = database
    .prepare(
      `SELECT c.id clubId,c.name,c.tag,COALESCE(s.score,0) score,COUNT(DISTINCT m.user_id) members,
    ROW_NUMBER() OVER(ORDER BY COALESCE(s.score,0) DESC,c.created_at,c.id) rank FROM clubs c
    LEFT JOIN club_scores s ON s.club_id=c.id AND s.event_id=? LEFT JOIN club_members m ON m.club_id=c.id
    WHERE c.status='active' GROUP BY c.id ORDER BY rank`,
    )
    .all(event.id);
  const membership = membershipFor(database, userId);
  const myClub = membership
    ? {
        ...membership,
        members: database
          .prepare(
            `SELECT m.user_id userId,u.display_name displayName,u.avatar_id avatarId,m.role,m.contribution_points contributionPoints,
    COALESCE(ec.score,0) weeklyScore,m.joined_at joinedAt FROM club_members m JOIN users u ON u.id=m.user_id
    LEFT JOIN club_event_contributions ec ON ec.user_id=m.user_id AND ec.event_id=? WHERE m.club_id=? ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,weeklyScore DESC,m.joined_at`,
          )
          .all(event.id, membership.clubId),
        weeklyScore: Number(
          standings.find((item) => item.clubId === membership.clubId)?.score ??
            0,
        ),
        weeklyRank:
          standings.find((item) => item.clubId === membership.clubId)?.rank ??
          null,
        myWeeklyScore: Number(
          database
            .prepare(
              "SELECT score FROM club_event_contributions WHERE event_id=? AND user_id=?",
            )
            .get(event.id, userId)?.score ?? 0,
        ),
      }
    : null;
  const history = database
    .prepare(
      `SELECT r.event_id eventId,r.club_id clubId,c.name,c.tag,r.rank,r.score,r.members,r.recorded_at recordedAt
    FROM club_event_results r JOIN clubs c ON c.id=r.club_id ORDER BY r.recorded_at DESC,r.rank LIMIT 40`,
    )
    .all();
  return {
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      perPlayerCap: event.per_player_cap,
      remainingMs: Math.max(0, new Date(event.ends_at).getTime() - Date.now()),
    },
    clubs,
    standings,
    myClub,
    history,
  };
}

export function getSocialCompetition(database, userId) {
  return {
    clubs: clubHub(database, userId),
    poker: pokerHub(database, userId),
    tournaments: tournamentHub(database, userId),
  };
}

export function rebuildClubCompetition(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(
      "DELETE FROM club_event_results;DELETE FROM club_event_contributions;DELETE FROM club_scores;DELETE FROM club_processed_settlements;UPDATE club_members SET contribution_points=0;",
    );
    const settlements = database
      .prepare(
        `SELECT event_id,user_id,settled_at,multiplier,competitive_eligible
        FROM meta_round_settlements WHERE competitive_eligible=1 AND invalidated_at IS NULL
        ORDER BY settled_at,event_id`,
      )
      .all();
    for (const row of settlements)
      processClubSettlement(database, {
        eventId: row.event_id,
        userId: row.user_id,
        settledAt: row.settled_at,
        multiplier: row.multiplier,
        competitiveEligible: true,
      });
    database.exec("COMMIT");
    return settlements.length;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
