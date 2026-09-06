import { describe, expect, it } from "vitest";
import { localPokerTransport } from "./poker-transport";

function occupiedStacks(state: Awaited<ReturnType<typeof localPokerTransport.create>>) {
  return state.session.activeSnapshot.seating.seats
    .filter((seat) => seat?.occupant)
    .map((seat) => seat!.stack);
}

describe("yerel Texas Hold'em taşıma katmanı", () => {
  it("dokuz kişilik masayı sekiz botla açar", async () => {
    const state = await localPokerTransport.create({
      botCount: 8,
      buyIn: 20_000,
      smallBlind: 100,
      bigBlind: 200,
      buttonIndex: 0,
    });

    expect(occupiedStacks(state)).toHaveLength(9);
    expect(state.session.config.maxSeats).toBe(9);
    expect(state.decision.availableActions.length).toBeGreaterThan(0);
  });

  it("oyuncu ve bot aksiyonlarıyla eli sonuçlandırıp toplam çipi korur", async () => {
    let state = await localPokerTransport.create({
      botCount: 3,
      buyIn: 10_000,
      smallBlind: 50,
      bigBlind: 100,
      buttonIndex: 0,
    });

    for (let step = 0; step < 300 && state.session.activeSnapshot.hand.stage !== "settled"; step += 1) {
      if (!state.decision) {
        state = await localPokerTransport.advanceBot(state);
        continue;
      }
      if (state.decision.actor !== "muharrem") {
        state = await localPokerTransport.advanceBot(state);
        continue;
      }
      const option =
        state.decision.availableActions.find((candidate) => candidate.type === "check") ??
        state.decision.availableActions.find((candidate) => candidate.type === "call") ??
        state.decision.availableActions.find((candidate) => candidate.type === "fold")!;
      state = await localPokerTransport.applyPlayerAction(state, "muharrem", option);
    }

    expect(state.session.activeSnapshot.hand.stage).toBe("settled");
    expect(occupiedStacks(state).reduce((sum, stack) => sum + stack, 0)).toBe(40_000);
    // Rakiplerin tamamı riverdan önce fold ederse geçerli settlement showdown
    // üretmez; bu durumda ödeme makbuzu elin sonuçlandığını kanıtlar.
    expect(
      state.session.activeSnapshot.hand.showdown ??
        state.session.activeSnapshot.hand.payouts,
    ).toBeTruthy();
  });

  it("arayüzden seçilen özel raise miktarını motora uygular", async () => {
    let state = await localPokerTransport.create({
      botCount: 2,
      buyIn: 10_000,
      smallBlind: 50,
      bigBlind: 100,
      buttonIndex: 0,
    });
    for (let step = 0; step < 12 && state.decision.actor !== "muharrem"; step += 1)
      state = await localPokerTransport.advanceBot(state);

    expect(state.decision.actor).toBe("muharrem");
    const option = state.decision.availableActions.find(
      (candidate) => candidate.type === "raise" || candidate.type === "bet",
    );
    expect(option).toBeTruthy();
    if (!option || (option.type !== "raise" && option.type !== "bet")) return;
    const amount = Math.min(option.max, option.min + option.increment * 2);
    const next = await localPokerTransport.applyPlayerAction(
      state,
      "muharrem",
      option,
      amount,
    );

    const action = next.session.events.at(-1)?.event.action;
    expect(action?.type).toBe(option.type);
    expect(action && "amount" in action ? action.amount : 0).toBe(amount);
  });

  it("bot turunda aynı snapshot'a takılmadan tam bir aksiyon ilerler", async () => {
    let state = await localPokerTransport.create({
      botCount: 5,
      buyIn: 20_000,
      smallBlind: 100,
      bigBlind: 200,
      buttonIndex: 0,
    });
    for (let step = 0; step < 20 && state.decision.actor === "muharrem"; step += 1) {
      const option = state.decision.availableActions.find((candidate) => candidate.type === "check")
        ?? state.decision.availableActions.find((candidate) => candidate.type === "call")
        ?? state.decision.availableActions.find((candidate) => candidate.type === "fold")!;
      state = await localPokerTransport.applyPlayerAction(state, "muharrem", option);
    }
    expect(state.decision.actor).not.toBe("muharrem");
    const previousIndex = state.session.activeSnapshot.index;
    const previousEvents = state.session.events.length;
    const next = await localPokerTransport.advanceBot(state);
    expect(next.session.activeSnapshot.index).toBeGreaterThan(previousIndex);
    expect(next.session.events.length).toBeGreaterThan(previousEvents);
  });

  it("açık kasa modunda her oyuncunun farklı başlangıç stack'ini korur", async () => {
    const state = await localPokerTransport.create({
      botCount: 2,
      buyIn: 75_000,
      smallBlind: 100,
      bigBlind: 200,
      stacks: { muharrem: 75_000, aslan: 120_000, derya: 250_000 },
    });
    const stacks = Object.fromEntries(state.session.activeSnapshot.seating.seats.filter((seat) => seat?.occupant).map((seat) => [seat!.occupant!.playerId, seat!.stack]));
    expect(stacks.muharrem).toBe(75_000);
    expect(stacks.aslan).toBeLessThanOrEqual(120_000);
    expect(stacks.derya).toBeLessThanOrEqual(250_000);
    expect(stacks.aslan).not.toBe(stacks.derya);
  });
});
