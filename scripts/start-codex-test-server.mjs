import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCallback);
const workspace = resolve(import.meta.dirname, "..");
const localRoot = resolve(workspace, ".codex-local");
const databaseDirectory = resolve(localRoot, "test-db");
const databasePath = resolve(databaseDirectory, "pehlevan-royale.sqlite");
const accountPath = resolve(localRoot, "test-account.json");
const liveDatabasePath = process.env.LOCALAPPDATA
  ? resolve(
      process.env.LOCALAPPDATA,
      "PehlevanRoyale",
      "pehlevan-royale.sqlite",
    )
  : resolve(workspace, "data", "pehlevan-royale.sqlite");

const escapeSqlitePath = (value) => value.replaceAll("'", "''");

async function hashPassword(password) {
  const N = 32768;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 32, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;
}

function loadOrCreateAccount() {
  if (existsSync(accountPath)) {
    return JSON.parse(readFileSync(accountPath, "utf8"));
  }
  const account = {
    id: "codex-test-owner",
    username: "codex_test",
    displayName: "Codex Test Müfettişi",
    password: `CT-${randomBytes(18).toString("base64url")}`,
    role: "owner",
    origin: "http://127.0.0.1:5174",
  };
  mkdirSync(dirname(accountPath), { recursive: true });
  writeFileSync(accountPath, `${JSON.stringify(account, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return account;
}

function ensureTestDatabase() {
  mkdirSync(databaseDirectory, { recursive: true });
  if (existsSync(databasePath)) return;
  if (!existsSync(liveDatabasePath)) {
    throw new Error(`Canlı veritabanı bulunamadı: ${liveDatabasePath}`);
  }
  const source = new DatabaseSync(liveDatabasePath, { readOnly: true });
  try {
    source.exec(`VACUUM INTO '${escapeSqlitePath(databasePath)}'`);
  } finally {
    source.close();
  }
}

async function ensureTestOwner(account) {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys=ON");
    const timestamp = new Date().toISOString();
    const passwordHash = await hashPassword(account.password);
    database.exec("BEGIN IMMEDIATE");
    try {
      database
        .prepare(
          `INSERT INTO users(
            id,username_normalized,username_display,display_name,role,status,
            registration_note,admin_note,approved_by,approved_at,created_at,updated_at
          ) VALUES(?,?,?,?,?,'active',?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            username_normalized=excluded.username_normalized,
            username_display=excluded.username_display,
            display_name=excluded.display_name,
            role='owner',status='active',admin_note=excluded.admin_note,
            approved_at=excluded.approved_at,updated_at=excluded.updated_at`,
        )
        .run(
          account.id,
          account.username,
          account.username,
          account.displayName,
          "owner",
          "Yalnız 5174 Codex tarayıcı ve arayüz testleri için.",
          "Tam yetkili, izole test hesabı.",
          "muharrem-pehlevan",
          timestamp,
          timestamp,
          timestamp,
        );
      database
        .prepare(
          `INSERT INTO user_credentials(user_id,password_hash,password_changed_at)
           VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET
             password_hash=excluded.password_hash,
             password_changed_at=excluded.password_changed_at,
             failed_attempts=0,locked_until=NULL`,
        )
        .run(account.id, passwordHash, timestamp);
      database
        .prepare(
          `INSERT INTO wallets(user_id,balance_micro,version,updated_at)
           VALUES(?,100000000000000,0,?) ON CONFLICT(user_id) DO UPDATE SET
             balance_micro=MAX(wallets.balance_micro,excluded.balance_micro),
             updated_at=excluded.updated_at`,
        )
        .run(account.id, timestamp);
      database.prepare("DELETE FROM sessions WHERE user_id=?").run(account.id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.close();
  }
}

const account = loadOrCreateAccount();
ensureTestDatabase();
await ensureTestOwner(account);

console.log("Codex test ortamı hazır: http://127.0.0.1:5174");
console.log(`Test hesabı: ${account.username} · ${account.role}`);
console.log(`Yerel kimlik dosyası: ${accountPath}`);

const viteExecutable = process.execPath;
const viteCli = resolve(workspace, "node_modules", "vite", "bin", "vite.js");
const child = spawn(
  viteExecutable,
  [viteCli, "--host=127.0.0.1", "--port=5174", "--strictPort"],
  {
    cwd: workspace,
    stdio: "inherit",
    env: {
      ...process.env,
      PEHLEVAN_DB_DIRECTORY: databaseDirectory,
      PEHLEVAN_TEST_AUTO_LOGIN_USER_ID: account.id,
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
