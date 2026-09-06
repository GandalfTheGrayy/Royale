import {
  advanceRandomState,
  applyOptionToState,
  generateRandomState,
  selectDecisionContext,
  SessionManager,
  toSnapshotEnvelope,
  toTurnEventEnvelope,
  type PersonaArchetype,
  type PlayerOption,
  type RandomStateSummary,
  type SeatBootstrapConfig,
  type SessionConfig,
} from "poker-engine-ts";
import { evaluatePokerHand, type PokerCard } from "./poker-cards";

export type PokerBotProfile = {
  id: string;
  name: string;
  monogram: string;
  style: PersonaArchetype;
  tell: string;
  color: string;
  bankroll: number;
};

export const POKER_BOTS: PokerBotProfile[] = [
  { id: "aslan", name: "Aslan", monogram: "AS", style: "tight-aggressive", tell: "Sessiz oynar, güçlü yerde baskıyı artırır.", color: "#c79045", bankroll: 120_000 },
  { id: "derya", name: "Derya", monogram: "DE", style: "loose-aggressive", tell: "Bol pot görür; blöfü ritminden okunur.", color: "#aa5578", bankroll: 250_000 },
  { id: "atlas", name: "Atlas", monogram: "AT", style: "balanced", tell: "Pozisyonu sever, gereksiz kahramanlık yapmaz.", color: "#4e86a7", bankroll: 180_000 },
  { id: "nazan", name: "Nazan", monogram: "NZ", style: "exploitative", tell: "Masayı izler, tekrar eden hatayı cezalandırır.", color: "#7d68a9", bankroll: 400_000 },
  { id: "kuzey", name: "Kuzey", monogram: "KZ", style: "tight-passive", tell: "Uzun bekler; pota girdiğinde dikkat ister.", color: "#527e69", bankroll: 90_000 },
  { id: "jale", name: "Jale", monogram: "JL", style: "loose-passive", tell: "Flop görmeyi sever, baskıda kolay vazgeçer.", color: "#b26b4c", bankroll: 160_000 },
  { id: "baran", name: "Baran", monogram: "BR", style: "tight-aggressive", tell: "Kısa konuşur, keskin üçlü bahisleri sever.", color: "#65728f", bankroll: 320_000 },
  { id: "seda", name: "Seda", monogram: "SD", style: "exploitative", tell: "Bahis boyunu hafızasında tutar.", color: "#9a8052", bankroll: 500_000 },
];

export type PokerTableSetup = {
  botCount: number;
  buyIn: number;
  smallBlind: number;
  bigBlind: number;
  buttonIndex?: number;
  stacks?: Record<string, number>;
};

export interface PokerSessionTransport {
  readonly kind: "local" | "remote";
  create(setup: PokerTableSetup): Promise<RandomStateSummary>;
  applyPlayerAction(
    state: RandomStateSummary,
    actor: string,
    option: PlayerOption,
    amount?: number,
  ): Promise<RandomStateSummary>;
  advanceBot(state: RandomStateSummary): Promise<RandomStateSummary>;
}

function maxSeatsFor(count: number): 2 | 6 | 9 {
  if (count <= 2) return 2;
  if (count <= 6) return 6;
  return 9;
}

function buildSessionConfig(setup: PokerTableSetup): SessionConfig {
  const bots = Math.min(8, Math.max(1, Math.round(setup.botCount)));
  const overrides = Object.fromEntries(
    POKER_BOTS.slice(0, bots).map((bot) => [bot.id, bot.style]),
  );
  return {
    tableVariant: "texas-holdem",
    bettingStructure: "no-limit",
    maxSeats: maxSeatsFor(bots + 1),
    startingStack: setup.buyIn,
    blindSchedule: [
      { level: 1, smallBlind: setup.smallBlind, bigBlind: setup.bigBlind },
    ],
    personaPolicy: { defaultStyle: "balanced", overrides },
    ruleSet: {
      streets: ["preflop", "flop", "turn", "river", "showdown"],
      postingOrder: ["small-blind", "big-blind"],
      minRaisePolicy: "double-last-bet",
      showdownOrdering: "high-card",
      cardDistribution: {
        holeCardsPerPlayer: 2,
        burnPerStreet: [1, 1, 1],
        communityReveal: [0, 3, 1, 1],
      },
    },
    evaluationPolicy: {
      engine: "lookup-table",
      evaluatorId: "default",
      supportsHiLo: false,
      cacheSize: 2048,
    },
    autoAdvance: true,
  };
}

