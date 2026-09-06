import type { BetDefinition, PlacedBet } from "./roulette-engine";

export function directBetFrom(bets: PlacedBet[], definition: BetDefinition) {
  return bets.find((bet) => bet.definition.id === definition.id);
}

export function activeBetFrom(bets: PlacedBet[], definition: BetDefinition) {
  const direct = directBetFrom(bets, definition);
  const wanted = [...definition.numbers].sort((a, b) => a - b);
  const distributed = bets.flatMap((placed) =>
    (placed.definition.components ?? []).flatMap((component) => {
      const componentNumbers = [...component.numbers].sort((a, b) => a - b);
      const sameArea =
        component.payout === definition.payout &&
        componentNumbers.length === wanted.length &&
        componentNumbers.every((number, index) => number === wanted[index]);
      return sameArea
        ? Array.from(
            { length: component.units ?? 1 },
            () => placed.chips,
          ).flat()
        : [];
    }),
  );
  const combined = [...(direct?.chips ?? []), ...distributed];
  return combined.length ? { definition, chips: combined } : undefined;
}

export function visibleRouletteBetLayers({
  bettingOpen,
  lockedBets,
  editableBets,
  definition,
}: {
  bettingOpen: boolean;
  lockedBets: PlacedBet[];
  editableBets: PlacedBet[];
  definition: BetDefinition;
}) {
  return {
    lockedBet: bettingOpen ? undefined : activeBetFrom(lockedBets, definition),
    editableBet: activeBetFrom(editableBets, definition),
    editableDirectBet: directBetFrom(editableBets, definition),
  };
}
