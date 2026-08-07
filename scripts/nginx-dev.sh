#!/usr/bin/env bash
#
# Starts everything for local development:
#
#   nginx :8080  ──┬── /     → Vite   :5173  (hot reload)
#                  └── /api  → Node   :4000
#
# Open http://localhost:8080
# Ctrl-C stops all three.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.nginx-local"

command -v nginx >/dev/null 2>&1 || { echo "nginx not found. brew install nginx"; exit 1; }

mkdir -p "$RUN_DIR"

NGINX_PREFIX="$(nginx -V 2>&1 | tr ' ' '\n' | grep -- '--conf-path=' | head -1 | cut -d= -f2 | xargs dirname 2>/dev/null || true)"
MIME_TYPES="${NGINX_PREFIX:-/opt/homebrew/etc/nginx}/mime.types"
[[ -f "$MIME_TYPES" ]] || MIME_TYPES="/usr/local/etc/nginx/mime.types"

CONF="$RUN_DIR/nginx-dev.conf"
sed -e "s|__RUN_DIR__|$RUN_DIR|g" -e "s|__MIME_TYPES__|$MIME_TYPES|g" \
    "$ROOT/deploy/nginx.dev.conf" > "$CONF"

nginx -t -c "$CONF" -p "$RUN_DIR" >/dev/null 2>&1 || { nginx -t -c "$CONF" -p "$RUN_DIR"; exit 1; }

# Free the ports so a stale process from a previous run cannot silently win.
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "nginx-dev.conf" 2>/dev/null || true
sleep 1

cleanup() {
  echo ""
  echo "Stopping..."
  for pid in "${API_PID:-}" "${WEB_PID:-}" "${NGINX_PID:-}"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting API..."
(cd "$ROOT/apps/api" && APP_ORIGIN="http://localhost:8080" TRUST_PROXY_HOPS=1 npm run dev) &
API_PID=$!

echo "Starting web..."
(cd "$ROOT/apps/web" && npm run dev) &
WEB_PID=$!

# Wait for both to answer before putting nginx in front of them.
for i in $(seq 1 40); do
  curl -sf http://localhost:4000/api/health >/dev/null 2>&1 && \
  curl -sf http://localhost:5173/ >/dev/null 2>&1 && break
  sleep 0.5
done

nginx -c "$CONF" -p "$RUN_DIR" &
NGINX_PID=$!
sleep 1

echo ""
echo "  ────────────────────────────────────────────"
echo "   👉  http://localhost:8080"
echo "  ────────────────────────────────────────────"
echo ""
echo "   nginx :8080   → / to Vite, /api to Node"
echo "   web   :5173   Vite, hot reload"
echo "   api   :4000   Node"
echo ""
echo "   Sign in:"
echo "     anita.desai@demo.in / demo-password-1   (candidate, approved)"
echo "     admin@bktalentconnect.com / bktc-admin-2026"
echo ""
echo "   Ctrl-C to stop everything."
echo ""

wait
