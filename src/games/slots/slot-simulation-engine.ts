import type { AdminGameSettings } from "../../data/casino-admin";
import type { CasinoGameId } from "../../data/casino-database";
import {
  advanceFisherBonus,
  createFisherBonus,
  spinFisher,
} from "./fisherman-engine";
import {
  emptySekerhaneSpots,
  runSekerhaneSpin,
  type SekerhaneSpot,
} from "./sekerhane-engine";
import { runNeonSpin } from "./neon-engine";
import {
  createSlotFlowState,
  planSlotFlow,
  settleSlotFlow,
  type SlotFlowState,
} from "./slot-flow-engine";

export type SimulatableSlotId = Extract<
  CasinoGameId,
  "kaptan-mercan" | "neon-kasasi" | "sekerhane-1024"
>;

export type SlotSimulationMode = "paid-spins" | "bonus-sessions";

export type SlotSimulationRequest = {
  gameId: SimulatableSlotId;
  mode: SlotSimulationMode;
  runs: number;
  wager: number;
  seed?: number;
};

export type SlotSimulationReport = {
  gameId: SimulatableSlotId;
  mode: SlotSimulationMode;
  requestedRuns: number;
  paidSpins: number;
  bonusSessions: number;
  freeSpins: number;
  totalStake: number;
  totalPayout: number;
  rtp: number;
  hitRate: number;
  bonusRate: number;
  retriggerEvents: number;
  extraSpins: number;
  averageBonusLength: number;
  maxBonusLength: number;
  cappedSessions: number;
  truncatedSessions: number;
  visiblePotentialEvents: number;
  wins10x: number;
  wins25x: number;
  wins50x: number;
  wins100x: number;
  maxWinX: number;
  payoutBands: Record<"zero" | "under1" | "oneTo2" | "twoTo5" | "fiveTo10" | "tenTo50" | "fiftyTo100" | "hundredPlus", number>;
  p50WinX: number;
  p90WinX: number;
  p95WinX: number;
  p99WinX: number;
  standardDeviationX: number;
  maxLossStreak: number;
  durationMs: number;
};

type MutableReport = Omit<
  SlotSimulationReport,
  "rtp" | "hitRate" | "bonusRate" | "averageBonusLength" | "durationMs" |
  "payoutBands" | "p50WinX" | "p90WinX" | "p95WinX" | "p99WinX" | "standardDeviationX"
> & {
  hits: number;
  measuredSpins: number;
  bonusLengths: number[];
  payoutMultiples: number[];
  currentLossStreak: number;
  onSession?: (session: SlotSessionObservation) => void;
};

export type SlotSessionObservation = { stake: number; payout: number; bonusRounds: number; bonusSessions: number; retriggers: number; potentialEvents: number };
const sessionStart = (report: MutableReport) => ({ payout: report.totalPayout, free: report.freeSpins, bonus: report.bonusSessions, retrigger: report.retriggerEvents, potential: report.visiblePotentialEvents });
function sessionEnd(report: MutableReport, before: ReturnType<typeof sessionStart>, stake: number) {
  report.onSession?.({ stake, payout: report.totalPayout - before.payout, bonusRounds: report.freeSpins - before.free,
    bonusSessions: report.bonusSessions - before.bonus, retriggers: report.retriggerEvents - before.retrigger, potentialEvents: report.visiblePotentialEvents - before.potential });
}

function seeded(seed = 0x4d455243) {
  let value = seed >>> 0;
  const unit = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
  return {
    unit,
    index: (maximum: number) =>
      Math.floor(unit() * Math.max(1, Math.floor(maximum))),
  };
}

function blank(request: SlotSimulationRequest): MutableReport {
  return {
    gameId: request.gameId,
    mode: request.mode,
    requestedRuns: request.runs,
    paidSpins: 0,
    bonusSessions: 0,
    freeSpins: 0,
    totalStake: 0,
    totalPayout: 0,
    retriggerEvents: 0,
    extraSpins: 0,
    maxBonusLength: 0,
    cappedSessions: 0,
    truncatedSessions: 0,
    visiblePotentialEvents: 0,
    wins10x: 0,
    wins25x: 0,
    wins50x: 0,
    wins100x: 0,
    maxWinX: 0,
    maxLossStreak: 0,
    hits: 0,
    measuredSpins: 0,
    bonusLengths: [],
    payoutMultiples: [],
    currentLossStreak: 0,
  };
}

