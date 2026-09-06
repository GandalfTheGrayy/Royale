import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { toMicro } from "./auth-system.mjs";

const databases = [];

afterEach(() => {
  while (databases.length) databases.pop().close();
});

describe("büyük cüzdan değerleri", () => {
  it("güvenli Number sınırını aşan mikro-PR tutarını BigInt üretir", () => {
    const micro = toMicro(50_000_000_000);
    expect(micro).toBe(50_000_000_000_000_000n);
    expect(micro > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("75 kentilyon PR değerini SQLite integer sınırında reddetmeden BigInt'e çevirir", () => {
    const micro = toMicro("75000000000000000000");
    expect(micro).toBe(
      75_000_000_000_000_000_000_000_000n,
    );
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    database.exec(
      "CREATE TABLE wallets(user_id TEXT PRIMARY KEY,balance_micro INTEGER NOT NULL)",
    );
    expect(() =>
      database
        .prepare("INSERT INTO wallets(user_id,balance_micro) VALUES(?,?)")
        .run("owner", micro.toString()),
    ).not.toThrow();
    const stored = database
      .prepare("SELECT CAST(balance_micro AS TEXT) value FROM wallets")
      .get();
    expect(Number.isFinite(Number(stored.value))).toBe(true);
  });

  it("SQLite değerini metin okuyup BigInt ile kayıpsız günceller", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    database.exec(
      "CREATE TABLE wallets(user_id TEXT PRIMARY KEY,balance_micro INTEGER NOT NULL)",
    );
    database
      .prepare("INSERT INTO wallets(user_id,balance_micro) VALUES(?,?)")
      .run("owner", 50_128_537_358_526_800n);

    const row = database
      .prepare(
        "SELECT CAST(balance_micro AS TEXT) balance_micro FROM wallets WHERE user_id=?",
      )
      .get("owner");
    const next = BigInt(row.balance_micro) + toMicro(25);
    database
      .prepare("UPDATE wallets SET balance_micro=? WHERE user_id=?")
      .run(next, "owner");

    const updated = database
      .prepare("SELECT CAST(balance_micro AS TEXT) value FROM wallets")
      .get();
    expect(updated.value).toBe("50128537383526800");
  });
});
