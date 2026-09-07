import { accountRequest } from "../auth/auth-api";

export type MetaAggregate = {
  periodType: "lifetime" | "week" | "season";
  periodKey: string;
  scopeType: "casino" | "family" | "game";
  scopeId: string;
  rounds: number;
  wins: number;
  losses: number;
  pushes: number;
  wager: number;
  payout: number;
  netProfit: number;
  biggestPayout: number;
  biggestWin: number;
  maxMultiplier: number;
  firstSettledAt: string;
  lastSettledAt: string;
};

export type CompetitionStats = {
  currency: "PR";
  account: null | {
    startingBalance: number;
    competitiveBalance: number;
    peakCompetitiveBalance: number;
    updatedAt: string;
  };
  aggregates: MetaAggregate[];
};

export function getCompetitionStats() {
  return accountRequest<CompetitionStats>("/api/casino-data/competition/stats");
}

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  valueType: "PR" | "POINT" | "FAME" | "RATIO" | "DURATION";
  title: string | null;
};

export type LeaderboardSlice = {
  top: LeaderboardEntry[];
  self?: LeaderboardEntry;
  around: LeaderboardEntry[];
};

export type CompetitionDashboard = {
  generatedAt: string;
  season: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
    remainingMs: number;
  };
  profile: {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: string;
      avatarId: string;
      createdAt: string;
    };
    account: null | {
      startingBalance: number;
      competitiveBalance: number;
      peakBalance: number;
      growth: number;
    };
    career: {
      fame: number;
      titleId: string | null;
      title: string | null;
      championships: number;
      recordsBroken: number;
    };
    stats: {
      rounds: number;
      netProfit: number;
      biggestPayout: number;
      maxMultiplier: number;
      favoriteGameId: string | null;
      favoriteGame: string | null;
    };
    achievements: Array<{
      id: string;
      name: string;
      detail: string;
      rarity: string;
      fame: number;
      season_points: number;
      title_id: string | null;
      unlockedAt?: string;
    }>;
    mastery: Array<{
      game_id: string;
      gameLabel: string;
      xp: number;
      tier: string;
      rounds: number;
      best_multiplier: number;
    }>;
    showcase: Array<{
      slot: number;
      item_type: string;
      item_id: string;
      item: { itemType: string; itemId: string; label: string; detail: string };
    }>;
    showcaseCatalog: Array<{
      itemType: string;
      itemId: string;
      label: string;
      detail: string;
    }>;
    titles: Array<{
      titleId: string;
      name: string;
      rarity: string;
      unlockedAt: string;
      source: string;
    }>;
    recordsOwned: number;
    ownedRecords: Array<{
      gameId: string;
      gameLabel: string;
      metricId: string;
      metricLabel: string;
      value: number;
      achievedAt: string;
    }>;
    seasonHistory: Array<{
      rank: number;
      seasonPoints: number;
      netProfit: number;
      name: string;
      endsAt: string;
    }>;
    multiplayer: Array<{
      gameId: string;
      rating: number;
      wins: number;
      losses: number;
      draws: number;
      tournamentWins: number;
      finalTables: number;
      headsUpWins: number;
      largestPot: number;
      bestHand: string | null;
    }>;
    crown: { totalSeconds: number; longestSeconds: number; reigns: number };
  };
  leaderboards: Record<
    | "wealth"
    | "profit"
    | "seasonProfit"
    | "weekly"
    | "growth"
    | "crown"
    | "season"
    | "career",
    LeaderboardSlice
  >;
  crown: null | {
    user_id: string;
    displayName: string;
    acquired_at: string;
    balance: number;
  };
  rival: null | {
    weekKey: string;
    player?: {
      userId: string;
      displayName: string;
      balance: number;
      weeklyProfit: number;
      seasonPoints: number;
    };
    rival?: {
      userId: string;
      displayName: string;
      balance: number;
      weeklyProfit: number;
      seasonPoints: number;
    };
  };
  feed: Array<{
    id: string;
    user_id?: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    game_id?: string;
    occurred_at: string;
    displayName?: string;
  }>;
  records: Array<{
    game_id: string;
    gameLabel: string;
    metric_id: string;
    metric_label: string;
    displayName: string;
    user_id: string;
    value: number;
    achieved_at: string;
  }>;
  seasonRecords: CompetitionDashboard["records"];
  hall: {
    champions: Array<{
      season_id: string;
      seasonName: string;
      user_id: string;
      displayName: string;
      rank: number;
      season_points: number;
      netProfit: number;
    }>;
    crown: Array<{
      userId: string;
      displayName: string;
      totalSeconds: number;
      longestSeconds: number;
      reigns: number;
    }>;
    fame: Array<{ userId: string; displayName: string; score: number }>;
    recordHolders: Array<{
      userId: string;
      displayName: string;
      score: number;
    }>;
    biggestWin: null | {
      userId: string;
      displayName: string;
      payout: number;
      multiplier: number;
      gameId: string;
      settledAt: string;
    };
    highestMultiplier: null | {
      userId: string;
      displayName: string;
      multiplier: number;
      gameId: string;
      settledAt: string;
    };
    richestSnapshots: Array<{
      snapshotDate: string;
      userId: string;
      displayName: string;
      balance: number;
    }>;
    legendaryAchievements: Array<{
      userId: string;
      displayName: string;
      name: string;
      rarity: string;
      unlockedAt: string;
    }>;
    biggestComeback: null | {
      userId: string;
      displayName: string;
      anchor: number;
      trough: number;
      unlockedAt: string;
    };
    oldestRecord: null | {
      gameId: string;
      metricLabel: string;
      value: number;
      achievedAt: string;
      displayName: string;
      ageDays: number;
    };
    houseHistory: Array<{
      eventId: string;
      playersWon: number;
      playersNet: number;
      houseNet: number;
      participants: number;
      finalizedAt: string;
      name: string;
    }>;
    tournamentChampions: Array<{
      tournamentId: string;
      tournamentName: string;
      gameId: string;
      userId: string;
      displayName: string;
      fieldSize: number;
      ratingDelta: number;
      recordedAt: string;
    }>;
  };
  houseEvent: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    playersNet: number;
    houseNet: number;
    eligibleRounds: number;
    remainingMs: number;
  };
  snapshots: Array<{
    date: string;
    open: number;
    low: number;
    high: number;
    close: number;
  }>;
  passport: Array<{
    gameId: string;
    goalId: string;
    label: string;
    achievedAt: string;
  }>;
  newspaper: {
    weekKey: string;
    richest?: LeaderboardEntry;
    weeklyWinner?: LeaderboardEntry;
    biggestRecord?: CompetitionDashboard["records"][number];
    hotGame?: { gameId: string; count: number };
    biggestHit?: {
      userId: string;
      displayName: string;
      gameId: string;
      payout: number;
      multiplier: number;
      settledAt: string;
    };
    comeback?: {
      userId: string;
      displayName: string;
      anchor: number;
      trough: number;
      unlockedAt: string;
    };
    closestRace?: {
      userId: string;
      displayName: string;
      rivalUserId: string;
      rivalName: string;
      gap: number;
    };
  };
  social: SocialCompetition;
  config: {
    titles: Array<{ id: string; name: string; rarity: string }>;
    games: Record<string, { family: string; label: string }>;
    passportGoals: Array<{ id: string; label: string }>;
    runtime: import("./competition-admin-api").CompetitionRuntimeConfig;
    future: {
      clubs: boolean;
      multiplayerRatings: boolean;
      tournaments: boolean;
    };
  };
};

