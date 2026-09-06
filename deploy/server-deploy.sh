#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/pehlevan-royale"
DATA_DIR="/var/lib/pehlevan-royale"
ASSET_CACHE="/var/cache/pehlevan-royale/lossless-webp-v1"
BRANCH="main"
NODE_BIN="/opt/node-v22.15.0-linux-x64/bin"
SERVICE="pehlevan-royale.service"
HEALTH_URL="http://127.0.0.1:4173/api/auth/status"

if [[ "$(id -u)" != "0" ]]; then
  echo "Bu betik root olarak calistirilmalidir." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Git deposu bulunamadi: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"
if [[ "$(pwd -P)" != "$APP_DIR" ]]; then
  echo "Guvenlik kontrolu basarisiz: beklenmeyen calisma dizini." >&2
  exit 1
fi

if [[ -x "$NODE_BIN/node" && -x "$NODE_BIN/npm" ]]; then
  export PATH="$NODE_BIN:$PATH"
fi

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [[ -z "$node_major" || "$node_major" -lt 22 ]]; then
  echo "Pehlevan Royale Node.js 22 veya daha yeni bir surum gerektirir." >&2
  exit 1
fi

echo "==> Kaynak kod guncelleniyor"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Sunucudaki kaynakta commit edilmemis degisiklik var; guvenlik icin durduruldu." >&2
  exit 1
fi
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"

echo "==> Uretim bagimliliklari kuruluyor"
install -d -o root -g root -m 0755 "$ASSET_CACHE"
legacy_cache="$APP_DIR/node_modules/.cache/pehlevan-lossless-webp-v1"
if [[ -d "$legacy_cache" ]] && ! find "$ASSET_CACHE" -mindepth 1 -print -quit | grep -q .; then
  cp -a "$legacy_cache/." "$ASSET_CACHE/"
fi
export PEHLEVAN_ASSET_CACHE="$ASSET_CACHE"
export PEHLEVAN_ASSET_CONCURRENCY=1
npm ci --no-audit --no-fund

echo "==> Yeni surum ayri dizinde derleniyor"
rm -rf "$APP_DIR/dist-next"
npm exec tsc -- -b --force
npm exec vite build -- --outDir dist-next
node scripts/optimize-static-assets.mjs dist-next/assets

echo "==> Acik tarayicilar icin onceki surum parcalari korunuyor"
if [[ -d "$APP_DIR/dist/assets" ]]; then
  find "$APP_DIR/dist/assets" -maxdepth 1 -type f \
    \( -name '*.js' -o -name '*.css' -o -name '*.map' \) \
    -exec cp -p -n {} "$APP_DIR/dist-next/assets/" \;
fi
find "$APP_DIR/dist-next/assets" -maxdepth 1 -type f \
  \( -name '*.js' -o -name '*.css' -o -name '*.map' \) \
  -mtime +14 -delete

echo "==> Sistem kullanicisi ve kalici veri dizini hazirlaniyor"
if ! id -u royale >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin royale
fi
install -d -o royale -g royale -m 0750 "$DATA_DIR"
install -d -o royale -g royale -m 0750 "$APP_DIR/node_modules/.vite-temp"

echo "==> systemd servisi kuruluyor"
install -o root -g root -m 0644 deploy/pehlevan-royale.service /etc/systemd/system/pehlevan-royale.service
systemctl daemon-reload

echo "==> Caddy sitesi kuruluyor"
install -d -o root -g root -m 0755 /etc/caddy/conf.d
install -o root -g root -m 0644 deploy/pehlevan-royale.caddy /etc/caddy/conf.d/pehlevan-royale.caddy
if ! grep -Fq 'import /etc/caddy/conf.d/*.caddy' /etc/caddy/Caddyfile; then
  printf '\nimport /etc/caddy/conf.d/*.caddy\n' >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

echo "==> Yeni surum atomik olarak etkinlestiriliyor"
rm -rf "$APP_DIR/dist-previous"
if [[ -d "$APP_DIR/dist" ]]; then
  mv "$APP_DIR/dist" "$APP_DIR/dist-previous"
fi
mv "$APP_DIR/dist-next" "$APP_DIR/dist"

systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"

healthy=0
for attempt in {1..30}; do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [[ "$healthy" != "1" ]]; then
  echo "Yeni surum saglik kontrolunu gecemedi; onceki surume donuluyor." >&2
  systemctl stop "$SERVICE" || true
  rm -rf "$APP_DIR/dist"
  if [[ -d "$APP_DIR/dist-previous" ]]; then
    mv "$APP_DIR/dist-previous" "$APP_DIR/dist"
    systemctl start "$SERVICE"
  fi
  journalctl -u "$SERVICE" -n 80 --no-pager >&2 || true
  exit 1
fi

rm -rf "$APP_DIR/dist-previous"
echo "==> Dagitim tamamlandi: $(git rev-parse --short HEAD)"
systemctl --no-pager --full status "$SERVICE" | sed -n '1,12p'