function buildSeats(setup: PokerTableSetup): SeatBootstrapConfig[] {
  const bots = POKER_BOTS.slice(0, Math.min(8, Math.max(1, setup.botCount)));
  return [
    {
      playerId: "muharrem",
      displayName: "Muharrem",
      seatIndex: 0,
      stack: setup.stacks?.muharrem ?? setup.buyIn,
    },
    ...bots.map((bot, index) => ({
      playerId: bot.id,
      displayName: bot.name,
      personaId: bot.id,
      seatIndex: index + 1,
      stack: setup.stacks?.[bot.id] ?? setup.buyIn,
    })),
  ].filter((seat) => seat.stack > 0);
}

function preflopStrength(cards: readonly PokerCard[]) {
  if (cards.length < 2) return 0.35;
  const rank = (card: PokerCard) => "23456789TJQKA".indexOf(card[0]) + 2;
  const high = Math.max(rank(cards[0]), rank(cards[1]));
  const low = Math.min(rank(cards[0]), rank(cards[1]));
  if (high === low) return Math.min(0.98, 0.5 + high / 28);
  const suited = cards[0][1] === cards[1][1] ? 0.07 : 0;
  const connected = Math.max(0, 0.07 - Math.abs(high - low) * 0.015);
  return Math.min(0.9, high / 20 + low / 55 + suited + connected);
}

function visibleStrength(state: RandomStateSummary, actor: string) {
  const snapshot = state.session.activeSnapshot;
  const hole = (snapshot.cards.holeCards[actor] ?? []) as PokerCard[];
  const board = [
    ...(snapshot.cards.community.flop ?? []),
    snapshot.cards.community.turn,
    snapshot.cards.community.river,
  ].filter(Boolean) as PokerCard[];
  if (hole.length + board.length >= 5) {
    const evaluation = evaluatePokerHand([...hole, ...board]);
    const categoryStrength = [0.24, 0.5, 0.65, 0.74, 0.8, 0.84, 0.9, 0.96, 0.995][evaluation.category] ?? 0.24;
    return Math.min(1, categoryStrength + (evaluation.score[1] ?? 0) / 260);
  }
  return preflopStrength(hole);
}

function chooseBotOption(state: RandomStateSummary): PlayerOption | undefined {
  const actor = state.decision.actor;
  if (!actor) return undefined;
  const available = state.decision.availableActions.filter((option) => !option.disabled);
  const find = (type: PlayerOption["type"]) => available.find((option) => option.type === type);
  const profile = POKER_BOTS.find((bot) => bot.id === actor);
  const temperament = {
    "tight-aggressive": { aggression: 0.68, looseness: 0.34 },
    "loose-aggressive": { aggression: 0.82, looseness: 0.7 },
    balanced: { aggression: 0.55, looseness: 0.5 },
    exploitative: { aggression: 0.63, looseness: 0.52 },
    "tight-passive": { aggression: 0.28, looseness: 0.28 },
    "loose-passive": { aggression: 0.25, looseness: 0.72 },
  }[profile?.style ?? "balanced"];
  const strength = visibleStrength(state, actor);
  const seat = state.session.activeSnapshot.seating.seats.find((entry) => entry?.occupant?.playerId === actor);
  const bigBlind = state.session.config.blindSchedule[0]?.bigBlind ?? 1;
  const shortStack = (seat?.stack ?? 0) <= bigBlind * 6;
  const heroEvents = state.session.events
    .map((envelope) => envelope.event)
    .filter((event) => event.actor === "muharrem");
  const heroAggression = heroEvents.length
    ? heroEvents.filter((event) => event.action.type === "bet" || event.action.type === "raise" || event.action.type === "all-in").length / heroEvents.length
    : 0.35;
  const random = Math.random();
  const allIn = find("all-in");
  if (allIn && (shortStack || strength > 0.94) && random < (shortStack ? 0.58 : 0.16)) return allIn;
  const raise = find("raise") ?? find("bet");
  if (raise && strength > 0.58 && random < temperament.aggression * (0.35 + strength * 0.45)) return raise;
  const check = find("check");
  if (check && (strength < 0.55 || random > temperament.aggression)) return check;
  const call = find("call");
  if (call?.type === "call") {
    const pot = Math.max(bigBlind, state.decision.potSize ?? 0);
    const potOdds = call.amount / Math.max(1, pot + call.amount);
    const stackPressure = call.amount / Math.max(1, (seat?.stack ?? 0) + call.amount);
    const readsFrequentPressure = (profile?.style === "exploitative" || profile?.style === "loose-aggressive")
      ? heroAggression * 0.16
      : heroAggression * 0.06;
    const callScore = strength + temperament.looseness * 0.2 + readsFrequentPressure + random * 0.15;
    const required = 0.34 + potOdds * 0.42 + stackPressure * 0.28;
    if (callScore >= required) return call;
  }
  return find("fold") ?? check ?? call ?? raise ?? allIn;
}

