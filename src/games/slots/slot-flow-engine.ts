import type {
  SlotFlowSettings,
  SlotPotentialSettings,
} from "../../data/casino-admin";

export type SlotFlowState = {
  paidSpinsSinceBonus: number;
  drySpins: number;
  spinsSinceMeaningfulWin: number;
  unpaidStrongTeases: number;
  hotSpinsRemaining: number;
  echoSpinsRemaining: number;
  sequence: number;
};

export type SlotFlowContext = {
  bonusMode?: boolean;
  lastBonusSpin?: boolean;
};

export type SlotFlowDecision = {
  sequence: number;
  bonusMode: boolean;
  hot: boolean;
  hotStarted: boolean;
  showPotential: boolean;
  strongTease: boolean;
  convertTease: boolean;
  lastBreath: boolean;
  postFeatureEchoArmed: boolean;
  eventWeightMultiplier: number;
  bonusWeightMultiplier: number;
};

export type SlotFlowOutcome = {
  grossMultiple: number;
  bonusTriggered: boolean;
  eventOccurred: boolean;
};

export const createSlotFlowState = (): SlotFlowState => ({
  paidSpinsSinceBonus: 0,
  drySpins: 0,
  spinsSinceMeaningfulWin: 0,
  unpaidStrongTeases: 0,
  hotSpinsRemaining: 0,
  echoSpinsRemaining: 0,
  sequence: 0,
});

function secureUnit() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 0x1_0000_0000;
  }
  return Math.random();
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const chance = (percent: number, random: () => number) =>
  random() * 100 < clamp(percent, 0, 100);

/**
 * Produces one game-agnostic pacing decision. The concrete slot engine decides
 * how a "potential" or a "strong tease" is represented on its own grid.
 */
export function planSlotFlow(
  state: SlotFlowState,
  flow: SlotFlowSettings,
  potential: SlotPotentialSettings,
  context: SlotFlowContext = {},
  random: () => number = secureUnit,
): SlotFlowDecision {
  const bonusMode = Boolean(context.bonusMode);
  if (!flow.enabled) {
    return {
      sequence: state.sequence + 1,
      bonusMode,
      hot: false,
      hotStarted: false,
      showPotential: false,
      strongTease: false,
      convertTease: false,
      lastBreath: false,
      postFeatureEchoArmed: false,
      eventWeightMultiplier: 1,
      bonusWeightMultiplier: 1,
    };
  }

  const pressureSpins = Math.max(
    0,
    state.paidSpinsSinceBonus - flow.bonusPressureStartSpins,
  );
  const pressurePercent = bonusMode
    ? 0
    : Math.min(
        flow.bonusPressureMaxPercent,
        pressureSpins * flow.bonusPressurePerSpinPercent,
      );
  const hotStarted =
    !bonusMode &&
    state.hotSpinsRemaining <= 0 &&
    chance(flow.hotWindowChancePercent, random);
  const echoActive = state.echoSpinsRemaining > 0;
  const hot = state.hotSpinsRemaining > 0 || hotStarted || echoActive;
  const dryBoost =
    state.drySpins >= flow.drySpinSoftLimit
      ? flow.drySpinEventBoostPercent
      : 0;

  let lastBreath = false;
  let strongTease = false;
  let convertTease = false;
  if (bonusMode) {
    lastBreath =
      Boolean(context.lastBonusSpin) && chance(flow.lastBreathPercent, random);
    strongTease =
      lastBreath || chance(flow.retriggerTeasePercent, random);
    convertTease =
      lastBreath ||
      (strongTease && chance(flow.retriggerConversionPercent, random));
  } else if (potential.enabled) {
    strongTease = chance(
      potential.strongExposureChancePercent + pressurePercent * 0.015,
      random,
    );
    convertTease =
      strongTease &&
      (state.unpaidStrongTeases >= potential.maxUnpaidStrongTeases ||
        chance(potential.teaserConversionPercent, random));
  }

  const showPotential =
    potential.enabled &&
    !convertTease &&
    (strongTease || chance(potential.exposureChancePercent, random));
  const eventBoostPercent =
    dryBoost +
    pressurePercent * 0.35 +
    (hot ? flow.hotWindowEventBoostPercent : 0) +
    (echoActive ? flow.hotWindowEventBoostPercent * 0.5 : 0);

  return {
    sequence: state.sequence + 1,
    bonusMode,
    hot,
    hotStarted,
    showPotential,
    strongTease,
    convertTease,
    lastBreath,
    postFeatureEchoArmed: chance(flow.postFeatureEchoPercent, random),
    eventWeightMultiplier: 1 + eventBoostPercent / 100,
    bonusWeightMultiplier: 1 + pressurePercent / 100,
  };
}

export function settleSlotFlow(
  state: SlotFlowState,
  decision: SlotFlowDecision,
  outcome: SlotFlowOutcome,
  flow: SlotFlowSettings,
): SlotFlowState {
  const meaningful = outcome.grossMultiple >= flow.meaningfulWinX;
  const paidSpinsSinceBonus = decision.bonusMode
    ? state.paidSpinsSinceBonus
    : outcome.bonusTriggered
      ? 0
      : state.paidSpinsSinceBonus + 1;
  const drySpins = outcome.eventOccurred ? 0 : state.drySpins + 1;
  const spinsSinceMeaningfulWin = meaningful
    ? 0
    : state.spinsSinceMeaningfulWin + 1;
  const unpaidStrongTeases = decision.bonusMode
    ? state.unpaidStrongTeases
    : outcome.bonusTriggered
      ? 0
      : decision.strongTease && !decision.convertTease
        ? state.unpaidStrongTeases + 1
        : state.unpaidStrongTeases;
  const hotSpinsRemaining = decision.hotStarted
    ? Math.max(0, flow.hotWindowSpins - 1)
    : Math.max(0, state.hotSpinsRemaining - 1);
  const echoTriggered =
    decision.postFeatureEchoArmed &&
    (outcome.bonusTriggered || outcome.grossMultiple >= 10);
  const echoSpinsRemaining = echoTriggered
    ? 1
    : Math.max(0, state.echoSpinsRemaining - 1);

  return {
    paidSpinsSinceBonus,
    drySpins,
    spinsSinceMeaningfulWin,
    unpaidStrongTeases,
    hotSpinsRemaining,
    echoSpinsRemaining,
    sequence: decision.sequence,
  };
}

export function slotFlowTelemetry(
  state: SlotFlowState,
  decision: SlotFlowDecision,
) {
  return {
    stateBefore: state,
    decision,
    engine: "shared-slot-flow-v1",
  };
}
