import { describe, expect, it } from "vitest";
import { CASINO_CHIP_VALUES, compactWager, maximumAffordableWager, normalizeWagerInput } from "./wagering";

describe("ortak bahis standardı", () => {
  it("500K değerini tavan yapmaz", () => {
    expect(CASINO_CHIP_VALUES).toContain(500_000);
    expect(CASINO_CHIP_VALUES.some((value) => value > 500_000)).toBe(true);
  });

  it("gerçek tavanı bakiye ve özellik maliyetinden türetir", () => {
    expect(maximumAffordableWager(75_000_000)).toBe(75_000_000);
    expect(maximumAffordableWager(75_000_000, 100, 5)).toBe(750_000);
  });

  it("manuel tutarı sabit kupür listesine sıkıştırmaz", () => {
    expect(normalizeWagerInput(7_654_321, 25)).toBe(7_654_321);
    expect(compactWager(2_500_000)).toBe("2,5M");
  });
});