function measure(report: MutableReport, payout: number, wager: number) {
  const multiple = wager > 0 ? payout / wager : 0;
  report.totalPayout += payout;
  report.measuredSpins += 1;
  report.payoutMultiples.push(multiple);
  if (payout > 0) report.hits += 1;
  if (multiple < 1) {
    report.currentLossStreak += 1;
    report.maxLossStreak = Math.max(report.maxLossStreak, report.currentLossStreak);
  } else report.currentLossStreak = 0;
  if (multiple >= 10) report.wins10x += 1;
  if (multiple >= 25) report.wins25x += 1;
  if (multiple >= 50) report.wins50x += 1;
  if (multiple >= 100) report.wins100x += 1;
  report.maxWinX = Math.max(report.maxWinX, multiple);
}

function settle(
  state: SlotFlowState,
  decision: ReturnType<typeof planSlotFlow>,
  payout: number,
  wager: number,
  bonusTriggered: boolean,
  eventOccurred: boolean,
  game: AdminGameSettings,
) {
  return settleSlotFlow(
    state,
    decision,
    {
      grossMultiple: wager ? payout / wager : 0,
      bonusTriggered,
      eventOccurred,
    },
    game.slot!.flow,
  );
}

function fisherSimulation(
  request: SlotSimulationRequest,
  game: AdminGameSettings,
  report: MutableReport,
  random: ReturnType<typeof seeded>,
) {
  const slot = game.slot!;
  const tuning = { ...slot.math, valueWeights: slot.valueWeights };
  let flowState = createSlotFlowState();

  const playBonus = (initial = slot.math.bonusBuySpins || 15, source: "natural" | "buy" = "buy") => {
    report.bonusSessions += 1;
    let state = createFisherBonus(
      `sim-${report.bonusSessions}`,
      initial,
      source,
      {},
      tuning,
    );
    let sessionSpins = 0;
    let sessionCapped = false;
    const hardLimit = Math.max(10, slot.math.maxBonusSessionSpins || 60);
    while (state.spinsRemaining > 0 && sessionSpins < hardLimit) {
      const before = flowState;
      const decision = planSlotFlow(
        before,
        slot.flow,
        slot.potential,
        { bonusMode: true, lastBonusSpin: state.spinsRemaining === 1 },
        random.unit,
      );
      const result = spinFisher(request.wager, {
        bonus: true,
        bonusMultiplier: state.multiplier,
        bonusModifiers: state.modifiers,
        tuning,
        flow: decision,
        potential: slot.potential,
        random: random.unit,
      });
      measure(report, result.grossPayout, request.wager);
      report.freeSpins += 1;
      report.visiblePotentialEvents += result.potentialCells?.length ? 1 : 0;
      const progress = advanceFisherBonus(state, result, tuning);
      sessionCapped ||= progress.sessionCapped;
      if (progress.scatterExtra > 0) report.retriggerEvents += 1;
      report.extraSpins += progress.extraSpins;
      state = progress.state;
      sessionSpins += 1;
      flowState = settle(
        before,
        decision,
        result.grossPayout,
        request.wager,
        result.scatterCount >= 3,
        result.grossPayout > 0 || result.fishValues.length > 0,
        game,
      );
    }
    if (state.spinsRemaining > 0 || sessionCapped) report.cappedSessions += 1;
    if (state.spinsRemaining > 0) report.truncatedSessions += 1;
    report.bonusLengths.push(sessionSpins);
    report.maxBonusLength = Math.max(report.maxBonusLength, sessionSpins);
  };

  if (request.mode === "bonus-sessions") {
    report.totalStake =
      request.runs * request.wager * Math.max(1, slot.math.bonusBuyX);
    for (let run = 0; run < request.runs; run += 1) {
      const start = sessionStart(report); playBonus();
      sessionEnd(report, start, request.wager * Math.max(1, slot.math.bonusBuyX));
    }
    return;
  }

  for (let run = 0; run < request.runs; run += 1) {
    const start = sessionStart(report);
    const before = flowState;
    const decision = planSlotFlow(
      before,
      slot.flow,
      slot.potential,
      {},
      random.unit,
    );
    const result = spinFisher(request.wager, {
      tuning,
      flow: decision,
      potential: slot.potential,
      random: random.unit,
    });
    report.paidSpins += 1;
    report.totalStake += request.wager;
    measure(report, result.grossPayout, request.wager);
    report.visiblePotentialEvents += result.potentialCells?.length ? 1 : 0;
    flowState = settle(
      before,
      decision,
      result.grossPayout,
      request.wager,
      result.bonusSpins > 0,
      result.grossPayout > 0 || result.fishValues.length > 0,
      game,
    );
    if (result.bonusSpins > 0) playBonus(result.bonusSpins, "natural");
    sessionEnd(report, start, request.wager);
  }
}

