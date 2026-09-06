import { describe, expect, it } from "vitest";
import { slotLevel } from "./slot-progression";

describe("slot progression", () => {
  it("seviyeleri artan XP eşikleriyle hesaplar", () => {
    expect(slotLevel(0, 100)).toMatchObject({
      level: 1,
      current: 0,
      required: 100,
    });
    expect(slotLevel(100, 100)).toMatchObject({
      level: 2,
      current: 0,
      required: 200,
    });
    expect(slotLevel(325, 100)).toMatchObject({
      level: 3,
      current: 25,
      required: 300,
    });
  });
});
