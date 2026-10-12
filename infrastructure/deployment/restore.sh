#!/usr/bin/env bash
#
# Restores a database dump, and optionally a media archive.
#
#   infrastructure/deployment/restore.sh <db-dump.sql.gz> [media.tar.gz]
#
# This is destructive: the dump is taken with --clean --if-exists, so it
# drops and recreates every object it contains. It therefore refuses to run
# against a URL that looks like production unless RESTORE_CONFIRM is set to
# the database name — a restore pointed at the wrong target is the failure
# mode that turns an incident into a catastrophe.
#
# Environment:
#   DATABASE_URL     required, the cluster to restore INTO
#   MEDIA_DIR        where to unpack media (default ./.devdata/media)
#   RESTORE_CONFIRM  must equal the target database name to proceed

set -Eeuo pipefail

DB_FILE="${1:-}"
MEDIA_FILE="${2:-}"
MEDIA_DIR="${MEDIA_DIR:-./.devdata/media}"

if [ -z "$DB_FILE" ]; then
  echo "Usage: restore.sh <db-dump.sql.gz> [media.tar.gz]" >&2
  exit 2
fi
if [ ! -f "$DB_FILE" ]; then
  echo "No such dump: $DB_FILE" >&2
  exit 2
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 2
fi

for tool in psql gzip; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool is not installed." >&2; exit 2; }
done

# Target database name, for the confirmation check and the log line.
TARGET_DB="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"

echo "About to restore into database '$TARGET_DB'."
echo "This DROPS and recreates every object in the dump."
echo ""

if [ "${RESTORE_CONFIRM:-}" != "$TARGET_DB" ]; then
  echo "Refusing to continue." >&2
  echo "Set RESTORE_CONFIRM to the target database name to proceed:" >&2
  echo "" >&2
  echo "    RESTORE_CONFIRM=$TARGET_DB $0 $*" >&2
  exit 3
fi

# Verify the archive before touching the database, so a corrupt backup is
# discovered while the current data is still intact.
echo "Verifying the dump…"
gzip -t "$DB_FILE" || { echo "Not a valid gzip archive." >&2; exit 1; }
gzip -dc "$DB_FILE" | grep -q "PostgreSQL database dump complete" \
  || { echo "The dump is truncated. Refusing to restore from it." >&2; exit 1; }

if [ -n "$MEDIA_FILE" ]; then
  [ -f "$MEDIA_FILE" ] || { echo "No such media archive: $MEDIA_FILE" >&2; exit 2; }
  tar -tzf "$MEDIA_FILE" >/dev/null || { echo "Media archive is unreadable." >&2; exit 1; }
fi

echo "Restoring the database…"
# ON_ERROR_STOP so a failed statement aborts rather than leaving a half
# restored schema that looks like it worked.
gzip -dc "$DB_FILE" | psql "$DATABASE_URL" \
  --quiet \
  --set ON_ERROR_STOP=1 \
  --output=/dev/null

if [ -n "$MEDIA_FILE" ]; then
  echo "Restoring media…"
  mkdir -p "$(dirname "$MEDIA_DIR")"
  tar -xzf "$MEDIA_FILE" -C "$(dirname "$MEDIA_DIR")"
fi

echo ""
echo "Restored. Verifying…"
psql "$DATABASE_URL" --quiet --tuples-only --command "
  SELECT '  services:  ' || count(*) FROM services
  UNION ALL SELECT '  brands:    ' || count(*) FROM brands
  UNION ALL SELECT '  products:  ' || count(*) FROM products
  UNION ALL SELECT '  pages:     ' || count(*) FROM pages
  UNION ALL SELECT '  articles:  ' || count(*) FROM blog_posts
  UNION ALL SELECT '  media:     ' || count(*) FROM media
  UNION ALL SELECT '  enquiries: ' || count(*) FROM contact_enquiries
  UNION ALL SELECT '  admins:    ' || count(*) FROM admin_users
"

echo ""
echo "Check those counts against what you expected before declaring success."
