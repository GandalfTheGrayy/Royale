import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const STATIC_ASSET_RE = /\/assets\/[^"'`\r\n)]*?\.(?:avif|gif|jpe?g|png|svg|webp|mp3|ogg|wav|woff2?|ttf)(?![\w?#])/gi;
const VITE_HASHED_ASSET_RE = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:css|js|map)$/;

function walk(directory, visit, relative = "") {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const child = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(child, visit, childRelative);
    else visit(child, childRelative);
  }
}

export function currentAssetVersion(root = process.cwd()) {
  const publicAssets = resolve(root, "public", "assets");
  const hash = createHash("sha256");
  walk(publicAssets, (file, relative) => {
    if (relative.endsWith(".webp")) return;
    const stats = statSync(file);
    hash.update(relative.replaceAll("\\", "/"));
    hash.update(String(stats.size));
    hash.update(String(stats.mtimeMs));
  });
  return hash.digest("hex").slice(0, 12);
}

export function versionStaticAssetsPlugin() {
  const version = currentAssetVersion();
  return {
    name: "pehlevan-version-static-assets",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(?:css|jsx?|tsx?)(?:\?|$)/i.test(id) || !code.includes("/assets/")) {
        return null;
      }
      const transformed = code.replace(
        STATIC_ASSET_RE,
        (assetUrl) => `${assetUrl}?v=${version}`,
      );
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

function appendVary(response, value) {
  const current = String(response.getHeader("Vary") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!current.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
    current.push(value);
  }
  response.setHeader("Vary", current.join(", "));
}

function cacheControlFor(pathname, searchParams, preview) {
  if (!preview) return "no-store";
  if (searchParams.has("v") || VITE_HASHED_ASSET_RE.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=0, must-revalidate";
}

function assetMiddleware(server, preview) {
  const root = resolve(server.config.root);
  const distRoot = resolve(root, server.config.build.outDir);

  return (request, response, next) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    let pathname = requestUrl.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      next();
      return;
    }

    if (pathname.startsWith("/api/") || pathname === "/" || pathname.endsWith(".html")) {
      response.setHeader("Cache-Control", "no-store");
    }

    if (!pathname.startsWith("/assets/")) {
      next();
      return;
    }

    response.setHeader(
      "Cache-Control",
      cacheControlFor(pathname, requestUrl.searchParams, preview),
    );
    response.setHeader("X-Content-Type-Options", "nosniff");

    const acceptsWebp = /(?:^|,)\s*image\/webp(?:\s*;|\s*,|$)/i.test(
      request.headers.accept ?? "",
    );
    if (
      !preview ||
      !acceptsWebp ||
      !pathname.toLowerCase().endsWith(".png") ||
      (request.method !== "GET" && request.method !== "HEAD")
    ) {
      next();
      return;
    }

    const candidate = resolve(distRoot, `.${pathname}.webp`);
    if (!candidate.startsWith(`${distRoot}${sep}`) || !existsSync(candidate)) {
      next();
      return;
    }

    const stats = statSync(candidate);
    const etag = `W/"${stats.size}-${stats.mtimeMs}"`;
    appendVary(response, "Accept");
    response.setHeader("Content-Type", "image/webp");
    response.setHeader("Content-Length", String(stats.size));
    response.setHeader("Last-Modified", stats.mtime.toUTCString());
    response.setHeader("ETag", etag);

    if (request.headers["if-none-match"] === etag) {
      response.statusCode = 304;
      response.end();
      return;
    }
    if (request.method === "HEAD") {
      response.statusCode = 200;
      response.end();
      return;
    }
    response.statusCode = 200;
    createReadStream(candidate).pipe(response);
  };
}

export function staticAssetOptimizerPlugin() {
  return {
    name: "pehlevan-static-asset-optimizer",
    configureServer(server) {
      server.middlewares.use(assetMiddleware(server, false));
    },
    configurePreviewServer(server) {
      server.middlewares.use(assetMiddleware(server, true));
    },
  };
}
