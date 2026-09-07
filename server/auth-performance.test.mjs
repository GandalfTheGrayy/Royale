import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccountSystem } from "./auth-system.mjs";

describe("account polling and approval", () => {
  let database, accounts;
  const headers = { cookie: "pehlevan_session=test-token", "x-csrf-token": "test-csrf" };
  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`CREATE TABLE casino_meta(key TEXT PRIMARY KEY,value_json TEXT);
      CREATE TABLE schema_info(key TEXT PRIMARY KEY,value TEXT);
      CREATE TABLE game_rounds(id TEXT PRIMARY KEY);
      CREATE TABLE wallet_ledger(id TEXT PRIMARY KEY);
      CREATE TABLE game_events(id TEXT PRIMARY KEY);
      CREATE TABLE ai_conversations(id TEXT PRIMARY KEY);`);
    accounts = createAccountSystem(database);
    database.prepare(`INSERT INTO sessions(id,user_id,token_hash,csrf_token,created_at,last_seen_at,expires_at)
      VALUES('test-session',?,?,'test-csrf',?,?,?)`).run(accounts.ownerId,
      createHash("sha256").update("test-token").digest("hex"),
      new Date().toISOString(), new Date(Date.now() - 120_000).toISOString(), new Date(Date.now() + 3600_000).toISOString());
  });
  afterEach(() => database.close());

  it("updates presence once, avoids repeated writes and immediately honors revocation", () => {
    const changes = () => database.prepare("SELECT total_changes() n").get().n;
    const before = changes();
    expect(accounts.currentSession({ headers })).not.toBeNull();
    expect(changes() - before).toBe(2);
    const after = changes();
    for (let i = 0; i < 10; i++) expect(accounts.currentSession({ headers })).not.toBeNull();
    expect(changes()).toBe(after);
    database.exec("UPDATE sessions SET revoked_at='revoked'");
    expect(accounts.currentSession({ headers })).toBeNull();
  });

  it("approves once and prevents a retried approval from resetting the wallet", async () => {
    database.exec(`INSERT INTO users(id,username_normalized,username_display,display_name,role,status,created_at,updated_at)
      VALUES('pending','pending','Pending','Pending','player','pending','2026-01-01','2026-01-01');
      INSERT INTO wallets(user_id,balance_micro,updated_at) VALUES('pending',0,'2026-01-01');`);
    const approve = async () => {
      const req = Readable.from([Buffer.from(JSON.stringify({ initialBalance: 5000, reason: "test" }))]);
      req.headers = headers; req.method = "POST";
      const response = { setHeader() {}, end(data) { this.payload = JSON.parse(data); } };
      await accounts.handleAuth(req, response, new URL("http://localhost/api/admin/accounts/users/pending/approve"));
      return response;
    };
    expect((await approve()).statusCode).toBe(200);
    database.exec("UPDATE wallets SET balance_micro=7000000000 WHERE user_id='pending'");
    expect((await approve()).statusCode).toBe(409);
    expect(database.prepare("SELECT balance_micro n FROM wallets WHERE user_id='pending'").get().n).toBe(7000000000);
    expect(database.prepare("SELECT COUNT(*) n FROM admin_audit_log WHERE action='user.approve'").get().n).toBe(1);
  });

  it("rejects a stale browser tab after the shared session changes account", () => {
    const req = { method: "GET", headers: { ...headers, "x-pehlevan-user": "another-user" } };
    const response = { setHeader() {}, end(data) { this.payload = JSON.parse(data); } };
    expect(accounts.requireSession(req, response)).toBeNull();
    expect(response.statusCode).toBe(409);
    expect(response.payload.code).toBe("ACCOUNT_CHANGED");
  });

  it("adds an admin adjustment to the wallet value current at transaction time", async () => {
    database.exec(`INSERT INTO users(id,username_normalized,username_display,display_name,role,status,created_at,updated_at)
      VALUES('player','player','Player','Player','player','active','2026-01-01','2026-01-01');
      INSERT INTO wallets(user_id,balance_micro,updated_at) VALUES('player',100000000,'2026-01-01');`);
    const req = new PassThrough();
    req.headers = headers;
    req.method = "POST";
    const response = { setHeader() {}, end(data) { this.payload = JSON.parse(data); } };
    const pending = accounts.handleAuth(req, response, new URL("http://localhost/api/admin/accounts/users/player/wallet"));
    await new Promise((resolve) => setImmediate(resolve));
    // This represents a game settlement arriving after the target was selected
    // but before the admin request body completed.
    database.exec("UPDATE wallets SET balance_micro=125000000,version=version+1 WHERE user_id='player'");
    req.end(JSON.stringify({ amount: 10, reason: "concurrent adjustment test" }));
    await pending;
    expect(response.statusCode).toBe(200);
    expect(response.payload).toMatchObject({ userId: "player", balance: 135, version: 2 });
    expect(database.prepare("SELECT CAST(balance_micro AS TEXT) value FROM wallets WHERE user_id='player'").get().value).toBe("135000000");
  });
});
