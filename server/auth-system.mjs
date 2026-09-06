import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const OWNER_ID = "muharrem-pehlevan";
const MICRO_PR = 1_000_000;
const MICRO_PR_BIGINT = 1_000_000n;
const SESSION_COOKIE = "pehlevan_session";
const AVATAR_IDS = Object.freeze([
  "monogram-gold",
  "kasa-baronu",
  "gece-kurdu",
  "kartal",
  "kara-as",
  "mercan-reisi",
  "neon-patronu",
  "seker-babasi",
]);
const loginAttempts = new Map();
const registrationAttempts = new Map();

function json(response, status, payload, headers = {}) {
  const body = Buffer.from(
    JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", body.length);
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  response.end(body);
}

function body(request, limit = 128 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("İstek çok büyük."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(
          chunks.length
            ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
            : {},
        );
      } catch {
        reject(new Error("Geçersiz JSON."));
      }
    });
    request.on("error", reject);
  });
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalizeUsername = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("tr-TR");
const now = () => new Date().toISOString();
const id = (prefix) =>
  `${prefix}-${Date.now()}-${randomBytes(10).toString("hex")}`;
function decimalToBigInt(value, scale) {
  const source = String(value ?? "").trim();
  if (source.length > 512) throw new Error("Geçerli bir tutar girin.");
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error("Geçerli bir tutar girin.");
  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 400)
    throw new Error("Geçerli bir tutar girin.");
  const digits = BigInt(`${match[2]}${fraction}` || "0");
  const power = exponent - fraction.length + scale;
  if (power >= 0) return sign * digits * 10n ** BigInt(power);
  const divisor = 10n ** BigInt(-power);
  const rounded = (digits + divisor / 2n) / divisor;
  return sign * rounded;
}
export function toMicro(value) {
  return decimalToBigInt(value, 6);
}
const fromMicro = (value) => Number(value) / MICRO_PR;
const asMicroBigInt = (value) =>
  typeof value === "bigint" ? value : decimalToBigInt(value, 0);
const sqliteMicro = (value) => asMicroBigInt(value).toString();

function avatarDimensions(buffer, mimeType) {
  if (mimeType === "image/png" && buffer.length >= 24)
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  if (mimeType === "image/webp" && buffer.length >= 30) {
    const kind = buffer.toString("ascii", 12, 16);
    if (kind === "VP8X")
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    if (kind === "VP8 " && buffer.toString("hex", 23, 26) === "9d012a")
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    if (kind === "VP8L" && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }
  return null;
}

export function parseAvatarDataUrl(value) {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(
      String(value ?? ""),
    );
  if (!match) throw new Error("Avatar PNG, JPEG veya WebP olmalı.");
  const mimeType = match[1].toLowerCase(),
    buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > 2 * 1024 * 1024)
    throw new Error("Avatar en fazla 2 MB olabilir.");
  const valid =
    mimeType === "image/png"
      ? buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : mimeType === "image/jpeg"
        ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
        : buffer.toString("ascii", 0, 4) === "RIFF" &&
          buffer.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new Error("Avatar dosya imzası geçersiz.");
  const dimensions = avatarDimensions(buffer, mimeType);
  if (
    !dimensions ||
    dimensions.width < 32 ||
    dimensions.height < 32 ||
    dimensions.width > 2048 ||
    dimensions.height > 2048
  )
    throw new Error("Avatar 32×32 ile 2048×2048 piksel arasında olmalı.");
  return {
    mimeType,
    buffer,
    width: dimensions.width,
    height: dimensions.height,
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator < 0
          ? [part, ""]
          : [
              part.slice(0, separator),
              decodeURIComponent(part.slice(separator + 1)),
            ];
      }),
  );
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username_display,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    lastSeenAt: row.last_seen_at,
    avatarId: row.avatar_id ?? "monogram-gold",
    balance: fromMicro(row.balance_micro ?? 0),
    walletVersion: Number(row.wallet_version ?? row.version ?? 0),
  };
}

async function passwordHash(password) {
  const N = 32768,
    r = 8,
    p = 1;
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 32, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;
}

async function passwordMatches(password, encoded) {
  try {
    const [algorithm, n, r, p, salt, expected] = String(encoded).split("$");
    if (algorithm !== "scrypt") return false;
    const expectedBuffer = Buffer.from(expected, "base64");
    const actual = await scrypt(
      password,
      Buffer.from(salt, "base64"),
      expectedBuffer.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: 128 * 1024 * 1024,
      },
    );
    return (
      expectedBuffer.length === actual.length &&
      timingSafeEqual(expectedBuffer, actual)
    );
  } catch {
    return false;
  }
}

