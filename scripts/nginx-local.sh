#!/usr/bin/env bash
#
# Runs the full production topology locally: nginx in front, Node API behind.
#
#   nginx  :8080   serves the built SPA, proxies /api to the API
#   API    :4000   Node, production mode, JSON only
#
# This is the real arrangement from the droplet, minus TLS. Everything the
# single-origin setup affects — cookies, the CSRF Origin check, deep links,
# cache headers, the proxy hop and X-Forwarded-For — behaves here as it will
# in production.
#
#   ./scripts/nginx-local.sh
#
# Ctrl-C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.nginx-local"
WEB_DIST="$ROOT/apps/web/dist"
API_ENTRY="$ROOT/apps/api/dist/index.js"
PORT_HTTP=8080
PORT_API=4000

command -v nginx >/dev/null 2>&1 || {
  echo "nginx not found. Install it with:  brew install nginx"
  exit 1
}

if [[ ! -f "$WEB_DIST/index.html" || ! -f "$API_ENTRY" ]]; then
  echo "Building..."
  (cd "$ROOT" && npm run build)
fi

# nginx needs somewhere writable for its pid, logs and temp dirs. Keeping them
# in the repo (gitignored) avoids needing root.
mkdir -p "$RUN_DIR"

# mime.types lives next to the nginx binary's default conf; find it rather than
# hardcoding a Homebrew path that differs on Intel and Apple Silicon.
NGINX_PREFIX="$(nginx -V 2>&1 | tr ' ' '\n' | grep -- '--conf-path=' | head -1 | cut -d= -f2 | xargs dirname 2>/dev/null || true)"
MIME_TYPES="${NGINX_PREFIX:-/opt/homebrew/etc/nginx}/mime.types"
[[ -f "$MIME_TYPES" ]] || MIME_TYPES="/usr/local/etc/nginx/mime.types"
[[ -f "$MIME_TYPES" ]] || { echo "Could not locate nginx mime.types"; exit 1; }

CONF="$RUN_DIR/nginx.conf"
sed -e "s|__RUN_DIR__|$RUN_DIR|g" \
    -e "s|__WEB_DIST__|$WEB_DIST|g" \
    -e "s|__MIME_TYPES__|$MIME_TYPES|g" \
    "$ROOT/deploy/nginx.local.conf" > "$CONF"

nginx -t -c "$CONF" -p "$RUN_DIR" >/dev/null 2>&1 || {
  echo "nginx config test failed:"
  nginx -t -c "$CONF" -p "$RUN_DIR"
  exit 1
}

VERSION="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local)"

cleanup() {
  echo ""
  echo "Stopping..."
  [[ -n "${API_PID:-}"   ]] && kill "$API_PID"   2>/dev/null || true
  [[ -n "${NGINX_PID:-}" ]] && kill "$NGINX_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# API: JSON only. nginx serves the static files, so SERVE_STATIC stays off —
# the same division of labour as production.
NODE_ENV=production \
PORT="$PORT_API" \
SERVE_STATIC=false \
DATABASE_PATH="$ROOT/apps/api/data/bktc.db" \
UPLOADS_DIR="$ROOT/apps/api/uploads" \
TMP_DIR="$ROOT/apps/api/tmp" \
APP_ORIGIN="http://localhost:$PORT_HTTP" \
APP_VERSION="$VERSION" \
TRUST_PROXY_HOPS=1 \
LOG_LEVEL="${LOG_LEVEL:-info}" \
  node "$API_ENTRY" &
API_PID=$!

sleep 2
nginx -c "$CONF" -p "$RUN_DIR" &
NGINX_PID=$!
sleep 1

echo ""
echo "  BK Talent Connect — nginx + Node (production topology)"
echo "  ──────────────────────────────────────────────────────"
echo "  App          http://localhost:$PORT_HTTP"
echo "  Health       http://localhost:$PORT_HTTP/api/health"
echo "  Build board  http://localhost:$PORT_HTTP/status"
echo ""
echo "  nginx  :$PORT_HTTP  (static + /api proxy)"
echo "  API    :$PORT_API  (Node, production mode)"
echo "  logs         $RUN_DIR/{access,error}.log"
echo "  version      $VERSION"
echo ""
echo "  Ctrl-C to stop both."
echo ""

wait
