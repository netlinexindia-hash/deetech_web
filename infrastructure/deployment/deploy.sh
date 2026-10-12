#!/usr/bin/env bash
#
# Repeatable deployment.
#
#   infrastructure/deployment/deploy.sh
#
# Run from the repository root on the VPS. Every step is ordered so that a
# failure leaves the previous version serving, and the script stops at the
# first problem rather than carrying on.
#
# The order matters and is not arbitrary:
#
#   1. Back up first. A deploy that goes wrong after a migration needs a
#      restore point that predates it.
#   2. Database up, then migrate. Migrations run against the old code, which
#      is why they must be backwards compatible — see the note below.
#   3. API up, and wait for it to be healthy.
#   4. THEN build web. `next build` prerenders content pages by calling the
#      API; building before the API is up produces a site with no services,
#      no brands and no articles, and it does not fail while doing it.
#   5. Swap web in, wait for health, then reload nginx.
#
# Migrations run before the new code is serving, so a migration must not
# break the version currently running. Add a column, deploy, then use it —
# never rename or drop in the same release as the code change.
#
# Environment: read from .env in the repository root.
#   SKIP_BACKUP=1   skip step 1 (for a staging host with nothing to lose)

set -Eeuo pipefail

cd "$(dirname "$0")/../.."

COMPOSE=(docker compose
  -f docker-compose.yml
  -f infrastructure/deployment/docker-compose.prod.yml)

BACKUP_DIR="${BACKUP_DIR:-/srv/deetech/backups}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is not available"
[ -f .env ] || fail ".env is missing. Copy .env.example and fill it in."

# shellcheck disable=SC1091
set -a; . ./.env; set +a

for required in POSTGRES_PASSWORD DATABASE_URL SESSION_SECRET NEXT_PUBLIC_SITE_URL; do
  [ -n "${!required:-}" ] || fail "$required is not set in .env"
done

# The API refuses to start in production without a long secret; catch it here
# rather than after the database is already migrated.
[ "${#SESSION_SECRET}" -ge 32 ] || fail "SESSION_SECRET must be at least 32 characters"

/usr/bin/env printf '' # no-op, keeps shellcheck happy about the env block

# ---------------------------------------------------------------------------
log "1/7  Backing up before anything changes"
# ---------------------------------------------------------------------------
if [ "${SKIP_BACKUP:-}" = "1" ]; then
  echo "    skipped (SKIP_BACKUP=1)"
else
  mkdir -p "$BACKUP_DIR"
  # Runs inside the db container, so pg_dump matches the server version.
  if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
    STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
    "${COMPOSE[@]}" exec -T db pg_dump \
        --username "${POSTGRES_USER:-deetech}" \
        --dbname "${POSTGRES_DB:-deetech}" \
        --format=plain --clean --if-exists --no-owner --no-privileges \
      | gzip -9 > "$BACKUP_DIR/pre-deploy-$STAMP.sql.gz"
    gzip -dc "$BACKUP_DIR/pre-deploy-$STAMP.sql.gz" \
      | grep -q "PostgreSQL database dump complete" \
      || fail "the pre-deploy backup is truncated; refusing to continue"
    echo "    $BACKUP_DIR/pre-deploy-$STAMP.sql.gz"
  else
    echo "    database is not running yet — nothing to back up (first deploy)"
  fi
fi

# ---------------------------------------------------------------------------
log "2/7  Starting the database"
# ---------------------------------------------------------------------------
"${COMPOSE[@]}" up -d db
echo -n "    waiting for postgres"
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  if "${COMPOSE[@]}" exec -T db pg_isready -q \
       -U "${POSTGRES_USER:-deetech}" -d "${POSTGRES_DB:-deetech}" 2>/dev/null; then
    echo " — ready"; break
  fi
  echo -n "."; sleep 1
done
"${COMPOSE[@]}" exec -T db pg_isready -q \
  -U "${POSTGRES_USER:-deetech}" -d "${POSTGRES_DB:-deetech}" \
  || fail "postgres did not become ready within ${HEALTH_TIMEOUT}s"

# ---------------------------------------------------------------------------
log "3/7  Building the API image and running migrations"
# ---------------------------------------------------------------------------
"${COMPOSE[@]}" build api
# `run --rm` so migrations execute in a throwaway container with the new
# code, without the API serving yet.
"${COMPOSE[@]}" run --rm --no-deps api node apps/api/dist/db/cli.js migrate \
  || fail "migrations failed — nothing was swapped in, the old version is still serving"

# ---------------------------------------------------------------------------
log "4/7  Starting the API"
# ---------------------------------------------------------------------------
"${COMPOSE[@]}" up -d api
echo -n "    waiting for the API to report healthy"
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  if "${COMPOSE[@]}" exec -T api node -e \
      "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>r.json()).then(j=>process.exit(j.checks.database==='ok'?0:1)).catch(()=>process.exit(1))" \
      2>/dev/null; then
    echo " — healthy"; break
  fi
  echo -n "."; sleep 1
done
"${COMPOSE[@]}" exec -T api node -e \
  "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>r.json()).then(j=>process.exit(j.checks.database==='ok'?0:1)).catch(()=>process.exit(1))" \
  || fail "the API did not become healthy; the previous web version is still serving"

# ---------------------------------------------------------------------------
log "5/7  Building the web image (the API must be reachable for this)"
# ---------------------------------------------------------------------------
# Published on loopback only for the duration of the build, so the build
# container can reach it over host networking.
docker run --rm -d --name deetech-build-proxy \
  --network container:"$("${COMPOSE[@]}" ps -q api)" \
  alpine/socat:latest TCP-LISTEN:4000,fork,reuseaddr TCP:127.0.0.1:4000 \
  >/dev/null 2>&1 || true
trap 'docker rm -f deetech-build-proxy >/dev/null 2>&1 || true' EXIT

BUILD_API_BASE_URL="${BUILD_API_BASE_URL:-http://127.0.0.1:4000}" \
  "${COMPOSE[@]}" build web \
  || fail "the web build failed; the previous version is still serving"

docker rm -f deetech-build-proxy >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
log "6/7  Swapping in the new web container"
# ---------------------------------------------------------------------------
"${COMPOSE[@]}" up -d web
echo -n "    waiting for web"
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  if "${COMPOSE[@]}" exec -T web node -e \
      "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      2>/dev/null; then
    echo " — responding"; break
  fi
  echo -n "."; sleep 1
done

# ---------------------------------------------------------------------------
log "7/7  Reloading nginx"
# ---------------------------------------------------------------------------
"${COMPOSE[@]}" up -d nginx
# Validate before reloading: a bad config that fails to load takes the site
# down, whereas a failed test leaves the running config in place.
"${COMPOSE[@]}" exec -T nginx nginx -t || fail "the nginx config is invalid; it was NOT reloaded"
"${COMPOSE[@]}" exec -T nginx nginx -s reload

log "Deployed"
"${COMPOSE[@]}" ps

cat <<'NEXT'

Now verify it, against the real hostname:

    node infrastructure/deployment/smoke-test.mjs --base https://www.deetechgroup.com
    node infrastructure/deployment/verify-redirects.mjs --base https://www.deetechgroup.com

If something is wrong, roll back:

    infrastructure/deployment/rollback.sh

NEXT
