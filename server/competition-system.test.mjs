import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  initializeMetaSystem,
  normalizeSettlement,
  processRoundSettlement,
  rebuildMetaSystem,
  weekKeyFor,
} from "./meta-system.mjs";
import {
  getCompetitionAdminState,
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
  getSocialCompetition,
  joinClub,
  joinTournament,
  leaveClub,
  processClubSettlement,
  recordMultiplayerMatch,
  recordTournamentResults,
} from "./competition-phase7.mjs";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,username_display TEXT,display_name TEXT,role TEXT,status TEXT,created_at TEXT);
    CREATE TABLE wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),balance_micro INTEGER NOT NULL,version INTEGER DEFAULT 0,updated_at TEXT NOT NULL);
    CREATE TABLE wallet_ledger_v2(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),round_id TEXT,game TEXT,actor_user_id TEXT,type TEXT,amount_micro INTEGER,balance_before_micro INTEGER,balance_after_micro INTEGER,idempotency_key TEXT UNIQUE,reason TEXT,occurred_at TEXT);
    CREATE TABLE game_rounds(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),settled_at TEXT,payload_json TEXT);
    CREATE TABLE schema_info(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    INSERT INTO users VALUES('u1','Muharrem','Muharrem Pehlevan','owner','active','2026-01-01');
    INSERT INTO users VALUES('u2','Mert','Mert','player','active','2026-01-01');
    INSERT INTO wallets VALUES('u1',100000000000,0,'2026-01-01');
    INSERT INTO wallets VALUES('u2',90000000000,0,'2026-01-01');
  `);
  initializeMetaSystem(database);
  initializeCompetitionSystem(database);
  return database;
}

function settlement(database, overrides = {}) {
  const record = {
    id: "round:r1",
    roundId: "r1",
    userId: "u1",
    game: "kaptan-mercan",
    variant: "normal",
    source: "player",
    playerParticipated: true,
    settledAt: new Date().toISOString(),
    stake: 100,
    grossPayout: 12000,
    outcome: "win",
    result: { moneyFishValues: [100], captainCount: 1 },
    modifiers: {},
    ...overrides,
  };
  database
    .prepare(
      "INSERT INTO game_rounds(id,user_id,settled_at,payload_json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
    )
    .run(record.id, record.userId, record.settledAt, JSON.stringify(record));
  return processRoundSettlement(database, record).settlement;
}

describe("social competition domain", () => {
  let database;
  beforeEach(() => {
    database = fixture();
  });

  it("telemetry keeps the latest 20 valid rounds per game and excludes older and invalidated audits", () => {
    for (let i = 0; i < 25; i++) {
      const event = settlement(database, { id: `round:telemetry-${i}`, roundId: `telemetry-${i}`,
        settledAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() });
      database.prepare("UPDATE meta_round_settlements SET metadata_json=?,invalidated_at=? WHERE event_id=?")
        .run(JSON.stringify({ telemetryAudit: { complete: i >= 4, missing: i < 4 ? ['old-field'] : [] } }),
          i === 24 ? '2026-01-02' : null, event.eventId);
    }
    const telemetry = getCompetitionAdminState(database).telemetry;
    expect(telemetry.find((entry) => entry.gameId === 'kaptan-mercan')).toMatchObject({ rounds: 20, audited: 20, complete: 20, missing: [], status: 'healthy' });
    expect(telemetry.find((entry) => entry.gameId === 'blackjack')).toMatchObject({ rounds: 0, status: 'no-data' });
  });

  it("settlementı bir kez işleyip sezon, mastery, passport ve records üretir", () => {
    const event = settlement(database);
    const processed = processCompetitionSettlement(database, event);
    expect(processed.processed).toBe(true);
    expect(
      processed.signals.some((signal) => signal.type === "personal-best"),
    ).toBe(true);
    expect(processCompetitionSettlement(database, event).processed).toBe(false);
    expect(
      database
        .prepare("SELECT rounds FROM season_scores WHERE user_id=?")
        .get("u1").rounds,
    ).toBe(1);
    expect(
      database
        .prepare("SELECT tier FROM player_game_mastery WHERE user_id=?")
        .get("u1").tier,
    ).toBe("Silver");
    expect(
      database
        .prepare("SELECT COUNT(*) count FROM passport_progress WHERE user_id=?")
        .get("u1").count,
    ).toBeGreaterThan(1);
    expect(
      database
        .prepare("SELECT COUNT(*) count FROM game_records WHERE user_id=?")
        .get("u1").count,
    ).toBeGreaterThan(0);
    expect(
      database
        .prepare(
          "SELECT COUNT(*) count FROM season_game_records WHERE user_id=?",
        )
        .get("u1").count,
    ).toBeGreaterThan(0);
    expect(
      database.prepare("SELECT eligible_rounds FROM house_event_scores").get()
        .eligible_rounds,
    ).toBe(1);
  });

  it("başarımı yalnız bir kez verip mafya unvanını seçtirir", () => {
    processCompetitionSettlement(database, settlement(database));
    const achievement = database
      .prepare(
        "SELECT * FROM user_achievements WHERE user_id='u1' AND achievement_id='yuz-kat'",
      )
      .get();
    expect(achievement).toBeTruthy();
    setActiveTitle(database, "u1", "masa-reisi");
    expect(
      database
        .prepare(
          "SELECT active_title_id FROM player_careers WHERE user_id='u1'",
        )
        .get().active_title_id,
    ).toBe("masa-reisi");
  });

  it("dashboard para, sezon, feed, rekor ve kariyeri tek payloadta döndürür", () => {
    processCompetitionSettlement(database, settlement(database));
    onCompetitiveWalletUpdated(database, "u1", new Date().toISOString());
    const dashboard = getCompetitionDashboard(database, "u1");
    expect(dashboard.leaderboards.wealth.top[0].displayName).toBe(
      "Muharrem Pehlevan",
    );
    expect(dashboard.profile.achievements.some((item) => item.unlockedAt)).toBe(
      true,
    );
    expect(dashboard.feed.length).toBeGreaterThan(0);
    expect(dashboard.records.length).toBeGreaterThan(0);
    expect(dashboard.seasonRecords.length).toBeGreaterThan(0);
    expect(dashboard.houseEvent.eligibleRounds).toBe(1);
    expect(dashboard.leaderboards.growth.top.length).toBe(2);
    expect(dashboard.hall.crown.length).toBeGreaterThan(0);
    expect(dashboard.newspaper.biggestHit).toMatchObject({
      displayName: "Muharrem Pehlevan",
      gameId: "kaptan-mercan",
      payout: 12000,
    });
    expect(dashboard.newspaper.hotGame).toMatchObject({
      gameId: "kaptan-mercan",
      count: 1,
    });
    expect(dashboard.feed.some((event) => event.type === "big-hit")).toBe(true);
    expect(
      dashboard.feed.some((event) => event.type === "season-top-three"),
    ).toBe(true);
  });

  it("anlamlı galibiyet serisini yalnız eşiğe ilk ulaşıldığında Casino Live'a taşır", () => {
    for (let index = 1; index <= 6; index += 1) {
      const event = settlement(database, {
        id: `round:streak-${index}`,
        roundId: `streak-${index}`,
        settledAt: new Date(Date.now() + index * 1000).toISOString(),
      });
      processCompetitionSettlement(database, event);
    }
    expect(
      database
        .prepare(
          "SELECT COUNT(*) count FROM activity_events WHERE type='winning-streak' AND user_id='u1'",
        )
        .get().count,
    ).toBe(1);
  });

  it("hafta sınırını seçilen saat diliminde hesaplayıp değişiklikte haftalık tabloları yeniden kurar", () => {
    const boundary = "2026-08-30T22:30:00.000Z";
    expect(weekKeyFor(boundary, "Europe/Istanbul")).toBe("2026-08-31");
    expect(weekKeyFor(boundary, "UTC")).toBe("2026-08-24");
    settlement(database, { settledAt: boundary });
    expect(
      database
        .prepare(
          "SELECT period_key FROM game_stat_aggregates WHERE user_id='u1' AND period_type='week' AND scope_type='casino'",
        )
        .get().period_key,
    ).toBe("2026-08-31");
    const initial = getCompetitionAdminState(database);
    const config = structuredClone(initial.config);
    config.schedule.timeZone = "UTC";
    updateCompetitionConfig(database, "u1", { config });
    expect(
      database
        .prepare(
          "SELECT period_key FROM game_stat_aggregates WHERE user_id='u1' AND period_type='week' AND scope_type='casino'",
        )
        .get().period_key,
    ).toBe("2026-08-24");
  });

  it("oyuncunun sahip olduğu üç parçalık vitrini kaydeder ve herkese açık profilde çözer", () => {
    processCompetitionSettlement(database, settlement(database));
    setProfileShowcase(database, "u1", [
      { itemType: "achievement", itemId: "yuz-kat" },
      { itemType: "title", itemId: "masa-reisi" },
    ]);
    const publicProfile = getPublicProfile(database, "u1", "u2");
    expect(publicProfile.isSelf).toBe(false);
    expect(
      publicProfile.profile.showcase.map((item) => item.item.label),
    ).toEqual(["Yüz Kat", "Masa Reisi"]);
    expect(() =>
      setProfileShowcase(database, "u1", [
        { itemType: "achievement", itemId: "olmayan" },
      ]),
    ).toThrow();
  });

  it("türetilmiş rekabet verisini immutable settlementlardan yeniden kurar", () => {
    const event = settlement(database);
    processCompetitionSettlement(database, event);
    expect(rebuildCompetitionSystem(database)).toBe(1);
    expect(
      database
        .prepare("SELECT rounds FROM season_scores WHERE user_id=?")
        .get("u1").rounds,
    ).toBe(1);
  });

  it("admin rekabet ayarını doğrular, denetim kaydı yazar ve yeni skoru değiştirir", () => {
    const initial = getCompetitionAdminState(database);
    const config = structuredClone(initial.config);
    config.scoring.hundredX = 19;
    const saved = updateCompetitionConfig(database, "u1", {
      config,
      reason: "Sezon temposu testi",
    });
    expect(saved.scoring.hundredX).toBe(19);
    processCompetitionSettlement(database, settlement(database));
    expect(
      database
        .prepare("SELECT season_points FROM season_scores WHERE user_id='u1'")
        .get().season_points,
    ).toBeGreaterThanOrEqual(19);
    expect(
      database
        .prepare("SELECT action,reason FROM competition_admin_audit")
        .get(),
    ).toMatchObject({
      action: "competition.config.update",
      reason: "Sezon temposu testi",
    });
  });

  it("hariç tutulan hesabın geçmişini koruyup yeni sonucunu bütün rekabet tablolarından çıkarır", () => {
    const initial = getCompetitionAdminState(database);
    const config = structuredClone(initial.config);
    config.eligibility.excludedUserIds = ["u1"];
    updateCompetitionConfig(database, "u1", {
      config,
      reason: "Test hesabını rekabetten çıkar",
    });
    const result = processCompetitionSettlement(database, settlement(database));
    expect(result).toMatchObject({ processed: false, reason: "excluded-user" });
    expect(
      database
        .prepare("SELECT COUNT(*) count FROM competition_processed_settlements")
        .get().count,
    ).toBe(0);
    expect(
      getCompetitionDashboard(database, "u2").leaderboards.wealth.top.some(
        (row) => row.userId === "u1",
      ),
    ).toBe(false);
    expect(
      database
        .prepare(
          "SELECT COUNT(*) count FROM meta_round_settlements WHERE user_id='u1'",
        )
        .get().count,
    ).toBe(1);
  });

  it("geçersiz kılınan sonucu silmeden rebuild sonrasında da dışarıda tutar", () => {
    const event = settlement(database);
    processCompetitionSettlement(database, event);
    invalidateCompetitionSettlement(
      database,
      "u1",
      event.eventId,
      "Bozuk test sonucu",
    );
    expect(rebuildMetaSystem(database)).toBe(1);
    expect(
      database
        .prepare(
          "SELECT invalidated_at FROM meta_round_settlements WHERE event_id=?",
        )
        .get(event.eventId).invalidated_at,
    ).toBeTruthy();
    expect(
      database
        .prepare(
          "SELECT rounds FROM game_stat_aggregates WHERE user_id='u1' AND scope_type='casino' AND period_type='lifetime'",
        )
        .get(),
    ).toBeUndefined();
    expect(rebuildCompetitionSystem(database)).toBe(0);
  });

  it("geçmiş house ve haftalık rakip hesabını bir kez kapatıp ödüllendirir", () => {
    const old = settlement(database, {
      id: "round:old",
      roundId: "old",
      settledAt: "2026-08-20T12:00:00.000Z",
    });
    processCompetitionSettlement(database, old);
    database
      .prepare(
        "INSERT INTO rivalries(week_key,user_id,rival_user_id,assigned_at) VALUES('2026-08-17','u1','u2','2026-08-17T00:00:00.000Z')",
      )
      .run();
    const state = getCompetitionAdminState(database);
    expect(state.houseHistory[0]).toMatchObject({
      players_won: 1,
      participants: 1,
    });
    expect(state.rivalHistory[0]).toMatchObject({
      displayName: "Muharrem Pehlevan",
      rivalName: "Mert",
      result: "win",
    });
    expect(
      database
        .prepare(
          "SELECT 1 FROM user_achievements WHERE user_id='u1' AND achievement_id='kasayi-devirdi'",
        )
        .get(),
    ).toBeTruthy();
    getCompetitionAdminState(database);
    expect(
      database.prepare("SELECT COUNT(*) count FROM house_event_results").get()
        .count,
    ).toBe(1);
    expect(
      database.prepare("SELECT COUNT(*) count FROM rival_results").get().count,
    ).toBe(1);
  });

  it("kulüp üyeliğini tekil tutar, liderliği devreder ve haftalık kişi sınırını uygular", () => {
    const clubId = createClub(database, "u1", {
      name: "Kara Masa",
      tag: "KARA",
    });
    joinClub(database, "u2", clubId);
    expect(() =>
      createClub(database, "u2", { name: "İkinci Masa", tag: "IKI" }),
    ).toThrow(/zaten/i);
    const joinedAt = database
      .prepare("SELECT joined_at FROM club_members WHERE user_id='u1'")
      .get().joined_at;
    for (let index = 0; index < 30; index++)
      processClubSettlement(database, {
        eventId: `club-round-${index}`,
        userId: "u1",
        settledAt: new Date(
          new Date(joinedAt).getTime() + index + 1,
        ).toISOString(),
        multiplier: 100,
        competitiveEligible: true,
      });
    const hub = getSocialCompetition(database, "u1").clubs;
    expect(hub.myClub.myWeeklyScore).toBe(250);
    expect(hub.standings[0]).toMatchObject({ clubId, score: 250, members: 2 });
    leaveClub(database, "u1");
    expect(
      database.prepare("SELECT role FROM club_members WHERE user_id='u2'").get()
        .role,
    ).toBe("leader");
  });

  it("doğrulanmış poker sonucunu Elo ratingine yalnız bir kez işler", () => {
    const payload = {
      matchId: "verified-1",
      gameId: "poker",
      participants: [
        {
          userId: "u1",
          placement: 1,
          largestPot: 5000,
          bestHand: "Full House",
        },
        { userId: "u2", placement: 2 },
      ],
    };
    const first = recordMultiplayerMatch(database, "u1", payload);
    expect(first.processed).toBe(true);
    expect(first.deltas.map((item) => item.delta)).toEqual([16, -16]);
    expect(recordMultiplayerMatch(database, "u1", payload).processed).toBe(
      false,
    );
    const hub = getSocialCompetition(database, "u1").poker;
    expect(hub.self).toMatchObject({
      rating: 1016,
      wins: 1,
      largestPot: 5000,
      bestHand: "Full House",
    });
    expect(hub.leaderboard[1]).toMatchObject({
      userId: "u2",
      rating: 984,
      losses: 1,
    });
  });

  it("turnuvaya kayıt alır; sonuçta rating, kariyer ve kalıcı şampiyonluk üretir", () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString(),
      endsAt = new Date(Date.now() + 86400000).toISOString();
    const tournamentId = createTournament(database, "u1", {
      name: "Cuma Ana Masa",
      gameId: "poker",
      startsAt,
      endsAt,
    });
    joinTournament(database, "u1", tournamentId);
    joinTournament(database, "u2", tournamentId);
    recordTournamentResults(database, "u1", {
      tournamentId,
      placements: [
        { userId: "u2", placement: 1 },
        { userId: "u1", placement: 2 },
      ],
    });
    const tournament = getSocialCompetition(database, "u2").tournaments.find(
      (item) => item.id === tournamentId,
    );
    expect(tournament.status).toBe("completed");
    expect(tournament.results[0]).toMatchObject({
      userId: "u2",
      placement: 1,
      ratingDelta: 16,
    });
    expect(
      database
        .prepare(
          "SELECT tournament_wins FROM multiplayer_ratings WHERE user_id='u2' AND game_id='poker'",
        )
        .get().tournament_wins,
    ).toBe(1);
    expect(
      database
        .prepare("SELECT fame FROM player_careers WHERE user_id='u2'")
        .get().fame,
    ).toBe(250);
  });

  it("Number güvenli sınırını aşan mikro-PR değerlerinde rekabet ekranı ve rebuild hata vermez", () => {
    const hugeMicro = 50_128_537_358_526_800n;
    database
      .prepare(
        `UPDATE meta_player_accounts SET competitive_balance_micro=?,peak_competitive_balance_micro=?
        WHERE user_id='u1'`,
      )
      .run(hugeMicro, hugeMicro);
    database
      .prepare(
        "UPDATE player_careers SET comeback_anchor_micro=?,comeback_trough_micro=? WHERE user_id='u1'",
      )
      .run(hugeMicro, hugeMicro / 2n);
    settlement(database, {
      id: "round:huge",
      roundId: "huge",
      stake: 1,
      grossPayout: Number(hugeMicro) / 1_000_000,
    });

    expect(() => rebuildCompetitionSystem(database)).not.toThrow();
    const dashboard = getCompetitionDashboard(database, "u1");
    expect(dashboard.profile.account.competitiveBalance).toBeGreaterThan(
      Number.MAX_SAFE_INTEGER / 1_000_000,
    );
    expect(Number.isFinite(dashboard.leaderboards.wealth.self.score)).toBe(true);
  });
});
