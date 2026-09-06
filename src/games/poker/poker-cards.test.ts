import { describe, expect, it } from "vitest";
import {
  compareEvaluations,
  evaluatePokerHand,
  type PokerCard,
} from "./poker-cards";
import {
  aaBonusMultiplier,
  dealerQualifies,
  resolveCasinoHoldem,
} from "./casino-holdem-engine";

const cards = (...values: PokerCard[]) => values;

describe("poker el değerlendiricisi", () => {
  it("yedi karttan royal flushı seçer", () => {
    const hand = evaluatePokerHand(cards("As", "Ks", "Qs", "Js", "Ts", "2d", "3c"));
    expect(hand.rankClass).toBe("royal-flush");
    expect(hand.score).toEqual([8, 14]);
  });

  it("wheel straightı beş yüksek olarak sıralar", () => {
    const hand = evaluatePokerHand(cards("As", "2d", "3h", "4c", "5s", "Kd", "Qd"));
    expect(hand.rankClass).toBe("straight");
    expect(hand.score).toEqual([4, 5]);
  });

  it("kicker ile aynı çifti ayırır", () => {
    const ace = evaluatePokerHand(cards("Ah", "Ad", "Ks", "9c", "4d"));
    const queen = evaluatePokerHand(cards("As", "Ac", "Qs", "9d", "4c"));
    expect(compareEvaluations(ace, queen)).toBe(1);
  });

  it("krupiyeyi çift dörtlü veya üstünde açar", () => {
    expect(dealerQualifies(evaluatePokerHand(cards("4s", "4d", "Ah", "Kc", "2s")))).toBe(true);
    expect(dealerQualifies(evaluatePokerHand(cards("3s", "3d", "Ah", "Kc", "2s")))).toBe(false);
  });

  it("AA bonusunu yalnız as çifti veya üstüne öder", () => {
    expect(aaBonusMultiplier(evaluatePokerHand(cards("As", "Ad", "2h", "7c", "9s")))).toBe(7);
    expect(aaBonusMultiplier(evaluatePokerHand(cards("Ks", "Kd", "2h", "7c", "9s")))).toBe(0);
  });

  it("krupiye açılmazsa anteyi öder ve call bahsini iade eder", () => {
    const result = resolveCasinoHoldem(
      {
        player: ["As", "Kd"],
        dealer: ["2c", "7d"],
        flop: ["Qh", "9s", "4c"],
        turn: "3d",
        river: "8h",
      },
      100,
      0,
      true,
    );
    expect(result.dealerQualifies).toBe(false);
    expect(result.anteGross).toBe(200);
    expect(result.callGross).toBe(200);
    expect(result.aaGross).toBe(0);
    expect(result.grossPayout).toBe(400);
    expect(result.net).toBe(100);
  });
});