export type PokerRatingEntry = {
  userId: string;
  displayName: string;
  avatarId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  tournamentWins: number;
  finalTables: number;
  headsUpWins: number;
  largestPot: number;
  bestHand: string | null;
  rank: number;
};

export type SocialCompetition = {
  clubs: {
    event: {
      id: string;
      name: string;
      startsAt: string;
      endsAt: string;
      perPlayerCap: number;
      remainingMs: number;
    };
    clubs: Array<{
      id: string;
      name: string;
      tag: string;
      createdBy: string;
      members: number;
      lifetimeScore: number;
    }>;
    standings: Array<{
      clubId: string;
      name: string;
      tag: string;
      score: number;
      members: number;
      rank: number;
    }>;
    myClub: null | {
      clubId: string;
      name: string;
      tag: string;
      role: string;
      contributionPoints: number;
      weeklyScore: number;
      weeklyRank: number | null;
      myWeeklyScore: number;
      members: Array<{
        userId: string;
        displayName: string;
        avatarId: string;
        role: string;
        contributionPoints: number;
        weeklyScore: number;
      }>;
    };
    history: Array<{
      eventId: string;
      clubId: string;
      name: string;
      tag: string;
      rank: number;
      score: number;
      members: number;
      recordedAt: string;
    }>;
  };
  poker: {
    leaderboard: PokerRatingEntry[];
    self: PokerRatingEntry | null;
    history: Array<{
      match_id: string;
      user_id: string;
      displayName: string;
      rating_before: number;
      rating_after: number;
      delta: number;
      placement: number;
      recorded_at: string;
      source: string;
    }>;
  };
  tournaments: Array<{
    id: string;
    name: string;
    gameId: string;
    status: string;
    startsAt: string;
    endsAt: string;
    buyIn: number;
    creatorName: string;
    entrants: number;
    joined: boolean;
    entries: Array<{
      userId: string;
      displayName: string;
      avatarId: string;
      joinedAt: string;
    }>;
    results: Array<{
      userId: string;
      displayName: string;
      avatarId: string;
      placement: number;
      fieldSize: number;
      ratingDelta: number;
      recordedAt: string;
    }>;
  }>;
};

