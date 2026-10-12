#!/usr/bin/env bash
#
# Rolls back to the previous release.
#
#   infrastructure/deployment/rollback.sh [git-ref]
#
# With no argument it goes back one commit on the current branch. With a ref
# it goes to that ref — use the commit you know was good, not a guess.
#
# What this does NOT do: undo a migration. Migrations are forward-only by
# design (see database/README.md). If the bad release included a destructive
# migration, rolling back the code is not enough and you need restore.sh
# with the pre-deploy backup deploy.sh took. The script says so and stops.

set -Eeuo pipefail

cd "$(dirname "$0")/../.."

TARGET="${1:-HEAD~1}"
BACKUP_DIR="${BACKUP_DIR:-/srv/deetech/backups}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "git is not installed"
git rev-parse --verify "$TARGET" >/dev/null 2>&1 || fail "unknown ref: $TARGET"

CURRENT="$(git rev-parse --short HEAD)"
GOING_TO="$(git rev-parse --short "$TARGET")"

log "Rolling back from $CURRENT to $GOING_TO"
git --no-pager log --oneline "$GOING_TO..$CURRENT" || true

# --- did anything between here and there touch the schema? ------------------
CHANGED_MIGRATIONS="$(git diff --name-only "$GOING_TO" HEAD -- database/migrations/ || true)"

if [ -n "$CHANGED_MIGRATIONS" ]; then
  cat >&2 <<WARNING

  ⚠ Migrations were added between $GOING_TO and $CURRENT:

$(printf '      %s\n' $CHANGED_MIGRATIONS)

  Migrations are forward-only. Reverting the code does NOT revert the schema.

  If those migrations only ADDED things — a column, a table, an index — the
  older code ignores them and this rollback is safe. Press on.

  If any of them DROPPED or RENAMED something the older code needs, the
  rollback will not work and you need a restore instead:

      RESTORE_CONFIRM=<dbname> DATABASE_URL=... \\
        infrastructure/deployment/restore.sh $BACKUP_DIR/pre-deploy-<stamp>.sql.gz

  Read the migrations before continuing.

WARNING
  printf '  Continue with the code rollback anyway? [y/N] '
  read -r answer
  case "$answer" in
    [yY]) ;;
    *) echo "  Stopped."; exit 1 ;;
  esac
fi

log "Checking out $GOING_TO"
git checkout --quiet "$TARGET"

log "Redeploying"
# deploy.sh takes its own backup first, so a rollback is itself recoverable.
exec infrastructure/deployment/deploy.sh