function sekerhaneSimulation(
  request: SlotSimulationRequest,
  game: AdminGameSettings,
  report: MutableReport,
  random: ReturnType<typeof seeded>,
) {
  const slot = game.slot!;
  const profile = { ...slot.math, valueWeights: slot.valueWeights };
  let flowState = createSlotFlowState();
  const playBonus = (initial = slot.math.bonusBuySpins || 10) => {
    report.bonusSessions += 1;
    let remaining = initial;
    let spots: SekerhaneSpot[][] = emptySekerhaneSpots();
    let length = 0;
    const hardLimit = 500;
    while (remaining > 0 && length < hardLimit) {
      const before = flowState;
      const decision = planSlotFlow(before, slot.flow, slot.potential, {
        bonusMode: true,
        lastBonusSpin: remaining === 1,
      }, random.unit);
      const result = runSekerhaneSpin(request.wager, random.index, {
        bonusMode: true,
        spots,
        profile,
        flow: decision,
        potential: slot.potential,
      });
      measure(report, result.grossReturn, request.wager);
      report.freeSpins += 1;
      const awarded = result.freeSpinsAwarded;
      if (awarded > 0) {
        report.retriggerEvents += 1;
        report.extraSpins += awarded;
      }
      remaining = remaining - 1 + awarded;
      spots = result.finalSpots;
      length += 1;
      flowState = settle(before, decision, result.grossReturn, request.wager, awarded > 0, result.cascades.length > 0, game);
    }
    if (remaining > 0) report.cappedSessions += 1;
    if (remaining > 0) report.truncatedSessions += 1;
    report.bonusLengths.push(length);
    report.maxBonusLength = Math.max(report.maxBonusLength, length);
  };
  if (request.mode === "bonus-sessions") {
    report.totalStake = request.runs * request.wager * Math.max(1, slot.math.bonusBuyX);
    for (let run = 0; run < request.runs; run += 1) {
      const start = sessionStart(report); playBonus();
      sessionEnd(report, start, request.wager * Math.max(1, slot.math.bonusBuyX));
    }
    return;
  }
  for (let run = 0; run < request.runs; run += 1) {
    const start = sessionStart(report);
    const before = flowState;
    const decision = planSlotFlow(before, slot.flow, slot.potential, {}, random.unit);
    const result = runSekerhaneSpin(request.wager, random.index, { profile, flow: decision, potential: slot.potential });
    report.paidSpins += 1;
    report.totalStake += request.wager;
    measure(report, result.grossReturn, request.wager);
    report.visiblePotentialEvents += result.potentialCells?.length ? 1 : 0;
    flowState = settle(before, decision, result.grossReturn, request.wager, result.freeSpinsAwarded > 0, result.cascades.length > 0, game);
    if (result.freeSpinsAwarded > 0) playBonus(result.freeSpinsAwarded);
    sessionEnd(report, start, request.wager);
  }
}

function neonSimulation(
  request: SlotSimulationRequest,
  game: AdminGameSettings,
  report: MutableReport,
  random: ReturnType<typeof seeded>,
) {
  const slot = game.slot!;
  const tuning = { ...slot.math, valueWeights: slot.valueWeights };
  let flowState = createSlotFlowState();
  const playBonus = (initial = slot.math.bonusBuySpins || 15) => {
    report.bonusSessions += 1;
    let remaining = initial;
    let multiplier = 0;
    let length = 0;
    const hardLimit = 500;
    while (remaining > 0 && length < hardLimit) {
      const before = flowState;
      const decision = planSlotFlow(before, slot.flow, slot.potential, {
        bonusMode: true,
        lastBonusSpin: remaining === 1,
      }, random.unit);
      const result = runNeonSpin(request.wager, random.index, {
        bonusMode: true,
        bonusMultiplier: multiplier,
        tuning,
        flow: decision,
        potential: slot.potential,
      });
      measure(report, result.grossReturn, request.wager);
      report.freeSpins += 1;
      if (result.freeSpinsAwarded > 0) {
        report.retriggerEvents += 1;
        report.extraSpins += result.freeSpinsAwarded;
      }
      remaining = remaining - 1 + result.freeSpinsAwarded;
      multiplier = result.finalBonusMultiplier;
      length += 1;
      flowState = settle(before, decision, result.grossReturn, request.wager, result.freeSpinsAwarded > 0, result.cascades.length > 0, game);
    }
    if (remaining > 0) report.cappedSessions += 1;
    if (remaining > 0) report.truncatedSessions += 1;
    report.bonusLengths.push(length);
    report.maxBonusLength = Math.max(report.maxBonusLength, length);
  };
  if (request.mode === "bonus-sessions") {
    report.totalStake = request.runs * request.wager * Math.max(1, slot.math.bonusBuyX);
    for (let run = 0; run < request.runs; run += 1) {
      const start = sessionStart(report); playBonus();
      sessionEnd(report, start, request.wager * Math.max(1, slot.math.bonusBuyX));
    }
    return;
  }
  for (let run = 0; run < request.runs; run += 1) {
    const start = sessionStart(report);
    const before = flowState;
    const decision = planSlotFlow(before, slot.flow, slot.potential, {}, random.unit);
    const result = runNeonSpin(request.wager, random.index, { tuning, flow: decision, potential: slot.potential });
    report.paidSpins += 1;
    report.totalStake += request.wager;
    measure(report, result.grossReturn, request.wager);
    report.visiblePotentialEvents += result.potentialCells?.length ? 1 : 0;
    flowState = settle(before, decision, result.grossReturn, request.wager, result.freeSpinsAwarded > 0, result.cascades.length > 0, game);
    if (result.freeSpinsAwarded > 0) playBonus(result.freeSpinsAwarded);
    sessionEnd(report, start, request.wager);
  }
}

