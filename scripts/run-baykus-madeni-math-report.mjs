import { createServer } from "vite";

// Load the same TypeScript engine as the app without starting its database or UI.
const server = await createServer({
  configFile: false,
  cacheDir: ".codex-local/math-vite-cache",
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  await server.ssrLoadModule("/scripts/baykus-madeni-math-report.ts");
} finally {
  await server.close();
}
