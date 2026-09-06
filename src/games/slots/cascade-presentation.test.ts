import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CASCADE_TIMINGS,
  cascadeCellDelay,
  cascadeGridDistance,
  createCascadeIdentity,
  createInitialFallRows,
  playCascadeTimeline,
  reconcileCascadeIdentity,
  waitForPresentation,
} from "./cascade-presentation";

describe("ortak cascade sunum motoru", () => {
  it("normal modda iniş ve kümeyi okuyacak kadar yavaş bir ortak ritim kullanır", () => {
    expect(DEFAULT_CASCADE_TIMINGS.normal.landing).toBeGreaterThanOrEqual(700);
    expect(DEFAULT_CASCADE_TIMINGS.normal.focus).toBeGreaterThanOrEqual(700);
    expect(DEFAULT_CASCADE_TIMINGS.normal.falling).toBeGreaterThanOrEqual(700);
    expect(DEFAULT_CASCADE_TIMINGS.turbo.falling).toBeLessThan(
      DEFAULT_CASCADE_TIMINGS.normal.falling,
    );
  });

  it("ilk inişte her sembole kararlı ve benzersiz kimlik verir", () => {
    let serial = 0;
    const state = createCascadeIdentity(2, 3, () => `symbol-${++serial}`);
    expect(state.ids.flat()).toEqual([
      "symbol-1",
      "symbol-2",
      "symbol-3",
      "symbol-4",
      "symbol-5",
      "symbol-6",
    ]);
    expect(state.entering).toEqual(new Set(state.ids.flat()));
  });

  it("düşen sembolün kimliğini korur ve yalnız yeni sembole kimlik üretir", () => {
    const current = [
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ];
    const nextId = vi.fn(() => "new");
    const state = reconcileCascadeIdentity(
      current,
      [
        [null, 0],
        [0, 1],
        [2, 2],
      ],
      nextId,
    );
    expect(state.ids).toEqual([
      ["new", "b"],
      ["a", "d"],
      ["e", "f"],
    ]);
    expect(state.entering).toEqual(new Set(["new"]));
    expect(nextId).toHaveBeenCalledOnce();
  });

  it("ilk giriş mesafesini ve kolon dalgasını deterministik üretir", () => {
    expect(createInitialFallRows(2, 4, 7)).toEqual([
      [7, 8, 9, 7],
      [8, 9, 10, 8],
    ]);
    expect(cascadeCellDelay(2, 3, true, false)).toBeGreaterThan(
      cascadeCellDelay(2, 2, false, false),
    );
  });

  it("düşüş mesafesine her geçilen satırın grid boşluğunu da ekler", () => {
    expect(cascadeGridDistance(1)).toBe(
      "calc(-100% - var(--cascade-grid-gap))",
    );
    expect(cascadeGridDistance(3, "6px")).toBe("calc(-300% - 6px - 6px - 6px)");
  });

  it("geçersiz survivor kaynağını sessizce yeni sembole çevirmek yerine reddeder", () => {
    expect(() => reconcileCascadeIdentity([["a"]], [[4]], () => "new")).toThrow(
      /Invalid cascade source/,
    );
  });

  it("tema bağımsız fazları doğru sırayla oynatır", async () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const run = playCascadeTimeline(
      ["cascade-1"],
      false,
      {
        onPhase: (phase) => phases.push(phase),
        afterFalling: (cascade, index) => {
          phases.push(`settled:${cascade}:${index}`);
        },
        afterComplete: () => {
          phases.push("complete");
        },
      },
      {
        normal: { landing: 1, focus: 1, bursting: 1, cleared: 1, falling: 1 },
        turbo: { landing: 0, focus: 0, bursting: 0, cleared: 0, falling: 0 },
      },
    );
    await vi.runAllTimersAsync();
    await expect(run).resolves.toBe(true);
    expect(phases).toEqual([
      "landing",
      "focus",
      "bursting",
      "cleared",
      "falling",
      "settled:cascade-1:0",
      "complete",
    ]);
    vi.useRealTimers();
  });

  it("DUR isteğinde kalan sunum süresini sonucu iptal etmeden atlar", async () => {
    vi.useFakeTimers();
    let skip = false;
    const run = waitForPresentation(2_000, () => skip);
    await vi.advanceTimersByTimeAsync(64);
    skip = true;
    await vi.advanceTimersByTimeAsync(32);
    await expect(run).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