export const localPokerTransport: PokerSessionTransport = {
  kind: "local",
  async create(setup) {
    return generateRandomState({
      config: buildSessionConfig(setup),
      seats: buildSeats(setup),
      steps: { min: 0, max: 0 },
      managerOptions: { buttonIndex: setup.buttonIndex ?? 0 },
    });
  },
  async applyPlayerAction(state, actor, option, selectedAmount) {
    const manager = SessionManager.resume({
      sessionId: state.session.id,
      config: state.session.config,
      runtimeContext: state.session.runtimeContext,
      initialSnapshot: state.session.initialSnapshot,
      events: state.session.events,
      metrics: state.session.metrics,
      channels: state.session.channels,
    });
    const amount = Math.max(0, selectedAmount ?? ("amount" in option ? option.amount : "min" in option ? option.min : 0));
    const requested =
      option.type === "fold" || option.type === "check"
        ? { type: option.type }
        : option.type === "call"
          ? { type: "call" as const, amount: option.amount }
          : option.type === "bet"
            ? { type: "bet" as const, amount }
            : option.type === "raise"
              ? { type: "raise" as const, amount }
              : {
                  type: "all-in" as const,
                  amount: option.amount,
                  from: manager.session.activeSnapshot.hand.bettingRounds.at(-1)?.highestBet ? ("raise" as const) : ("bet" as const),
                };
    const result = await manager.applyIntent({
      id: `muharrem-${Date.now()}-${option.type}`,
      actor,
      requested,
      origin: "ui",
      issuedAt: Date.now(),
      expectedSnapshotVersion: manager.session.activeSnapshot.index,
    });
    if (result.validation.kind !== "accepted")
      throw new Error(`Poker aksiyonu reddedildi: ${result.validation.reason}`);
    const session = manager.session;
    return {
      session: {
        id: session.id,
        config: session.config,
        runtimeContext: session.runtimeContext,
        initialSnapshot: toSnapshotEnvelope(session.initialSnapshot),
        activeSnapshot: session.activeSnapshot,
        metrics: session.metrics,
        channels: session.channels,
        events: session.events.map(toTurnEventEnvelope),
      },
      decision: selectDecisionContext(session),
      stepsApplied: 1,
    };
  },
  async advanceBot(state) {
    const actor = state.decision.actor;
    if (!actor) return advanceRandomState(state.session, { steps: { min: 1, max: 1 } });
    try {
      const option = chooseBotOption(state);
      if (option) return await applyOptionToState(state.session, actor, option);
    } catch {
      // Persona kararı bozulursa el aynı snapshot'ta takılmasın.
    }
    return advanceRandomState(state.session, { steps: { min: 1, max: 1 } });
  },
};

/**
 * İleride online masaya geçildiğinde PokerRoom değişmeden kalır; yalnızca bu
 * transport seçilir. Sunucu otoriter state/event log döndürür, istemci kapalı
 * kartları ve bot kararlarını üretmez.
 */
export class HttpPokerTransport implements PokerSessionTransport {
  readonly kind = "remote" as const;
  constructor(private readonly endpoint: string) {}

  private async request(path: string, body: unknown) {
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Poker sunucusu ${response.status}`);
    return (await response.json()) as RandomStateSummary;
  }

  create(setup: PokerTableSetup) {
    return this.request("/sessions", { setup });
  }

  applyPlayerAction(state: RandomStateSummary, actor: string, option: PlayerOption, amount?: number) {
    return this.request(`/sessions/${state.session.id}/actions`, {
      expectedVersion: state.session.activeSnapshot.index,
      actor,
      option,
      amount,
    });
  }

  advanceBot(state: RandomStateSummary) {
    return this.request(`/sessions/${state.session.id}/advance-bot`, {
      expectedVersion: state.session.activeSnapshot.index,
    });
  }
}
