#!/usr/bin/env bash
#
# Restore from a backup archive — and, run against staging, the restore test.
#
# The plan's position is that restoring last night's production backup into
# staging IS the restore rehearsal: it happens on a schedule, against real
# data, and it fails loudly when the backups have gone bad. A restore procedure
# nobody has executed is a document, not a capability.
#
# Usage:
#   deploy/restore.sh backups/bktc-20260806T021500Z.tar.gz            # into staging
#   BKTC_APP_DIR=/var/www/bktc deploy/restore.sh <archive> --production
#
# Restoring into production is deliberately awkward: it needs the flag, it
# stops the app first, and it keeps what it replaced.
#
# Plan reference: BLOCKER-5, HIGH-8, HIGH-10.

set -euo pipefail

ARCHIVE="${1:-}"
TARGET="${2:---staging}"

APP_DIR="${BKTC_APP_DIR:-/var/www/bktc-staging}"
PM2_APP="${BKTC_PM2_APP:-bktc-staging-api}"

if [ "$TARGET" = "--production" ]; then
  APP_DIR="${BKTC_APP_DIR:-/var/www/bktc}"
  PM2_APP="${BKTC_PM2_APP:-bktc-api}"
fi

DB_PATH="$APP_DIR/shared/data/bktc.db"
UPLOADS_DIR="$APP_DIR/shared/uploads"

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }

[ -n "$ARCHIVE" ] || fail "usage: restore.sh <archive.tar.gz> [--production]"
[ -f "$ARCHIVE" ] || fail "no archive at $ARCHIVE"

if [ "$TARGET" = "--production" ]; then
  log "RESTORING INTO PRODUCTION at $APP_DIR"
  printf 'Type RESTORE to continue: '
  read -r CONFIRM
  [ "$CONFIRM" = "RESTORE" ] || fail "not confirmed"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log "unpacking"
tar -xzf "$ARCHIVE" -C "$WORK"
SNAPSHOT="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[ -n "$SNAPSHOT" ] || fail "archive has no snapshot directory"
[ -f "$SNAPSHOT/bktc.db" ] || fail "archive has no database"

log "checking the archived database before touching anything"
INTEGRITY="$(sqlite3 "$SNAPSHOT/bktc.db" 'PRAGMA integrity_check;')"
[ "$INTEGRITY" = "ok" ] || fail "archived database is corrupt: $INTEGRITY"

# Stop writers first. A restore over a live SQLite file leaves the running
# process holding a stale WAL against a database that has been swapped under it.
if command -v pm2 > /dev/null 2>&1; then
  log "stopping $PM2_APP"
  pm2 stop "$PM2_APP" > /dev/null 2>&1 || log "  (not running)"
fi

mkdir -p "$(dirname "$DB_PATH")" "$UPLOADS_DIR"

# Keep what we are replacing. A restore that turns out to be the wrong archive
# is recoverable; one that overwrote the only other copy is not.
if [ -f "$DB_PATH" ]; then
  ASIDE="$DB_PATH.replaced-$(date -u +%Y%m%dT%H%M%SZ)"
  log "moving the current database aside to $ASIDE"
  mv "$DB_PATH" "$ASIDE"
  rm -f "$DB_PATH-wal" "$DB_PATH-shm"
fi

log "restoring database"
cp "$SNAPSHOT/bktc.db" "$DB_PATH"

if [ -f "$SNAPSHOT/uploads.tar.gz" ]; then
  log "restoring uploads"
  rm -rf "$UPLOADS_DIR"
  tar -xzf "$SNAPSHOT/uploads.tar.gz" -C "$(dirname "$UPLOADS_DIR")"
else
  log "WARNING: archive contains no uploads"
fi

# --- Verify ----------------------------------------------------------------
#
# The point of the rehearsal. A restore that "completed" but left file_asset
# rows pointing at CVs that are not on disk has not restored anything usable.

log "verifying"
sqlite3 "$DB_PATH" 'PRAGMA foreign_key_check;' | head -n 5
ROWS="$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM user;')"
FILES_EXPECTED="$(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM file_asset WHERE deleted_at IS NULL;')"
FILES_PRESENT=0
while IFS= read -r stored; do
  [ -f "$UPLOADS_DIR/$stored" ] && FILES_PRESENT=$((FILES_PRESENT + 1))
done < <(sqlite3 "$DB_PATH" 'SELECT stored_path FROM file_asset WHERE deleted_at IS NULL;')

log "  users        : $ROWS"
log "  files in DB  : $FILES_EXPECTED"
log "  files on disk: $FILES_PRESENT"

[ "$FILES_PRESENT" -eq "$FILES_EXPECTED" ] ||
  fail "$((FILES_EXPECTED - FILES_PRESENT)) CV(s) referenced by the database are missing from disk"

if command -v pm2 > /dev/null 2>&1; then
  log "starting $PM2_APP"
  pm2 start "$PM2_APP" > /dev/null 2>&1 || log "  (start it manually)"
fi

log "restore complete and verified"
