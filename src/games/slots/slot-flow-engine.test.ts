import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_SETTINGS } from "../../data/casino-admin";
import { spinFisher } from "./fisherman-engine";
import { runNeonSpin } from "./neon-engine";
import { runSekerhaneSpin } from "./sekerhane-engine";
import {
  createSlotFlowState,
  planSlotFlow,
  settleSlotFlow,
  type SlotFlowDecision,
} from "./slot-flow-engine";

const unitFlow: SlotFlowDecision = {
  sequence: 1,
  bonusMode: false,
  hot: false,
  hotStarted: false,
  showPotential: true,
  strongTease: false,
  convertTease: false,
  lastBreath: false,
  postFeatureEchoArmed: false,
  eventWeightMultiplier: 1,
  bonusWeightMultiplier: 1,
};

function seeded(seed: number) {
  let state = seed >>> 0;
  return (max: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return Math.floor((state / 0x1_0000_0000) * Math.max(1, max));
  };
}

function seededUnit(seed: number) {
  const random = seeded(seed);
  return () => random(1_000_000) / 1_000_000;
}

describe("ortak slot akış ve görünür potansiyel motoru", () => {
  it("kuru seri ve bonus baskısını oyun bağımsız bir karara çevirir", () => {
    const slot = DEFAULT_ADMIN_SETTINGS.games["sekerhane-1024"].slot!;
    const state = {
      ...createSlotFlowState(),
      drySpins: slot.flow.drySpinSoftLimit + 2,
      paidSpinsSinceBonus: slot.flow.bonusPressureStartSpins + 20,
    };
    const decision = planSlotFlow(
      state,
      slot.flow,
      slot.potential,
      {},
      () => 0.99,
    );
    expect(decision.eventWeightMultiplier).toBeGreaterThan(1);
    expect(decision.bonusWeightMultiplier).toBeGreaterThan(1);
  });

  it("gerçek bonus geldiğinde bekleme ve karşılıksız beklenti sayaçlarını sıfırlar", () => {
    const slot = DEFAULT_ADMIN_SETTINGS.games["neon-kasasi"].slot!;
    const state = {
      ...createSlotFlowState(),
      drySpins: 8,
      paidSpinsSinceBonus: 90,
      unpaidStrongTeases: 4,
    };
    const decision = planSlotFlow(
      state,
      slot.flow,
      slot.potential,
      {},
      seededUnit(41),
    );
    const settled = settleSlotFlow(
      state,
      decision,
      { grossMultiple: 3, bonusTriggered: true, eventOccurred: true },
      slot.flow,
    );
    expect(settled.paidSpinsSinceBonus).toBe(0);
    expect(settled.unpaidStrongTeases).toBe(0);
    expect(settled.drySpins).toBe(0);
  });

  it("Kaptan Mercan'da ödeme hesabından bağımsız yüksek balık vitrini üretir", () => {
    const slot = DEFAULT_ADMIN_SETTINGS.games["kaptan-mercan"].slot!;
    const result = spinFisher(10, {
      random: seededUnit(912),
      tuning: {
        ...slot.math,
        baseSpecialRate: 0,
        basePrizeRate: 0,
        baseScatterRate: 0,
      },
      flow: unitFlow,
      potential: slot.potential,
    });
    expect(result.captainCount).toBe(0);
    expect(result.potentialCells?.length).toBeGreaterThanOrEqual(
      slot.potential.displayOnlyMinItems,
    );
    expect(
      result.potentialCells?.every(
        (cell) => cell.value >= slot.potential.displayOnlyHighValueMinX,
      ),
    ).toBe(true);
  });

  it("Şekerhane ve Neon'da yüksek vitrini gerçek ödeme terimlerine katmaz", () => {
    const sugar = DEFAULT_ADMIN_SETTINGS.games["sekerhane-1024"].slot!;
    const sugarPlain = runSekerhaneSpin(10, seeded(77), {
      profile: { ...sugar.math, payoutScale: 0, bonusPayoutScale: 0 },
    });
    const sugarDecorated = runSekerhaneSpin(10, seeded(77), {
      profile: { ...sugar.math, payoutScale: 0, bonusPayoutScale: 0 },
      flow: unitFlow,
      potential: { ...sugar.potential, nearMissChancePercent: 0 },
    });
    expect(sugarDecorated.grossReturn).toBe(sugarPlain.grossReturn);
    expect(sugarDecorated.potentialCells?.length).toBeGreaterThan(0);

    const neon = DEFAULT_ADMIN_SETTINGS.games["neon-kasasi"].slot!;
    const neonPlain = runNeonSpin(10, seeded(91), {
      tuning: { ...neon.math, payoutScale: 0, bonusPayoutScale: 0 },
    });
    const neonDecorated = runNeonSpin(10, seeded(91), {
      tuning: { ...neon.math, payoutScale: 0, bonusPayoutScale: 0 },
      flow: unitFlow,
      potential: neon.potential,
    });
    expect(neonDecorated.grossReturn).toBe(neonPlain.grossReturn);
    expect(neonDecorated.potentialCells?.length).toBeGreaterThan(0);
  });
});
