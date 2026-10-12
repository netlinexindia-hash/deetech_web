#!/usr/bin/env bash
#
# Backs up the database and uploaded media.
#
#   infrastructure/deployment/backup.sh [destination-dir]
#
# A Docker volume is not a backup. This writes a compressed dump and a media
# archive to a destination that should be OFF the VPS — section 8 of the plan
# requires a separate location, because a backup on the same disk does not
# survive the failure it exists for.
#
# Environment:
#   DATABASE_URL     required, the cluster to dump
#   MEDIA_DIR        media directory (default ./.devdata/media)
#   BACKUP_KEEP      how many timestamped sets to keep (default 14)
#
# Exits non-zero on any failure, so cron mails you and a deploy gate fails.

set -Eeuo pipefail

DESTINATION="${1:-./backups}"
MEDIA_DIR="${MEDIA_DIR:-./.devdata/media}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 2
fi

for tool in pg_dump gzip tar; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool is not installed." >&2; exit 2; }
done

mkdir -p "$DESTINATION"

DB_FILE="$DESTINATION/deetech-db-$STAMP.sql.gz"
MEDIA_FILE="$DESTINATION/deetech-media-$STAMP.tar.gz"

echo "Backing up the database…"
# --clean --if-exists so the dump can be restored over an existing database.
# --no-owner --no-privileges so it restores as whatever role runs it, rather
# than requiring the production role to exist on the restore target.
pg_dump "$DATABASE_URL" \
  --format=plain \
  --clean --if-exists \
  --no-owner --no-privileges \
  | gzip -9 > "$DB_FILE"

# A dump that is empty or truncated is worse than no dump, because it looks
# like one. Check it decompresses and contains the expected marker.
if ! gzip -t "$DB_FILE" 2>/dev/null; then
  echo "The database dump is not a valid gzip archive. Removing it." >&2
  rm -f "$DB_FILE"
  exit 1
fi
if ! gzip -dc "$DB_FILE" | grep -q "PostgreSQL database dump complete"; then
  echo "The database dump is truncated — pg_dump did not finish. Removing it." >&2
  rm -f "$DB_FILE"
  exit 1
fi

echo "Backing up media…"
if [ -d "$MEDIA_DIR" ]; then
  tar -czf "$MEDIA_FILE" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
  tar -tzf "$MEDIA_FILE" >/dev/null || { echo "Media archive is unreadable." >&2; exit 1; }
else
  echo "  (no media directory at $MEDIA_DIR — skipping)"
fi

# --- retention --------------------------------------------------------------
# Keeps the most recent N of each kind. Deliberately counts files rather than
# using mtime, so a clock change cannot delete everything.
prune() {
  local pattern="$1"
  local keep="$2"
  # shellcheck disable=SC2012
  ls -1t "$DESTINATION"/$pattern 2>/dev/null | tail -n "+$((keep + 1))" | while read -r old; do
    echo "  pruning $(basename "$old")"
    rm -f "$old"
  done
}
prune "deetech-db-*.sql.gz" "$BACKUP_KEEP"
prune "deetech-media-*.tar.gz" "$BACKUP_KEEP"

echo ""
echo "Done."
echo "  database: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
[ -f "$MEDIA_FILE" ] && echo "  media:    $MEDIA_FILE ($(du -h "$MEDIA_FILE" | cut -f1))"
echo ""
echo "A backup you have not restored is a guess. Run restore.sh against a"
echo "scratch database periodically to prove this one works."