export async function getCompetitionDashboard() {
  try {
    return await accountRequest<CompetitionDashboard>(
      "/api/casino-data/competition/dashboard",
    );
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status && status < 500) throw error;
    // A short retry absorbs transient proxy/SQLite contention instead of
    // leaving the competition screen permanently empty until a full reload.
    await new Promise((resolve) => setTimeout(resolve, 450));
    return accountRequest<CompetitionDashboard>(
      "/api/casino-data/competition/dashboard",
    );
  }
}

export function setCompetitionTitle(titleId: string) {
  return accountRequest<{ ok: true }>("/api/casino-data/competition/title", {
    method: "POST",
    body: JSON.stringify({ titleId }),
  });
}

export type PublicCompetitionProfile = {
  profile: CompetitionDashboard["profile"];
  ranks: {
    wealth?: LeaderboardEntry;
    season?: LeaderboardEntry;
    career?: LeaderboardEntry;
  };
  isSelf: boolean;
};

export function getCompetitionProfile(userId: string) {
  return accountRequest<PublicCompetitionProfile>(
    `/api/casino-data/competition/profile/${encodeURIComponent(userId)}`,
  );
}

export function setCompetitionShowcase(
  items: Array<{ itemType: string; itemId: string }>,
) {
  return accountRequest<{ ok: true }>("/api/casino-data/competition/showcase", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function setCompetitionAvatar(avatarId: string) {
  return accountRequest<{ ok: true; avatarId: string }>("/api/me/avatar", {
    method: "POST",
    body: JSON.stringify({ avatarId }),
  });
}

export function uploadCompetitionAvatar(dataUrl: string) {
  return accountRequest<{
    ok: true;
    avatarId: "custom";
    version: string;
    width: number;
    height: number;
  }>("/api/me/avatar-upload", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
}

export function createCompetitionClub(name: string, tag: string) {
  return accountRequest<{
    ok: true;
    clubId: string;
    dashboard: CompetitionDashboard;
  }>("/api/casino-data/competition/clubs/create", {
    method: "POST",
    body: JSON.stringify({ name, tag }),
  });
}

export function joinCompetitionClub(clubId: string) {
  return accountRequest<{ ok: true; dashboard: CompetitionDashboard }>(
    "/api/casino-data/competition/clubs/join",
    { method: "POST", body: JSON.stringify({ clubId }) },
  );
}

export function leaveCompetitionClub() {
  return accountRequest<{ ok: true; dashboard: CompetitionDashboard }>(
    "/api/casino-data/competition/clubs/leave",
    { method: "POST", body: "{}" },
  );
}

export function joinCompetitionTournament(tournamentId: string) {
  return accountRequest<{ ok: true; dashboard: CompetitionDashboard }>(
    "/api/casino-data/competition/tournaments/join",
    { method: "POST", body: JSON.stringify({ tournamentId }) },
  );
}
