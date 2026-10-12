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
# Works in two modes, chosen automatically:
#
#   container  Dumps by running pg_dump INSIDE the db container, and tars the
#              media Docker volume. This is the mode that applies on a
#              deployed host, and it is chosen whenever the db container is
#              running.
#
#   host       Dumps with the host's pg_dump over DATABASE_URL, and tars a
#              directory. For a development machine.
#
# Container mode exists because host mode cannot work on a deployed host, and
# would fail silently every night: DATABASE_URL names `db:5432`, which is
# Docker's internal DNS and does not resolve outside the network, and the
# database deliberately publishes no port in either topology. Media has the
# same problem — it lives in a Docker volume, not a directory on the host.
#
# Environment:
#   BACKUP_MODE      container | host  (default: auto-detect)
#   DATABASE_URL     required in host mode; unused in container mode
#   POSTGRES_USER    container mode, default deetech
#   POSTGRES_DB      container mode, default deetech
#   MEDIA_VOLUME     container mode, default deetech_media-data
#   MEDIA_DIR        host mode, default ./.devdata/media
#   BACKUP_KEEP      how many timestamped sets to keep (default 14)
#
# Exits non-zero on any failure, so cron mails you and a deploy gate fails.

set -Eeuo pipefail

DESTINATION="${1:-./backups}"
MEDIA_DIR="${MEDIA_DIR:-./.devdata/media}"
MEDIA_VOLUME="${MEDIA_VOLUME:-deetech_media-data}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# Found by compose label rather than container name, so it does not matter
# which overlay is in use or how compose numbered the container.
DB_CONTAINER=""
if command -v docker >/dev/null 2>&1; then
  DB_CONTAINER="$(docker ps -q \
    --filter label=com.docker.compose.project=deetech \
    --filter label=com.docker.compose.service=db 2>/dev/null | head -1)"
fi

if [ -n "${BACKUP_MODE:-}" ]; then
  :
elif [ -n "$DB_CONTAINER" ]; then
  BACKUP_MODE=container
else
  BACKUP_MODE=host
fi

case "$BACKUP_MODE" in
  container)
    [ -n "$DB_CONTAINER" ] || { echo "The db container is not running." >&2; exit 2; }
    for tool in docker gzip tar; do
      command -v "$tool" >/dev/null 2>&1 || { echo "$tool is not installed." >&2; exit 2; }
    done
    ;;
  host)
    if [ -z "${DATABASE_URL:-}" ]; then
      echo "DATABASE_URL is not set." >&2
      exit 2
    fi
    for tool in pg_dump gzip tar; do
      command -v "$tool" >/dev/null 2>&1 || { echo "$tool is not installed." >&2; exit 2; }
    done
    ;;
  *)
    echo "BACKUP_MODE must be container or host, not \"$BACKUP_MODE\"." >&2
    exit 2
    ;;
esac

mkdir -p "$DESTINATION"

DB_FILE="$DESTINATION/deetech-db-$STAMP.sql.gz"
MEDIA_FILE="$DESTINATION/deetech-media-$STAMP.tar.gz"

echo "Backing up the database (mode: $BACKUP_MODE)..."
# --clean --if-exists so the dump can be restored over an existing database.
# --no-owner --no-privileges so it restores as whatever role runs it, rather
# than requiring the production role to exist on the restore target.
if [ "$BACKUP_MODE" = "container" ]; then
  # pg_dump runs inside the container so its version always matches the
  # server's. A newer client against an older server is a standard way to
  # end up with a dump that will not restore.
  docker exec -i "$DB_CONTAINER" pg_dump \
      --username "${POSTGRES_USER:-deetech}" \
      --dbname "${POSTGRES_DB:-deetech}" \
      --format=plain \
      --clean --if-exists \
      --no-owner --no-privileges \
    | gzip -9 > "$DB_FILE"
else
  pg_dump "$DATABASE_URL" \
    --format=plain \
    --clean --if-exists \
    --no-owner --no-privileges \
    | gzip -9 > "$DB_FILE"
fi

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

echo "Backing up media..."
if [ "$BACKUP_MODE" = "container" ]; then
  if docker volume inspect "$MEDIA_VOLUME" >/dev/null 2>&1; then
    # A read-only mount in a throwaway container: a Docker volume is not
    # reachable from the host filesystem in any supported way.
    docker run --rm -v "$MEDIA_VOLUME":/media:ro alpine:3.20 \
      tar -czf - -C / media > "$MEDIA_FILE"
    tar -tzf "$MEDIA_FILE" >/dev/null \
      || { echo "Media archive is unreadable." >&2; rm -f "$MEDIA_FILE"; exit 1; }
  else
    echo "  (no $MEDIA_VOLUME volume - skipping)"
  fi
elif [ -d "$MEDIA_DIR" ]; then
  tar -czf "$MEDIA_FILE" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
  tar -tzf "$MEDIA_FILE" >/dev/null || { echo "Media archive is unreadable." >&2; exit 1; }
else
  echo "  (no media directory at $MEDIA_DIR - skipping)"
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
