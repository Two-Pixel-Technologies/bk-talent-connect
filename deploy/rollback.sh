#!/usr/bin/env bash
#
# Roll back to the previous release.
#
# Flipping the symlink back is the whole mechanism, which is why releases are
# kept rather than overwritten. It takes about two seconds and needs no build,
# no network and no npm.
#
# WHAT IT DOES NOT DO: undo a migration. That is deliberate — automatically
# reversing a schema change is how data gets destroyed during an incident. The
# rule that makes this safe is in the runbook and has to be followed at write
# time, not here: every migration must be backwards-compatible with the release
# before it. Add columns nullable; never rename or drop in the same deploy as
# the code that stops using them. Expand and contract across two deploys.
#
# Usage:
#   deploy/rollback.sh            # to the release before current
#   deploy/rollback.sh <sha>      # to a specific one
#
# Plan reference: BLOCKER-6.

set -euo pipefail

APP_DIR="${BKTC_APP_DIR:-/var/www/bktc}"
PM2_APP="${BKTC_PM2_APP:-bktc-api}"
HEALTH_URL="${BKTC_HEALTH_URL:-http://127.0.0.1:4000/api/health}"

CURRENT="$APP_DIR/current"
TARGET_SHA="${1:-}"

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }

[ -L "$CURRENT" ] || fail "no current symlink at $CURRENT"
CURRENT_PATH="$(readlink -f "$CURRENT")"
CURRENT_SHA="$(basename "$CURRENT_PATH")"

if [ -z "$TARGET_SHA" ]; then
  # Most recently modified release that is not the current one.
  TARGET_SHA="$(cd "$APP_DIR/releases" && ls -1t | grep -v "^$CURRENT_SHA\$" | head -n 1)"
  [ -n "$TARGET_SHA" ] || fail "no previous release to roll back to"
fi

TARGET="$APP_DIR/releases/$TARGET_SHA"
[ -d "$TARGET" ] || fail "no release at $TARGET"

log "rolling back $CURRENT_SHA -> $TARGET_SHA"
ln -sfn "$TARGET" "$APP_DIR/current.tmp"
mv -T "$APP_DIR/current.tmp" "$CURRENT"

pm2 reload "$PM2_APP" --update-env || fail "pm2 reload failed"

for _ in $(seq 1 20); do
  if curl -fsS "$HEALTH_URL" | grep -q '"status":"ok"'; then
    log "rolled back to $TARGET_SHA and healthy"
    exit 0
  fi
  sleep 1
done

fail "rolled back to $TARGET_SHA but it is not reporting healthy — investigate before deploying again"