function isLocalHost(request) {
  const authority = String(request.headers.host ?? "").toLowerCase();
  const host = authority.startsWith("[")
    ? authority.slice(0, authority.indexOf("]") + 1)
    : authority.split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function cookie(request, token, remember = false) {
  const forwardedHost = String(
    request.headers["x-forwarded-host"] ?? request.headers.host ?? "",
  )
    .split(",")[0]
    .trim();
  const secure =
    String(request.headers["x-forwarded-proto"] ?? "").includes("https") ||
    forwardedHost.split(":")[0].endsWith(".ts.net");
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}${remember ? "; Max-Age=2592000" : ""}`;
}

export function createAccountSystem(database) {
  const testAutoLoginUserId = String(
    process.env.PEHLEVAN_TEST_AUTO_LOGIN_USER_ID ?? "",
  ).trim();
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username_normalized TEXT UNIQUE NOT NULL,
      username_display TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','admin','player')),
      status TEXT NOT NULL CHECK(status IN ('pending','active','suspended','rejected')),
      registration_note TEXT,
      admin_note TEXT,
      approved_by TEXT REFERENCES users(id),
      approved_at TEXT,
      suspended_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS user_credentials (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      password_changed_at TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    );
    CREATE TABLE IF NOT EXISTS user_avatar_uploads (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,image_blob BLOB NOT NULL,content_hash TEXT NOT NULL,
      width INTEGER NOT NULL,height INTEGER NOT NULL,updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      csrf_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      user_agent_label TEXT,
      ip_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, revoked_at);
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL DEFAULT 'PR',
      balance_micro INTEGER NOT NULL CHECK(balance_micro >= 0),
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallet_ledger_v2 (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      round_id TEXT,
      game TEXT,
      actor_user_id TEXT REFERENCES users(id),
      type TEXT NOT NULL,
      amount_micro INTEGER NOT NULL,
      balance_before_micro INTEGER NOT NULL,
      balance_after_micro INTEGER NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      reason TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_v2_user_time ON wallet_ledger_v2(user_id, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS game_profiles (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      version INTEGER NOT NULL,
      math_json TEXT NOT NULL,
      experience_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(game_id, name, version)
    );
    CREATE TABLE IF NOT EXISTS user_game_profiles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      profile_id TEXT NOT NULL REFERENCES game_profiles(id),
      override_json TEXT,
      assigned_by TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY(user_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      target_user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      reason TEXT,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_log(occurred_at DESC);
  `);

  if (
    !database
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((column) => column.name === "avatar_id")
  ) {
    database.exec(
      "ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'monogram-gold'",
    );
  }

  const createdAt = now();
  const legacyProfile = database
    .prepare(
      "SELECT value_json FROM casino_meta WHERE key = 'account:pehlivan:profile-v1'",
    )
    .get();
  let legacyBalance = 5000;
  try {
    legacyBalance = Math.max(
      0,
      Number(JSON.parse(legacyProfile?.value_json ?? "{}").balance ?? 5000),
    );
  } catch {
    /* keep default */
  }
  database
    .prepare(
      `INSERT INTO users(id,username_normalized,username_display,display_name,role,status,created_at,updated_at)
    VALUES(?,?,?,?,?,'active',?,?) ON CONFLICT(id) DO NOTHING`,
    )
    .run(
      OWNER_ID,
      "pehlevan",
      "Pehlevan",
      "Muharrem Pehlevan",
      "owner",
      createdAt,
      createdAt,
    );
  database
    .prepare(
      "UPDATE users SET username_normalized=?,username_display=?,display_name=?,updated_at=? WHERE id=?",
    )
    .run("pehlevan", "Pehlevan", "Muharrem Pehlevan", createdAt, OWNER_ID);
  database
    .prepare(
      `INSERT INTO wallets(user_id,balance_micro,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING`,
    )
    .run(OWNER_ID, sqliteMicro(toMicro(legacyBalance)), createdAt);

  for (const gameId of [
    "blackjack",
    "roulette",
    "poker",
    "kiraz-77",
    "neon-kasasi",
    "kaptan-mercan",
    "sekerhane-1024",
    "allahin-lutfu",
    "baykus-madeni",
    "altin-rota",
    "obsidyen-damari",
    "son-on",
    "plinko",
    "hilo",
    "yedi-cevher",
  ]) {
    database
      .prepare(
        `INSERT INTO game_profiles(id,game_id,name,kind,version,math_json,experience_json,created_by,created_at,updated_at)
      VALUES(?,?,?,'standard',1,'{}','{}',?,?,?) ON CONFLICT(game_id,name,version) DO NOTHING`,
      )
      .run(
        `profile-${gameId}-standard-v1`,
        gameId,
        "Standart",
        OWNER_ID,
        createdAt,
        createdAt,
      );
  }

  for (const table of [
    "game_rounds",
    "wallet_ledger",
    "game_events",
    "ai_conversations",
  ]) {
    const columns = new Set(
      database
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((entry) => entry.name),
    );
    if (!columns.has("user_id"))
      database.exec(
        `ALTER TABLE ${table} ADD COLUMN user_id TEXT REFERENCES users(id)`,
      );
    database
      .prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`)
      .run(OWNER_ID);
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_${table}_user ON ${table}(user_id)`,
    );
  }
  database
    .prepare(
      "INSERT INTO schema_info(key,value) VALUES('schema_version','5') ON CONFLICT(key) DO UPDATE SET value='5'",
    )
    .run();

  const audit = (
    actor,
    target,
    action,
    entityType,
    entityId,
    before,
    after,
    reason,
  ) => {
    database
      .prepare(
        `INSERT INTO admin_audit_log(id,actor_user_id,target_user_id,action,entity_type,entity_id,before_json,after_json,reason,occurred_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id("audit"),
        actor,
        target ?? null,
        action,
        entityType,
        entityId ?? null,
        before == null ? null : JSON.stringify(before),
        after == null ? null : JSON.stringify(after),
        reason ?? null,
        now(),
      );
  };

  const currentSession = (request) => {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const session = database
      .prepare(
        `SELECT s.*,s.last_seen_at session_last_seen_at,u.username_display,u.display_name,u.role,u.status,u.avatar_id,u.created_at,u.approved_at,u.last_seen_at,CAST(w.balance_micro AS TEXT) balance_micro,w.version wallet_version,w.updated_at wallet_updated_at
      FROM sessions s JOIN users u ON u.id=s.user_id JOIN wallets w ON w.user_id=u.id
      WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`,
      )
      .get(sha256(token), now());
    if (!session || session.status !== "active") return null;
    // Authentication/revocation is still checked on every request. Presence only
    // needs minute precision; polling must not force two disk writes per request.
    const seenAt = now();
    if (Date.parse(seenAt) - Date.parse(session.session_last_seen_at) >= 60_000) {
      database.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").run(seenAt, session.id);
      database.prepare("UPDATE users SET last_seen_at=? WHERE id=?").run(seenAt, session.user_id);
    }
    return {
      session,
      user: { id: session.user_id, role: session.role, status: session.status },
      public: publicUser({ ...session, id: session.user_id }),
    };
  };

  const requireSession = (request, response, roles) => {
    const auth = currentSession(request);
    if (!auth) {
      json(response, 401, { error: "Oturum gerekli.", code: "AUTH_REQUIRED" });
      return null;
    }
    if (roles && !roles.includes(auth.user.role)) {
      json(response, 403, {
        error: "Bu işlem için yetkiniz yok.",
        code: "FORBIDDEN",
      });
      return null;
    }
    const origin = request.headers.origin;
    if (origin) {
      try {
        const expectedHost = String(
          request.headers["x-forwarded-host"] ?? request.headers.host ?? "",
        )
          .split(",")[0]
          .trim();
        if (new URL(origin).host !== expectedHost) {
          json(response, 403, {
            error: "İstek kaynağı doğrulanamadı.",
            code: "ORIGIN",
          });
          return null;
        }
      } catch {
        json(response, 403, {
          error: "İstek kaynağı geçersiz.",
          code: "ORIGIN",
        });
        return null;
      }
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method ?? "GET") &&
      request.headers["x-csrf-token"] !== auth.session.csrf_token
    ) {
      json(response, 403, {
        error: "Güvenlik doğrulaması başarısız.",
        code: "CSRF",
      });
      return null;
    }
    return auth;
  };

  const createSession = (request, response, user, remember) => {
    const token = randomBytes(32).toString("base64url");
    const csrf = randomBytes(24).toString("base64url");
    const created = new Date();
    const expires = new Date(
      created.getTime() + (remember ? 30 : 7) * 24 * 60 * 60 * 1000,
    );
    database
      .prepare(
        `INSERT INTO sessions(id,user_id,token_hash,csrf_token,created_at,last_seen_at,expires_at,user_agent_label,ip_hash)
      VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id("session"),
        user.id,
        sha256(token),
        csrf,
        created.toISOString(),
        created.toISOString(),
        expires.toISOString(),
        String(request.headers["user-agent"] ?? "").slice(0, 180),
        sha256(String(request.socket?.remoteAddress ?? "")).slice(0, 24),
      );
    response.setHeader("Set-Cookie", cookie(request, token, remember));
    return { user: publicUser(user), csrfToken: csrf };
  };

  const ownerNeedsSetup = () =>
    !database
      .prepare("SELECT 1 FROM user_credentials WHERE user_id=?")
      .get(OWNER_ID);

  const handleAuth = async (request, response, url) => {
    const path = url.pathname;
    if (
      !path.startsWith("/api/auth") &&
      !path.startsWith("/api/me") &&
      !path.startsWith("/api/avatars/") &&
      !path.startsWith("/api/admin/accounts")
    )
      return false;
    try {
      const avatarMatch = path.match(/^\/api\/avatars\/([^/]+)$/);
      if (request.method === "GET" && avatarMatch) {
        const auth = currentSession(request);
        if (!auth) {
          json(response, 401, { error: "Oturum gerekli." });
          return true;
        }
        const row = database
          .prepare(
            "SELECT mime_type,image_blob,content_hash FROM user_avatar_uploads WHERE user_id=?",
          )
          .get(decodeURIComponent(avatarMatch[1]));
        if (!row) {
          json(response, 404, { error: "Özel avatar bulunamadı." });
          return true;
        }
        const etag = `"${row.content_hash}"`;
        if (request.headers["if-none-match"] === etag) {
          response.statusCode = 304;
          response.setHeader("ETag", etag);
          response.end();
          return true;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", row.mime_type);
        response.setHeader("Content-Length", row.image_blob.length);
        response.setHeader("Cache-Control", "private, no-cache");
        response.setHeader("ETag", etag);
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(row.image_blob);
        return true;
      }
      if (request.method === "GET" && path === "/api/auth/status") {
        json(response, 200, {
          needsOwnerSetup: ownerNeedsSetup(),
          localSetupAllowed: isLocalHost(request),
        });
        return true;
      }
      if (request.method === "POST" && path === "/api/auth/bootstrap-owner") {
        if (!ownerNeedsSetup()) {
          json(response, 409, {
            error: "Muharrem Pehlevan hesabı zaten hazır.",
          });
          return true;
        }
        if (!isLocalHost(request)) {
          json(response, 403, {
            error:
              "İlk Muharrem Pehlevan kurulumu yalnız bu bilgisayardan yapılabilir.",
          });
          return true;
        }
        const payload = await body(request);
        if (String(payload.password ?? "").length < 8) {
          json(response, 400, { error: "Parola en az 8 karakter olmalı." });
          return true;
        }
        const hash = await passwordHash(String(payload.password));
        const displayName =
          String(payload.displayName ?? "Muharrem Pehlevan")
            .trim()
            .slice(0, 60) || "Muharrem Pehlevan";
        database.exec("BEGIN IMMEDIATE");
        try {
          database
            .prepare("UPDATE users SET display_name=?,updated_at=? WHERE id=?")
            .run(displayName, now(), OWNER_ID);
          database
            .prepare(
              "INSERT INTO user_credentials(user_id,password_hash,password_changed_at) VALUES(?,?,?)",
            )
            .run(OWNER_ID, hash, now());
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        const user = database
          .prepare(
            "SELECT u.*,CAST(w.balance_micro AS TEXT) balance_micro,w.version wallet_version,w.updated_at wallet_updated_at FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.id=?",
          )
          .get(OWNER_ID);
        json(response, 200, createSession(request, response, user, false));
        return true;
      }
      if (request.method === "POST" && path === "/api/auth/register") {
        if (ownerNeedsSetup()) {
          json(response, 503, {
            error: "Önce Muharrem Pehlevan hesabı hazırlanmalı.",
          });
          return true;
        }
        const registrationKey = sha256(
          String(request.socket?.remoteAddress ?? ""),
        ).slice(0, 24);
        const recentRegistrations = (
          registrationAttempts.get(registrationKey) ?? []
        ).filter((timestamp) => timestamp > Date.now() - 60 * 60 * 1000);
        if (recentRegistrations.length >= 5) {
          json(response, 429, {
            error:
              "Bu bağlantıdan çok fazla kayıt başvurusu yapıldı. Bir saat sonra tekrar deneyin.",
          });
          return true;
        }
        const payload = await body(request);
        const usernameDisplay = String(payload.username ?? "")
          .normalize("NFKC")
          .trim();
        const username = normalizeUsername(usernameDisplay);
        const displayName = String(payload.displayName ?? "")
          .normalize("NFKC")
          .trim();
        const password = String(payload.password ?? "");
        if (
          username.length < 3 ||
          username.length > 24 ||
          !/^[\p{L}\p{N}._-]+$/u.test(username)
        ) {
          json(response, 400, {
            error:
              "Kullanıcı adı 3–24 karakter olmalı; harf, sayı, nokta, tire ve alt çizgi kullanılabilir.",
          });
          return true;
        }
        if (displayName.length < 2 || displayName.length > 60) {
          json(response, 400, { error: "Görünen ad 2–60 karakter olmalı." });
          return true;
        }
        if (password.length < 8 || password.length > 128) {
          json(response, 400, { error: "Parola 8–128 karakter olmalı." });
          return true;
        }
        if (
          database
            .prepare("SELECT 1 FROM users WHERE username_normalized=?")
            .get(username)
        ) {
          json(response, 409, { error: "Bu kullanıcı adı kullanılıyor." });
          return true;
        }
        const userId = id("user"),
          timestamp = now(),
          hash = await passwordHash(password);
        database.exec("BEGIN IMMEDIATE");
        try {
          database
            .prepare(
              `INSERT INTO users(id,username_normalized,username_display,display_name,role,status,registration_note,created_at,updated_at)
            VALUES(?,?,?,?,?,'pending',?,?,?)`,
            )
            .run(
              userId,
              username,
              usernameDisplay,
              displayName,
              "player",
              String(payload.note ?? "")
                .trim()
                .slice(0, 500),
              timestamp,
              timestamp,
            );
          database
            .prepare(
              "INSERT INTO user_credentials(user_id,password_hash,password_changed_at) VALUES(?,?,?)",
            )
            .run(userId, hash, timestamp);
          database
            .prepare(
              "INSERT INTO wallets(user_id,balance_micro,updated_at) VALUES(?,0,?)",
            )
            .run(userId, timestamp);
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        registrationAttempts.set(registrationKey, [
          ...recentRegistrations,
          Date.now(),
        ]);
        json(response, 201, {
          ok: true,
          status: "pending",
          message: "Kaydın Muharrem Pehlevan onayına gönderildi.",
        });
        return true;
      }
      if (request.method === "POST" && path === "/api/auth/login") {
        const payload = await body(request);
        const username = normalizeUsername(payload.username);
        const attemptKey = `${String(request.socket?.remoteAddress ?? "")}:${username}`;
        const attempt = loginAttempts.get(attemptKey);
        if (attempt?.until > Date.now()) {
          json(response, 429, {
            error: "Çok fazla deneme. Biraz sonra tekrar deneyin.",
          });
          return true;
        }
        const user = database
          .prepare(
            `SELECT u.*,c.password_hash,c.locked_until,CAST(w.balance_micro AS TEXT) balance_micro,w.version wallet_version,w.updated_at wallet_updated_at FROM users u
          JOIN user_credentials c ON c.user_id=u.id JOIN wallets w ON w.user_id=u.id WHERE u.username_normalized=?`,
          )
          .get(username);
        const valid =
          user &&
          (await passwordMatches(
            String(payload.password ?? ""),
            user.password_hash,
          ));
        if (!valid) {
          const count = (attempt?.count ?? 0) + 1;
          loginAttempts.set(attemptKey, {
            count,
            until:
              count >= 5 ? Date.now() + Math.min(300_000, 15_000 * count) : 0,
          });
          json(response, 401, { error: "Kullanıcı adı veya parola yanlış." });
          return true;
        }
        loginAttempts.delete(attemptKey);
        if (user.status !== "active") {
          json(response, 403, {
            error:
              user.status === "pending"
                ? "Hesabın Muharrem Pehlevan onayı bekliyor."
                : user.status === "suspended"
                  ? `Hesabın askıda.${user.suspended_reason ? ` ${user.suspended_reason}` : ""}`
                  : "Kayıt başvurusu reddedildi.",
            status: user.status,
          });
          return true;
        }
        json(
          response,
          200,
          createSession(request, response, user, Boolean(payload.remember)),
        );
        return true;
      }
      if (request.method === "GET" && path === "/api/auth/me") {
        let auth = currentSession(request);
        if (!auth && testAutoLoginUserId && isLocalHost(request)) {
          const testUser = database
            .prepare(
              `SELECT u.*,CAST(w.balance_micro AS TEXT) balance_micro,w.version wallet_version,w.updated_at wallet_updated_at
               FROM users u JOIN wallets w ON w.user_id=u.id
               WHERE u.id=? AND u.status='active'`,
            )
            .get(testAutoLoginUserId);
          if (testUser) {
            json(response, 200, {
              authenticated: true,
              ...createSession(request, response, testUser, true),
            });
            return true;
          }
        }
        json(
          response,
          200,
          auth
            ? {
                authenticated: true,
                user: auth.public,
                csrfToken: auth.session.csrf_token,
              }
            : { authenticated: false, needsOwnerSetup: ownerNeedsSetup() },
        );
        return true;
      }
      if (request.method === "POST" && path === "/api/auth/logout") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        database
          .prepare("UPDATE sessions SET revoked_at=? WHERE id=?")
          .run(now(), auth.session.id);
        response.setHeader(
          "Set-Cookie",
          `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
        );
        json(response, 200, { ok: true });
        return true;
      }
      if (request.method === "GET" && path === "/api/me/wallet") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const wallet = database
          .prepare(
            "SELECT CAST(balance_micro AS TEXT) balance_micro,version,updated_at FROM wallets WHERE user_id=?",
          )
          .get(auth.user.id);
        json(response, 200, {
          balance: fromMicro(wallet.balance_micro),
          version: Number(wallet.version),
          updatedAt: wallet.updated_at,
        });
        return true;
      }
      if (request.method === "POST" && path === "/api/me/avatar") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const payload = await body(request);
        const avatarId = String(payload.avatarId ?? "");
        if (!AVATAR_IDS.includes(avatarId)) {
          json(response, 400, { error: "Avatar seçimi geçersiz." });
          return true;
        }
        database
          .prepare("UPDATE users SET avatar_id=?,updated_at=? WHERE id=?")
          .run(avatarId, now(), auth.user.id);
        json(response, 200, { ok: true, avatarId });
        return true;
      }
      if (request.method === "POST" && path === "/api/me/avatar-upload") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const payload = await body(request, 3 * 1024 * 1024);
        const avatar = parseAvatarDataUrl(payload.dataUrl),
          timestamp = now();
        database.exec("BEGIN IMMEDIATE");
        try {
          database
            .prepare(
              `INSERT INTO user_avatar_uploads(user_id,mime_type,image_blob,content_hash,width,height,updated_at)
            VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mime_type=excluded.mime_type,image_blob=excluded.image_blob,
            content_hash=excluded.content_hash,width=excluded.width,height=excluded.height,updated_at=excluded.updated_at`,
            )
            .run(
              auth.user.id,
              avatar.mimeType,
              avatar.buffer,
              avatar.hash,
              avatar.width,
              avatar.height,
              timestamp,
            );
          database
            .prepare(
              "UPDATE users SET avatar_id='custom',updated_at=? WHERE id=?",
            )
            .run(timestamp, auth.user.id);
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        json(response, 200, {
          ok: true,
          avatarId: "custom",
          version: avatar.hash.slice(0, 12),
          width: avatar.width,
          height: avatar.height,
        });
        return true;
      }
      if (request.method === "GET" && path === "/api/me/game-profiles") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const profiles = database
          .prepare(
            "SELECT DISTINCT game_id FROM game_profiles WHERE active=1 ORDER BY game_id",
          )
          .all()
          .map((entry) => ({
            gameId: entry.game_id,
            ...effectiveProfile(auth.user.id, entry.game_id),
          }))
          .filter((profile) => profile.id);
        json(response, 200, { profiles });
        return true;
      }
      if (request.method === "GET" && path === "/api/me/sessions") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const sessions = database
          .prepare(
            `SELECT id,created_at,last_seen_at,expires_at,user_agent_label,CASE WHEN id=? THEN 1 ELSE 0 END current
          FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC`,
          )
          .all(auth.session.id, auth.user.id, now())
          .map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            lastSeenAt: row.last_seen_at,
            expiresAt: row.expires_at,
            device: row.user_agent_label,
            current: Boolean(row.current),
          }));
        json(response, 200, { sessions });
        return true;
      }
      const sessionMatch = path.match(/^\/api\/me\/sessions\/([^/]+)$/);
      if (request.method === "DELETE" && sessionMatch) {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const sessionId = decodeURIComponent(sessionMatch[1]);
        if (sessionId === auth.session.id) {
          json(response, 400, {
            error: "Mevcut oturum için “hesaptan çık” kullanın.",
          });
          return true;
        }
        const result = database
          .prepare(
            "UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL",
          )
          .run(now(), sessionId, auth.user.id);
        if (!result.changes) {
          json(response, 404, { error: "Oturum bulunamadı." });
          return true;
        }
        audit(
          auth.user.id,
          auth.user.id,
          "session.revoke",
          "session",
          sessionId,
          null,
          { revoked: true },
          "Kullanıcı cihaz oturumunu kapattı",
        );
        json(response, 200, { ok: true });
        return true;
      }
      if (request.method === "POST" && path === "/api/me/password") {
        const auth = requireSession(request, response);
        if (!auth) return true;
        const payload = await body(request);
        const credential = database
          .prepare("SELECT password_hash FROM user_credentials WHERE user_id=?")
          .get(auth.user.id);
        if (
          !(await passwordMatches(
            String(payload.currentPassword ?? ""),
            credential?.password_hash,
          ))
        ) {
          json(response, 400, { error: "Mevcut parola yanlış." });
          return true;
        }
        if (
          String(payload.newPassword ?? "").length < 8 ||
          String(payload.newPassword ?? "").length > 128
        ) {
          json(response, 400, { error: "Yeni parola 8–128 karakter olmalı." });
          return true;
        }
        const nextHash = await passwordHash(String(payload.newPassword));
        database.exec("BEGIN IMMEDIATE");
        try {
          database
            .prepare(
              "UPDATE user_credentials SET password_hash=?,password_changed_at=? WHERE user_id=?",
            )
            .run(nextHash, now(), auth.user.id);
          database
            .prepare(
              "UPDATE sessions SET revoked_at=? WHERE user_id=? AND id<>? AND revoked_at IS NULL",
            )
            .run(now(), auth.user.id, auth.session.id);
          audit(
            auth.user.id,
            auth.user.id,
            "password.change",
            "credential",
            auth.user.id,
            null,
            { otherSessionsRevoked: true },
            "Kullanıcı parolasını değiştirdi",
          );
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        json(response, 200, { ok: true });
        return true;
      }
      if (request.method === "GET" && path === "/api/admin/accounts/users") {
        const auth = requireSession(request, response, ["owner", "admin"]);
        if (!auth) return true;
        const users = database
          .prepare(
            `SELECT u.*,CAST(w.balance_micro AS TEXT) balance_micro,w.version wallet_version,w.updated_at wallet_updated_at,
          (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>?) AS active_sessions
          FROM users u JOIN wallets w ON w.user_id=u.id ORDER BY CASE u.status WHEN 'pending' THEN 0 ELSE 1 END,u.created_at DESC`,
          )
          .all(now())
          .map((row) => ({
            ...publicUser(row),
            registrationNote: row.registration_note,
            adminNote: row.admin_note,
            suspendedReason: row.suspended_reason,
            activeSessions: Number(row.active_sessions),
          }));
        json(response, 200, { users });
        return true;
      }
      const userMatch = path.match(
        /^\/api\/admin\/accounts\/users\/([^/]+)\/(approve|reject|suspend|activate|wallet|role|profile)$/,
      );
      if (request.method === "POST" && userMatch) {
        const auth = requireSession(request, response, ["owner", "admin"]);
        if (!auth) return true;
        const targetId = decodeURIComponent(userMatch[1]),
          action = userMatch[2];
        const target = database
          .prepare(
            "SELECT u.*,CAST(w.balance_micro AS TEXT) balance_micro,w.version wallet_version,w.updated_at wallet_updated_at FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.id=?",
          )
          .get(targetId);
        if (!target) {
          json(response, 404, { error: "Kullanıcı bulunamadı." });
          return true;
        }
        if (target.role === "owner" && auth.user.id !== targetId) {
          json(response, 403, {
            error: "Muharrem Pehlevan hesabı değiştirilemez.",
          });
          return true;
        }
        const payload = await body(request);
        if (action === "role") {
          if (auth.user.role !== "owner") {
            json(response, 403, {
              error: "Yalnız Muharrem Pehlevan rol değiştirebilir.",
            });
            return true;
          }
          const role = String(payload.role);
          if (!["admin", "player"].includes(role) || target.role === "owner") {
            json(response, 400, { error: "Geçersiz rol değişikliği." });
            return true;
          }
          database
            .prepare("UPDATE users SET role=?,updated_at=? WHERE id=?")
            .run(role, now(), targetId);
          audit(
            auth.user.id,
            targetId,
            "user.role",
            "user",
            targetId,
            { role: target.role },
            { role },
            payload.reason,
          );
          json(response, 200, { ok: true });
          return true;
        }
        if (action === "profile") {
          const gameId = String(payload.gameId ?? ""),
            profileId = String(payload.profileId ?? "");
          const profile = database
            .prepare(
              "SELECT * FROM game_profiles WHERE id=? AND game_id=? AND active=1",
            )
            .get(profileId, gameId);
          if (!profile) {
            json(response, 400, { error: "Oyun profili bulunamadı." });
            return true;
          }
          const reason = String(payload.reason ?? "").trim();
          database
            .prepare(
              `INSERT INTO user_game_profiles(user_id,game_id,profile_id,override_json,assigned_by,reason,assigned_at)
            VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,game_id) DO UPDATE SET profile_id=excluded.profile_id,override_json=excluded.override_json,assigned_by=excluded.assigned_by,reason=excluded.reason,assigned_at=excluded.assigned_at`,
            )
            .run(
              targetId,
              gameId,
              profileId,
              payload.override ? JSON.stringify(payload.override) : null,
              auth.user.id,
              reason || "Muharrem Pehlevan profil ataması",
              now(),
            );
          audit(
            auth.user.id,
            targetId,
            "profile.assign",
            "game_profile",
            profileId,
            null,
            { gameId, profileId, override: payload.override ?? null },
            reason,
          );
          json(response, 200, { ok: true });
          return true;
        }
        if (action === "wallet") {
          const amountMicro = toMicro(payload.amount);
          if (amountMicro === 0n) {
            json(response, 400, { error: "Geçerli bir tutar girin." });
            return true;
          }
          const before = asMicroBigInt(target.balance_micro),
            after = before + amountMicro;
          if (after < 0n) {
            json(response, 400, { error: "Bakiye negatif olamaz." });
            return true;
          }
          const reason = String(payload.reason ?? "").trim();
          if (reason.length < 3) {
            json(response, 400, { error: "İşlem sebebi gerekli." });
            return true;
          }
          const ledgerId = id("admin-wallet");
          database.exec("BEGIN IMMEDIATE");
          try {
            database
              .prepare(
                "UPDATE wallets SET balance_micro=?,version=version+1,updated_at=? WHERE user_id=?",
              )
              .run(sqliteMicro(after), now(), targetId);
            database
              .prepare(
                `INSERT INTO wallet_ledger_v2(id,user_id,actor_user_id,type,amount_micro,balance_before_micro,balance_after_micro,idempotency_key,reason,occurred_at)
              VALUES(?,?,?,?,?,?,?,?,?,?)`,
              )
              .run(
                ledgerId,
                targetId,
                auth.user.id,
                amountMicro > 0n ? "admin_credit" : "admin_debit",
                sqliteMicro(amountMicro),
                sqliteMicro(before),
                sqliteMicro(after),
                ledgerId,
                reason,
                now(),
              );
            audit(
              auth.user.id,
              targetId,
              "wallet.adjust",
              "wallet",
              targetId,
              { balance: fromMicro(before) },
              { balance: fromMicro(after), amount: fromMicro(amountMicro) },
              reason,
            );
            database.exec("COMMIT");
          } catch (error) {
            database.exec("ROLLBACK");
            throw error;
          }
          const wallet = database
            .prepare(
              "SELECT CAST(balance_micro AS TEXT) balance_micro,version,updated_at FROM wallets WHERE user_id=?",
            )
            .get(targetId);
          json(response, 200, {
            ok: true,
            balance: fromMicro(wallet.balance_micro),
            version: Number(wallet.version),
            updatedAt: wallet.updated_at,
          });
          return true;
        }
        if (action === "approve") {
          if (database.prepare("SELECT status FROM users WHERE id=?").get(targetId)?.status !== "pending") {
            json(response, 409, { error: "Bu başvuru artık onay beklemiyor. Kullanıcı listesini yenileyin." });
            return true;
          }
          const requestedInitialMicro = toMicro(payload.initialBalance ?? 0);
          const initialMicro =
            requestedInitialMicro > 0n ? requestedInitialMicro : 0n;
          database.exec("BEGIN IMMEDIATE");
          try {
            database
              .prepare(
                "UPDATE users SET status='active',approved_by=?,approved_at=?,updated_at=? WHERE id=?",
              )
              .run(auth.user.id, now(), now(), targetId);
            const before = asMicroBigInt(target.balance_micro);
            database
              .prepare(
                "UPDATE wallets SET balance_micro=?,version=version+1,updated_at=? WHERE user_id=?",
              )
              .run(sqliteMicro(initialMicro), now(), targetId);
            if (initialMicro !== before) {
              const ledgerId = id("approval-credit");
              database
                .prepare(
                  `INSERT INTO wallet_ledger_v2(id,user_id,actor_user_id,type,amount_micro,balance_before_micro,balance_after_micro,idempotency_key,reason,occurred_at)
                VALUES(?,?,?,?,?,?,?,?,?,?)`,
                )
                .run(
                  ledgerId,
                  targetId,
                  auth.user.id,
                  "approval_credit",
                  sqliteMicro(initialMicro - before),
                  sqliteMicro(before),
                  sqliteMicro(initialMicro),
                  ledgerId,
                  String(payload.reason ?? "Hesap onayı ve başlangıç bakiyesi"),
                  now(),
                );
            }
            audit(
              auth.user.id,
              targetId,
              "user.approve",
              "user",
              targetId,
              { status: target.status },
              { status: "active", initialBalance: fromMicro(initialMicro) },
              payload.reason,
            );
            database.exec("COMMIT");
          } catch (error) {
            database.exec("ROLLBACK");
            throw error;
          }
          json(response, 200, { ok: true });
          return true;
        }
        const status =
          action === "reject"
            ? "rejected"
            : action === "suspend"
              ? "suspended"
              : "active";
        if (target.role === "owner" && status !== "active") {
          json(response, 403, {
            error: "Muharrem Pehlevan hesabı askıya alınamaz.",
          });
          return true;
        }
        database.exec("BEGIN IMMEDIATE");
        try {
          database
            .prepare(
              "UPDATE users SET status=?,suspended_reason=?,updated_at=? WHERE id=?",
            )
            .run(
              status,
              status === "suspended"
                ? String(payload.reason ?? "").slice(0, 300)
                : null,
              now(),
              targetId,
            );
          if (status !== "active")
            database
              .prepare(
                "UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
              )
              .run(now(), targetId);
          audit(
            auth.user.id,
            targetId,
            `user.${action}`,
            "user",
            targetId,
            { status: target.status },
            { status },
            payload.reason,
          );
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        json(response, 200, { ok: true });
        return true;
      }
      if (request.method === "GET" && path === "/api/admin/accounts/audit") {
        const auth = requireSession(request, response, ["owner", "admin"]);
        if (!auth) return true;
        const records = database
          .prepare(
            "SELECT * FROM admin_audit_log ORDER BY occurred_at DESC LIMIT 500",
          )
          .all()
          .map((row) => ({
            ...row,
            before: row.before_json ? JSON.parse(row.before_json) : null,
            after: row.after_json ? JSON.parse(row.after_json) : null,
          }));
        json(response, 200, { records });
        return true;
      }
      if (request.method === "GET" && path === "/api/admin/accounts/profiles") {
        const auth = requireSession(request, response, ["owner", "admin"]);
        if (!auth) return true;
        const profiles = database
          .prepare(
            "SELECT * FROM game_profiles WHERE active=1 ORDER BY game_id,name,version DESC",
          )
          .all()
          .map((row) => ({
            id: row.id,
            gameId: row.game_id,
            name: row.name,
            kind: row.kind,
            version: row.version,
            math: JSON.parse(row.math_json),
            experience: JSON.parse(row.experience_json),
          }));
        const assignments = database
          .prepare("SELECT * FROM user_game_profiles ORDER BY assigned_at DESC")
          .all()
          .map((row) => ({
            userId: row.user_id,
            gameId: row.game_id,
            profileId: row.profile_id,
            override: row.override_json ? JSON.parse(row.override_json) : null,
            reason: row.reason,
            assignedAt: row.assigned_at,
          }));
        json(response, 200, { profiles, assignments });
        return true;
      }
      if (
        request.method === "POST" &&
        path === "/api/admin/accounts/profiles"
      ) {
        const auth = requireSession(request, response, ["owner"]);
        if (!auth) return true;
        const payload = await body(request),
          gameId = String(payload.gameId ?? "").trim(),
          name = String(payload.name ?? "")
            .trim()
            .slice(0, 60);
        if (!gameId || name.length < 2) {
          json(response, 400, { error: "Oyun ve profil adı gerekli." });
          return true;
        }
        const version = Number(
          database
            .prepare(
              "SELECT COALESCE(MAX(version),0)+1 next FROM game_profiles WHERE game_id=? AND name=?",
            )
            .get(gameId, name).next,
        );
        const profileId = id("profile");
        database
          .prepare(
            `INSERT INTO game_profiles(id,game_id,name,kind,version,math_json,experience_json,created_by,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            profileId,
            gameId,
            name,
            String(payload.kind ?? "custom"),
            version,
            JSON.stringify(payload.math ?? {}),
            JSON.stringify(payload.experience ?? {}),
            auth.user.id,
            now(),
            now(),
          );
        audit(
          auth.user.id,
          null,
          "profile.create",
          "game_profile",
          profileId,
          null,
          { gameId, name, version },
          payload.reason,
        );
        json(response, 201, { ok: true, id: profileId, version });
        return true;
      }
      json(response, 404, { error: "Hesap uç noktası bulunamadı." });
      return true;
    } catch (error) {
      json(response, 500, {
        error:
          error instanceof Error ? error.message : "Hesap işlemi başarısız.",
      });
      return true;
    }
  };

  const applyGameLedger = (auth, record) => {
    const walletState = () => {
      const wallet = database
        .prepare(
          "SELECT CAST(balance_micro AS TEXT) balance_micro,version,updated_at FROM wallets WHERE user_id=?",
        )
        .get(auth.user.id);
      return {
        balance: fromMicro(wallet.balance_micro),
        version: Number(wallet.version),
        updatedAt: wallet.updated_at,
      };
    };
    const existing = database
      .prepare(
        "SELECT 1 FROM wallet_ledger_v2 WHERE idempotency_key=? AND user_id=?",
      )
      .get(record.id, auth.user.id);
    // A retried old idempotency key must return the CURRENT wallet. Returning
    // that historical row's balance_after value can roll a newer UI backwards.
    if (existing) return walletState();
    if (!["stake", "payout"].includes(record.type))
      throw new Error("Oyuncu yalnız oyun bahis/ödeme kaydı gönderebilir.");
    const amountMicro = toMicro(record.amount);
    if (
      (record.type === "stake" && amountMicro >= 0n) ||
      (record.type === "payout" && amountMicro <= 0n)
    )
      throw new Error("Cüzdan hareketinin işareti geçersiz.");
    database.exec("BEGIN IMMEDIATE");
    try {
      const wallet = database
        .prepare("SELECT CAST(balance_micro AS TEXT) balance_micro FROM wallets WHERE user_id=?")
        .get(auth.user.id);
      const before = asMicroBigInt(wallet.balance_micro),
        after = before + amountMicro;
      if (after < 0n) throw new Error("Yetersiz bakiye.");
      database
        .prepare(
          "UPDATE wallets SET balance_micro=?,version=version+1,updated_at=? WHERE user_id=?",
        )
        .run(sqliteMicro(after), now(), auth.user.id);
      database
        .prepare(
          `INSERT INTO wallet_ledger_v2(id,user_id,round_id,game,type,amount_micro,balance_before_micro,balance_after_micro,idempotency_key,reason,occurred_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          record.id,
          auth.user.id,
          record.roundId ?? null,
          record.game ?? null,
          record.type,
          sqliteMicro(amountMicro),
          sqliteMicro(before),
          sqliteMicro(after),
          record.id,
          String(record.note ?? "Oyun cüzdan hareketi").slice(0, 500),
          record.occurredAt ?? now(),
        );
      database.exec("COMMIT");
      return walletState();
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  };

  const effectiveProfile = (userId, gameId) => {
    const assigned = database
      .prepare(
        `SELECT p.*,a.override_json,a.reason assignment_reason FROM user_game_profiles a
      JOIN game_profiles p ON p.id=a.profile_id WHERE a.user_id=? AND a.game_id=? AND p.active=1`,
      )
      .get(userId, gameId);
    const row =
      assigned ??
      database
        .prepare(
          `SELECT p.*,NULL override_json,NULL assignment_reason FROM game_profiles p
      WHERE p.game_id=? AND p.kind='standard' AND p.active=1 ORDER BY p.version DESC LIMIT 1`,
        )
        .get(gameId);
    if (!row) return null;
    const override = row.override_json ? JSON.parse(row.override_json) : null;
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      version: Number(row.version),
      math: { ...JSON.parse(row.math_json), ...(override?.math ?? {}) },
      experience: {
        ...JSON.parse(row.experience_json),
        ...(override?.experience ?? {}),
      },
      assigned: Boolean(assigned),
      reason: row.assignment_reason ?? null,
    };
  };

  return {
    handleAuth,
    currentSession,
    requireSession,
    applyGameLedger,
    effectiveProfile,
    ownerId: OWNER_ID,
    json,
  };
}
