import { describe, expect, it } from "vitest";
import { neighbourBet, straightBet, type PlacedBet } from "./roulette-engine";
import { visibleRouletteBetLayers } from "./roulette-bet-layers";

describe("rulet bahis görünürlük katmanları", () => {
  it("çark dönerken kilitli turu ve sonraki turu ayrı tutar", () => {
    const definition = straightBet(17);
    const lockedBets: PlacedBet[] = [{ definition, chips: [100] }];
    const editableBets: PlacedBet[] = [{ definition, chips: [25, 25] }];

    const layers = visibleRouletteBetLayers({
      bettingOpen: false,
      lockedBets,
      editableBets,
      definition,
    });

    expect(layers.lockedBet?.chips).toEqual([100]);
    expect(layers.editableBet?.chips).toEqual([25, 25]);
    expect(layers.editableDirectBet).toBe(editableBets[0]);
  });

  it("yeni bahis penceresinde önceki turun kilitli katmanını gizler", () => {
    const definition = straightBet(8);
    const layers = visibleRouletteBetLayers({
      bettingOpen: true,
      lockedBets: [{ definition, chips: [500] }],
      editableBets: [{ definition, chips: [50] }],
      definition,
    });

    expect(layers.lockedBet).toBeUndefined();
    expect(layers.editableBet?.chips).toEqual([50]);
  });

  it("racetrack komşu bahislerini ilgili sayıların üzerinde gösterir", () => {
    const callBet = neighbourBet(17);
    const layers = visibleRouletteBetLayers({
      bettingOpen: false,
      lockedBets: [{ definition: callBet, chips: [25] }],
      editableBets: [],
      definition: straightBet(17),
    });

    expect(layers.lockedBet?.chips.length).toBeGreaterThan(0);
  });
});