export function runSlotSimulation(
  request: SlotSimulationRequest,
  game: AdminGameSettings,
  onSession?: (session: SlotSessionObservation) => void,
): SlotSimulationReport {
  const started = performance.now();
  const normalized: SlotSimulationRequest = {
    ...request,
    runs: Math.max(1, Math.min(100_000, Math.round(request.runs))),
    wager: Math.max(1, request.wager),
  };
  if (!game.slot) throw new Error("Bu oyun slot simülasyonunu desteklemiyor.");
  const report = blank(normalized);
  report.onSession = onSession;
  const random = seeded(normalized.seed);
  if (normalized.gameId === "kaptan-mercan") fisherSimulation(normalized, game, report, random);
  else if (normalized.gameId === "sekerhane-1024") sekerhaneSimulation(normalized, game, report, random);
  else neonSimulation(normalized, game, report, random);
  const averageBonusLength = report.bonusLengths.length
    ? report.bonusLengths.reduce((sum, value) => sum + value, 0) / report.bonusLengths.length
    : 0;
  const sorted = [...report.payoutMultiples].sort((a, b) => a - b);
  const percentile = (fraction: number) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]
    : 0;
  const payoutAverage = report.payoutMultiples.length
    ? report.payoutMultiples.reduce((sum, value) => sum + value, 0) / report.payoutMultiples.length
    : 0;
  const standardDeviationX = report.payoutMultiples.length > 1
    ? Math.sqrt(report.payoutMultiples.reduce((sum, value) => sum + (value - payoutAverage) ** 2, 0) / (report.payoutMultiples.length - 1))
    : 0;
  const payoutBands = {
    zero: report.payoutMultiples.filter((value) => value === 0).length,
    under1: report.payoutMultiples.filter((value) => value > 0 && value < 1).length,
    oneTo2: report.payoutMultiples.filter((value) => value >= 1 && value < 2).length,
    twoTo5: report.payoutMultiples.filter((value) => value >= 2 && value < 5).length,
    fiveTo10: report.payoutMultiples.filter((value) => value >= 5 && value < 10).length,
    tenTo50: report.payoutMultiples.filter((value) => value >= 10 && value < 50).length,
    fiftyTo100: report.payoutMultiples.filter((value) => value >= 50 && value < 100).length,
    hundredPlus: report.payoutMultiples.filter((value) => value >= 100).length,
  };
  const {
    hits,
    measuredSpins,
    bonusLengths: _bonusLengths,
    payoutMultiples: _payoutMultiples,
    currentLossStreak: _currentLossStreak,
    onSession: _onSession,
    ...publicReport
  } = report;
  void _bonusLengths; void _payoutMultiples; void _currentLossStreak;
  return {
    ...publicReport,
    rtp: report.totalStake ? report.totalPayout / report.totalStake : 0,
    hitRate: measuredSpins ? hits / measuredSpins : 0,
    bonusRate: report.paidSpins ? report.bonusSessions / report.paidSpins : 0,
    averageBonusLength,
    payoutBands,
    p50WinX: percentile(.5),
    p90WinX: percentile(.9),
    p95WinX: percentile(.95),
    p99WinX: percentile(.99),
    standardDeviationX,
    durationMs: performance.now() - started,
  };
}
