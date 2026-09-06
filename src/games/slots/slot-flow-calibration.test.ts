import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_SETTINGS } from "../../data/casino-admin";
import { spinFisher } from "./fisherman-engine";
import { runNeonSpin } from "./neon-engine";
import {
  emptySekerhaneSpots,
  runSekerhaneSpin,
  type SekerhaneSpot,
} from "./sekerhane-engine";
import {
  createSlotFlowState,
  planSlotFlow,
  settleSlotFlow,
} from "./slot-flow-engine";

function seededIndex(seed: number) {
  let state = seed >>> 0;
  return (max: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return Math.floor((state / 0x1_0000_0000) * Math.max(1, max));
  };
}

function seededUnit(seed: number) {
  const index = seededIndex(seed);
  return () => index(1_000_000) / 1_000_000;
}

describe("ortak akış motoru varsayılan profil kalibrasyonu", () => {
  it("üç slotta ücretli ve free-spin akışını sınırlı tutar", () => {
    const paidTarget = 20_000;
    const reports: Record<string, { paid: number; free: number; bonus: number; potential: number; gross: number }> = {};

    {
      const slot = DEFAULT_ADMIN_SETTINGS.games["sekerhane-1024"].slot!;
      const randomIndex = seededIndex(101);
      const randomUnit = seededUnit(102);
      let state = createSlotFlowState();
      let paid = 0;
      let free = 0;
      let bonus = 0;
      let potential = 0;
      let gross = 0;
      let remaining = 0;
      let spots: SekerhaneSpot[][] = emptySekerhaneSpots();
      while (paid < paidTarget || remaining > 0) {
        const bonusMode = remaining > 0;
        const before = state;
        const decision = planSlotFlow(before, slot.flow, slot.potential, {
          bonusMode,
          lastBonusSpin: bonusMode && remaining === 1,
        }, randomUnit);
        const result = runSekerhaneSpin(1, randomIndex, {
          bonusMode,
          spots: bonusMode ? spots : undefined,
          profile: { ...slot.math, valueWeights: slot.valueWeights },
          flow: decision,
          potential: slot.potential,
        });
        gross += result.grossReturn;
        potential += result.potentialCells?.length ? 1 : 0;
        if (bonusMode) {
          free += 1;
          remaining = remaining - 1 + result.freeSpinsAwarded;
          spots = result.finalSpots;
        } else {
          paid += 1;
          if (result.freeSpinsAwarded) {
            bonus += 1;
            remaining = result.freeSpinsAwarded;
            spots = emptySekerhaneSpots();
          }
        }
        state = settleSlotFlow(before, decision, {
          grossMultiple: result.grossReturn,
          bonusTriggered: result.freeSpinsAwarded > 0,
          eventOccurred: result.cascades.length > 0 || result.freeSpinsAwarded > 0 || Boolean(result.potentialCells?.length),
        }, slot.flow);
      }
      reports.sekerhane = { paid, free, bonus, potential, gross };
    }

    {
      const slot = DEFAULT_ADMIN_SETTINGS.games["neon-kasasi"].slot!;
      const randomIndex = seededIndex(201);
      const randomUnit = seededUnit(202);
      let state = createSlotFlowState();
      let paid = 0;
      let free = 0;
      let bonus = 0;
      let potential = 0;
      let gross = 0;
      let remaining = 0;
      let multiplier = 0;
      while (paid < paidTarget || remaining > 0) {
        const bonusMode = remaining > 0;
        const before = state;
        const decision = planSlotFlow(before, slot.flow, slot.potential, {
          bonusMode,
          lastBonusSpin: bonusMode && remaining === 1,
        }, randomUnit);
        const result = runNeonSpin(1, randomIndex, {
          bonusMode,
          bonusMultiplier: multiplier,
          tuning: { ...slot.math, valueWeights: slot.valueWeights },
          flow: decision,
          potential: slot.potential,
        });
        gross += result.grossReturn;
        potential += result.potentialCells?.length ? 1 : 0;
        if (bonusMode) {
          free += 1;
          remaining = remaining - 1 + result.freeSpinsAwarded;
          multiplier = result.finalBonusMultiplier;
        } else {
          paid += 1;
          if (result.freeSpinsAwarded) {
            bonus += 1;
            remaining = result.freeSpinsAwarded;
            multiplier = 0;
          }
        }
        state = settleSlotFlow(before, decision, {
          grossMultiple: result.grossReturn,
          bonusTriggered: result.freeSpinsAwarded > 0,
          eventOccurred: result.cascades.length > 0 || result.freeSpinsAwarded > 0 || Boolean(result.potentialCells?.length),
        }, slot.flow);
      }
      reports.neon = { paid, free, bonus, potential, gross };
    }

    {
      const slot = DEFAULT_ADMIN_SETTINGS.games["kaptan-mercan"].slot!;
      const randomUnit = seededUnit(302);
      let state = createSlotFlowState();
      let paid = 0;
      let free = 0;
      let bonus = 0;
      let potential = 0;
      let gross = 0;
      let remaining = 0;
      while (paid < paidTarget || remaining > 0) {
        const bonusMode = remaining > 0;
        const before = state;
        const decision = planSlotFlow(before, slot.flow, slot.potential, {
          bonusMode,
          lastBonusSpin: bonusMode && remaining === 1,
        }, randomUnit);
        const result = spinFisher(1, {
          bonus: bonusMode,
          random: randomUnit,
          tuning: { ...slot.math, valueWeights: slot.valueWeights },
          flow: decision,
          potential: slot.potential,
        });
        gross += result.grossPayout;
        potential += result.potentialCells?.length ? 1 : 0;
        if (bonusMode) {
          free += 1;
          remaining = remaining - 1 + result.bonusSpins;
        } else {
          paid += 1;
          if (result.bonusSpins) {
            bonus += 1;
            remaining = result.bonusSpins;
          }
        }
        state = settleSlotFlow(before, decision, {
          grossMultiple: result.grossPayout,
          bonusTriggered: result.bonusSpins > 0,
          eventOccurred: result.lineWins.length > 0 || result.bonusSpins > 0 || result.fishValues.length > 0,
        }, slot.flow);
      }
      reports.mercan = { paid, free, bonus, potential, gross };
    }

    console.info("Akış motoru 20k ücretli spin kalibrasyonu", reports);
    Object.values(reports).forEach((report) => {
      expect(report.paid).toBe(paidTarget);
      expect(report.free).toBeLessThan(paidTarget * 5);
      expect(report.potential).toBeGreaterThan(0);
      expect(Number.isFinite(report.gross)).toBe(true);
    });
  }, 60_000);
});
