import { describe, expect, it } from "vitest";
import type { CasinoRoundRecord } from "./casino-database";
import {
  auditCasinoRoundTelemetry,
  withCasinoRoundTelemetryAudit,
} from "./round-telemetry";

const plinko = (result: Record<string, unknown>): CasinoRoundRecord => ({
  id: "r1",
  roundId: "r1",
  game: "plinko",
  variant: "test",
  source: "player",
  playerParticipated: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  settledAt: "2026-01-01T00:00:01.000Z",
  stake: 10,
  grossPayout: 20,
  net: 10,
  outcome: "win",
  result,
});

describe("round telemetry contract", () => {
  it("eksik alanları oyun sözleşmesine göre bildirir", () => {
    expect(auditCasinoRoundTelemetry(plinko({ rows: 12 }))).toMatchObject({
      complete: false,
      missing: ["version", "risk", "path", "multiplier"],
    });
  });

  it("tam turu değiştirmeden denetim makbuzu ekler", () => {
    const record = plinko({
      telemetryVersion: 1,
      rows: 12,
      risk: "medium",
      directions: [0, 1],
      multiplier: 2,
    });
    const audited = withCasinoRoundTelemetryAudit(record);
    expect(audited.result.telemetryAudit).toMatchObject({
      complete: true,
      missing: [],
    });
    expect(audited.stake).toBe(10);
  });
});
