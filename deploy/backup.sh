#!/usr/bin/env bash
#
# Nightly backup: the database AND the uploads.
#
# The uploads are the part that gets forgotten. An earlier version of this plan
# backed up bktc.db only, which means losing the droplet loses every CV while
# file_asset rows carry on pointing at files that no longer exist — a database
# that restores cleanly into a broken application.
#
# Two rules this script exists to enforce:
#
#   1. NEVER `cp` a live SQLite file. Under WAL, uncheckpointed pages live in
#      the -wal file, so a copy taken mid-write is silently short of data and
#      can be torn outright. `.backup` takes a consistent snapshot of a live
#      database; that is what it is for.
#
#   2. VERIFY BEFORE UPLOADING. An integrity_check on the backup, not the
#      original. A backup cron that has been quietly producing corrupt files
#      for three months is the classic version of this incident, and it is only
#      ever discovered on the day it is needed.
#
# Usage (root crontab, 02:30 IST nightly):
#   30 2 * * * /var/www/bktc/current/deploy/backup.sh >> /var/log/bktc-backup.log 2>&1
#
# Plan reference: BLOCKER-5, HIGH-10.

set -euo pipefail

APP_DIR="${BKTC_APP_DIR:-/var/www/bktc}"
DB_PATH="${BKTC_DB_PATH:-$APP_DIR/shared/data/bktc.db}"
UPLOADS_DIR="${BKTC_UPLOADS_DIR:-$APP_DIR/shared/uploads}"
BACKUP_DIR="${BKTC_BACKUP_DIR:-$APP_DIR/backups}"
RETAIN_DAYS="${BKTC_BACKUP_RETAIN_DAYS:-14}"

# Off-droplet destination. Unset means local-only, which is a warning, not a
# silent success: a backup on the same disk as the thing it backs up does not
# survive the failure it exists for.
REMOTE="${BKTC_BACKUP_REMOTE:-}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$BACKUP_DIR/$STAMP"

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }

[ -f "$DB_PATH" ] || fail "no database at $DB_PATH"
mkdir -p "$WORK"

# --- Database --------------------------------------------------------------

DB_OUT="$WORK/bktc.db"
log "backing up database"
sqlite3 "$DB_PATH" ".backup '$DB_OUT'" || fail "sqlite .backup failed"

log "verifying the backup"
INTEGRITY="$(sqlite3 "$DB_OUT" 'PRAGMA integrity_check;')"
[ "$INTEGRITY" = "ok" ] || fail "integrity_check on the backup returned: $INTEGRITY"

# A schema that restores but has no tables is a backup of an empty file.
TABLES="$(sqlite3 "$DB_OUT" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")"
[ "$TABLES" -gt 10 ] || fail "backup has only $TABLES tables — that is not a real database"

# --- Uploads ---------------------------------------------------------------

if [ -d "$UPLOADS_DIR" ]; then
  log "archiving uploads"
  tar -czf "$WORK/uploads.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  # Prove the archive opens. tar exits 0 on some partial writes.
  tar -tzf "$WORK/uploads.tar.gz" > /dev/null || fail "uploads archive is unreadable"
else
  log "WARNING: no uploads directory at $UPLOADS_DIR"
fi

# A manifest, so a restore can be checked rather than hoped about.
{
  echo "taken_at=$STAMP"
  echo "db_tables=$TABLES"
  echo "db_bytes=$(wc -c < "$DB_OUT" | tr -d ' ')"
  echo "upload_files=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "app_version=$(cat "$APP_DIR/current/VERSION" 2>/dev/null || echo unknown)"
} > "$WORK/manifest.txt"

ARCHIVE="$BACKUP_DIR/bktc-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$STAMP"
rm -rf "$WORK"
log "wrote $ARCHIVE ($(wc -c < "$ARCHIVE" | tr -d ' ') bytes)"

# --- Off the droplet -------------------------------------------------------

if [ -n "$REMOTE" ]; then
  log "uploading to $REMOTE"
  # s3cmd for DO Spaces; swap for rclone/scp without changing anything else.
  s3cmd put "$ARCHIVE" "$REMOTE/" || fail "upload to $REMOTE failed"
  log "uploaded"
else
  log "WARNING: BKTC_BACKUP_REMOTE is unset — this backup is on the same disk as the database"
fi

# --- Retention -------------------------------------------------------------

find "$BACKUP_DIR" -maxdepth 1 -name 'bktc-*.tar.gz' -mtime "+$RETAIN_DAYS" -delete
log "done"
