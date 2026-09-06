import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createAccountSystem } from "./auth-system.mjs";
import { getCompetitionConfig } from "./competition-system.mjs";

// A separate event loop keeps login and approval responsive during game reports.
// Sessions, credentials and wallets remain in the same transactional database.
export function createAccountServer(databasePath) {
  const database = new DatabaseSync(databasePath, { open: true });
  database.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000; PRAGMA synchronous=NORMAL;");
  const accounts = createAccountSystem(database, { initialize: false });
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/api/casino-data/competition/admin/config" && request.method === "GET") {
        if (!accounts.requireSession(request, response, ["owner", "admin"])) return;
        accounts.json(response, 200, { config: getCompetitionConfig(database) });
        return;
      }
      if (await accounts.handleAuth(request, response, url)) return;
      accounts.json(response, 404, { error: "Hesap uç noktası bulunamadı." });
    } catch (error) {
      console.error(JSON.stringify({ event: "account-error", code: error?.code ?? "UNKNOWN" }));
      if (!response.headersSent) accounts.json(response, 503, { error: "Hesap hizmeti geçici olarak meşgul. Lütfen yeniden deneyin." });
      else response.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on("close", () => database.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = resolve(process.env.PEHLEVAN_DB_DIRECTORY ?? "/var/lib/pehlevan-royale", "pehlevan-royale.sqlite");
  const server = createAccountServer(path);
  server.listen(Number(process.env.PEHLEVAN_ACCOUNT_PORT ?? 4175), "127.0.0.1", () => console.log("Account service ready"));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
}
