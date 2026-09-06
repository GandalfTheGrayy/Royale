import { accountRequest } from "../auth/auth-api";
import type { CompetitionDashboard } from "./meta-api";

export type CompetitionRuntimeConfig = {
  version: number;
  economy: { startingPiar: number };
  season: { durationDays: number; nameTemplate: string };
  schedule: { timeZone: string };
  scoring: {
    fiveX: number;
    tenX: number;
    twentyFiveX: number;
    hundredX: number;
    casinoRecord: number;
    rivalVictory: number;
    rivalFame: number;
  };
  thresholds: {
    tenX: number;
    hundredX: number;
    leviathan: number;
    sugarCascade: number;
    neonMultiplier: number;
    minesTiles: number;
    pilotCashout: number;
    comebackDropRatio: number;
  };
  mastery: { silver: number; gold: number; diamond: number; legendary: number };
  milestones: Array<{ value: number; titleId: string }>;
  records: Record<string, boolean>;
  playersVsHouse: { enabled: boolean; rewardAchievement: string };
  eligibility: { excludedUserIds: string[] };
  feed: {
    enabled: boolean;
    limit: number;
    repeatWindowMinutes: number;
    bigHitMultiplier: number;
    legendaryHitMultiplier: number;
    winningStreak: number;
  };
  leaderboards: Record<string, boolean>;
};

export type CompetitionAdminState = {
  config: CompetitionRuntimeConfig;
  defaults: CompetitionRuntimeConfig;
  season: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
    status: string;
  };
  achievements: Array<{
    id: string;
    name: string;
    detail: string;
    rarity: string;
    fame: number;
    seasonPoints: number;
    titleId: string | null;
  }>;
  settlements: Array<{
    eventId: string;
    roundId: string;
    userId: string;
    displayName: string;
    gameId: string;
    settledAt: string;
    wager: number;
    payout: number;
    multiplier: number;
    outcome: string;
    invalidatedAt?: string;
    invalidationReason?: string;
  }>;
  houseHistory: Array<{
    event_id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    players_won: number;
    playersNet: number;
    houseNet: number;
    participants: number;
    finalized_at: string;
  }>;
  rivalHistory: Array<{
    week_key: string;
    user_id: string;
    displayName: string;
    rival_user_id: string;
    rivalName: string;
    playerProfit: number;
    rivalProfit: number;
    result: string;
    season_points: number;
    fame: number;
  }>;
  audit: Array<{
    id: string;
    actor_user_id: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    reason?: string;
    occurred_at: string;
  }>;
  telemetry: Array<{
    gameId: string;
    label: string;
    rounds: number;
    audited: number;
    complete: number;
    status: "healthy" | "warning" | "legacy" | "no-data";
    missing: Array<{ field: string; count: number }>;
  }>;
  users: Array<{
    id: string;
    displayName: string;
    role: string;
    avatarId: string;
  }>;
};

export const getCompetitionAdminState = () =>
  accountRequest<CompetitionAdminState>("/api/casino-data/competition/admin");
export const saveCompetitionAdminConfig = (payload: {
  config: CompetitionRuntimeConfig;
  achievements: CompetitionAdminState["achievements"];
  season: { name: string; endsAt: string };
  reason: string;
}) =>
  accountRequest<{ ok: true; state: CompetitionAdminState }>(
    "/api/casino-data/competition/admin/config",
    { method: "POST", body: JSON.stringify(payload) },
  );
export const invalidateCompetitionRound = (eventId: string, reason: string) =>
  accountRequest<{ ok: true; state: CompetitionAdminState }>(
    "/api/casino-data/competition/admin/invalidate",
    { method: "POST", body: JSON.stringify({ eventId, reason }) },
  );
export const createCompetitionTournament = (payload: {
  name: string;
  gameId: string;
  startsAt: string;
  endsAt: string;
  buyIn: number;
}) =>
  accountRequest<{
    ok: true;
    tournamentId: string;
    dashboard: CompetitionDashboard;
  }>("/api/casino-data/competition/admin/tournaments/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const settleCompetitionTournament = (
  tournamentId: string,
  placements: Array<{
    userId: string;
    placement: number;
    largestPot?: number;
    bestHand?: string;
  }>,
) =>
  accountRequest<{ ok: true; dashboard: CompetitionDashboard }>(
    "/api/casino-data/competition/admin/tournaments/results",
    { method: "POST", body: JSON.stringify({ tournamentId, placements }) },
  );
export const recordVerifiedPokerMatch = (payload: {
  matchId: string;
  participants: Array<{
    userId: string;
    placement: number;
    largestPot?: number;
    bestHand?: string;
  }>;
}) =>
  accountRequest<{ ok: true; dashboard: CompetitionDashboard }>(
    "/api/casino-data/competition/admin/matches",
    {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        gameId: "poker",
        source: "admin-verified",
      }),
    },
  );
