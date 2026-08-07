#!/usr/bin/env bash
#
# Atomic release deploy.
#
#   /var/www/bktc/releases/<sha>/{web,api,node_modules}
#   /var/www/bktc/current -> releases/<sha>      # the switch
#   /var/www/bktc/shared/{data,uploads,.env}     # never inside a release
#
# Run ON THE DROPLET, against an already-uploaded release directory. Two things
# are deliberate:
#
#   1. NOTHING IS BUILT HERE. `tsc` across three workspaces plus a Vite build
#      peaks over 1GB, and the contract specifies a 1 vCPU / 1GB droplet. The
#      build happens locally or in Actions; this script installs production
#      dependencies only.
#
#   2. `npm ci --omit=dev` RUNS ON TARGET. better-sqlite3 is a native addon —
#      an Apple Silicon .node binary will not load on Ubuntu x86_64, so
#      node_modules cannot be shipped, only rebuilt here.
#
# Usage:
#   deploy/deploy.sh <sha>
#
# Plan reference: BLOCKER-4, BLOCKER-6.

set -euo pipefail

SHA="${1:-}"
APP_DIR="${BKTC_APP_DIR:-/var/www/bktc}"
PM2_APP="${BKTC_PM2_APP:-bktc-api}"
HEALTH_URL="${BKTC_HEALTH_URL:-http://127.0.0.1:4000/api/health}"

RELEASE="$APP_DIR/releases/$SHA"
CURRENT="$APP_DIR/current"

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }

[ -n "$SHA" ] || fail "usage: deploy.sh <sha>"
[ -d "$RELEASE" ] || fail "no release at $RELEASE — upload it first"
[ -f "$RELEASE/api/index.js" ] || fail "$RELEASE/api looks unbuilt"
[ -f "$RELEASE/web/index.html" ] || fail "$RELEASE/web looks unbuilt"

PREVIOUS=""
if [ -L "$CURRENT" ]; then
  PREVIOUS="$(readlink -f "$CURRENT")"
  log "current release is $PREVIOUS"
fi

# --- Dependencies ----------------------------------------------------------

log "installing production dependencies on target"
( cd "$RELEASE" && npm ci --omit=dev --no-audit --no-fund ) || fail "npm ci failed"

log "checking the native binding loads"
( cd "$RELEASE" && node -e "require('better-sqlite3'); console.log('better-sqlite3 ok')" ) ||
  fail "better-sqlite3 will not load — wrong architecture or a failed build"

# --- Backup, then migrate --------------------------------------------------
#
# In this order, always. A migration that goes wrong with no backup taken
# minutes earlier is the incident this whole file is arranged to avoid.

log "taking a backup before migrating"
"$APP_DIR/current/deploy/backup.sh" 2>/dev/null || "$RELEASE/deploy/backup.sh" || fail "backup failed"

log "running migrations"
( cd "$RELEASE" && NODE_ENV=production node api/db/migrate.js ) || fail "migration failed"

# --- Flip ------------------------------------------------------------------
#
# ln -sfn to a temp name then mv is atomic; `ln -sf` over an existing symlink
# to a directory silently creates the link INSIDE it instead.

log "switching current -> releases/$SHA"
echo "$SHA" > "$RELEASE/VERSION"
ln -sfn "$RELEASE" "$APP_DIR/current.tmp"
mv -T "$APP_DIR/current.tmp" "$CURRENT"

# reload, not restart: pm2 brings the new process up before retiring the old
# one, so an in-flight 5MB CV upload is not killed mid-write.
log "reloading $PM2_APP"
pm2 reload "$PM2_APP" --update-env || fail "pm2 reload failed"

# --- Smoke test ------------------------------------------------------------

log "waiting for health"
HEALTHY=0
for _ in $(seq 1 20); do
  if curl -fsS "$HEALTH_URL" | grep -q '"status":"ok"'; then
    HEALTHY=1
    break
  fi
  sleep 1
done

if [ "$HEALTHY" -ne 1 ]; then
  log "health check failed — rolling back"
  if [ -n "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$APP_DIR/current.tmp"
    mv -T "$APP_DIR/current.tmp" "$CURRENT"
    pm2 reload "$PM2_APP" --update-env || true
    log "rolled back to $PREVIOUS"
  fi
  fail "deploy aborted"
fi

# The SPA must be reachable through nginx, not just the API through localhost.
curl -fsS -o /dev/null "http://127.0.0.1/" || log "WARNING: nginx did not serve / — check the site config"

log "keeping the five most recent releases"
( cd "$APP_DIR/releases" && ls -1t | tail -n +6 | xargs -r rm -rf )

log "deployed $SHA"
