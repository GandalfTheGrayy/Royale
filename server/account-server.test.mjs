import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { createAccountSystem } from "./auth-system.mjs";
import { createAccountServer } from "./account-server.mjs";

it("serves real login, CSRF-protected approval and wallet state without a game server", async () => {
  const dir = mkdtempSync(join(tmpdir(), "royale-account-test-"));
  const file = join(dir, "test.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE casino_meta(key TEXT PRIMARY KEY,value_json TEXT);
    CREATE TABLE schema_info(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE game_rounds(id TEXT PRIMARY KEY);
    CREATE TABLE wallet_ledger(id TEXT PRIMARY KEY);
    CREATE TABLE game_events(id TEXT PRIMARY KEY);
    CREATE TABLE ai_conversations(id TEXT PRIMARY KEY);
    CREATE TABLE competition_settings(id TEXT PRIMARY KEY,config_json TEXT);`);
  createAccountSystem(db);
  db.exec(`INSERT INTO users(id,username_normalized,username_display,display_name,role,status,created_at,updated_at)
    VALUES('pending','pending','Pending','Pending','player','pending','2026-01-01','2026-01-01');
    INSERT INTO wallets(user_id,balance_micro,updated_at) VALUES('pending',0,'2026-01-01');`);
  db.close();
  const server = createAccountServer(file);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  try {
    expect((await post('/api/auth/bootstrap-owner', { password: 'test-password-123' })).status).toBe(200);
    const login = await post('/api/auth/login', { username: 'pehlevan', password: 'test-password-123' });
    expect(login.status).toBe(200);
    const session = await login.json();
    const headers = { Cookie: login.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': session.csrfToken };
    expect((await fetch(base + '/api/casino-data/competition/admin/config')).status).toBe(401);
    expect((await fetch(base + '/api/casino-data/competition/admin/config', { headers })).status).toBe(200);
    expect((await post('/api/admin/accounts/users/pending/approve', { initialBalance: 5000 }, { Cookie: headers.Cookie })).status).toBe(403);
    expect((await post('/api/admin/accounts/users/pending/approve', { initialBalance: 5000 }, headers)).status).toBe(200);
    const users = await (await fetch(base + '/api/admin/accounts/users', { headers })).json();
    expect(users.users.find(user => user.id === 'pending')).toMatchObject({ status: 'active', balance: 5000 });
    expect((await post('/api/admin/accounts/users/pending/approve', { initialBalance: 5000 }, headers)).status).toBe(409);
    expect((await post('/api/auth/login', { username: 'pehlevan', password: 'wrong-password' })).status).toBe(401);
  } finally {
    const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed;
    rmSync(dir, { recursive: true, force: true });
  }
});
