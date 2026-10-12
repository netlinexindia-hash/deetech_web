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
# `next build` prerenders content by calling the API, so the build needs to
# reach a service that has no published port. Getting there takes two
# things, and neither is obvious:
#
#   1. A buildx builder attached to deetech_net. `build.network` in the
#      compose file does NOT work — that is a classic-builder feature and
#      buildkit rejects it outright. A builder created with
#      `--driver-opt network=deetech_net` runs its RUN steps in the builder
#      container's own network namespace, which is on the network.
#
#   2. The API's address in /etc/hosts, via build.extra_hosts. Being on the
#      network is not enough by itself: buildkit replaces resolv.conf inside
#      RUN sandboxes with public DNS, so Docker's embedded resolver at
#      127.0.0.11 never sees the query and `api` does not resolve.
#
# Steps 2 and 4 created the network and the API container, which is why this
# comes after them.
docker network inspect deetech_net >/dev/null 2>&1   || fail "the deetech_net network is missing; the API should have created it"

BUILDER=deetech-builder
BUILDER_CONTAINER="buildx_buildkit_${BUILDER}0"

builder_on_network() {
  docker inspect -f '{{range $net, $_ := .NetworkSettings.Networks}}{{$net}} {{end}}'     "$BUILDER_CONTAINER" 2>/dev/null | tr ' ' '
' | grep -qx deetech_net
}

if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  echo "    creating the $BUILDER buildx builder, attached to deetech_net"
  docker buildx create --name "$BUILDER" --driver docker-container     --driver-opt network=deetech_net --bootstrap >/dev/null     || fail "could not create the $BUILDER buildx builder"
elif ! builder_on_network; then
  # The network was recreated under a builder that still remembers the old
  # one. Reconnecting is enough, and it keeps the build cache.
  echo "    reattaching $BUILDER to deetech_net"
  docker start "$BUILDER_CONTAINER" >/dev/null 2>&1 || true
  docker network connect deetech_net "$BUILDER_CONTAINER" 2>/dev/null     || fail "could not attach $BUILDER to deetech_net"
fi

builder_on_network || fail "$BUILDER is not attached to deetech_net"

# Resolved now rather than hardcoded: the address changes whenever the
# container is recreated, which step 4 just did.
API_BUILD_IP="$(
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'     "$("${COMPOSE[@]}" ps -q api)" 2>/dev/null
)"
[ -n "${API_BUILD_IP:-}" ]   || fail "could not determine the API container's address for the build"
export API_BUILD_IP
export BUILDX_BUILDER="$BUILDER"
echo "    building against api at $API_BUILD_IP"

"${COMPOSE[@]}" build web   || fail "the web build failed; the previous version is still serving"

# A build that could not reach the API produces an EMPTY site and still
# exits 0, so the exit code above proves nothing on its own.
#
# What to check matters. Grepping the HTML for a service slug gives a false
# pass — the service URLs are in the hardcoded navigation, so they appear on
# every page whether or not any content loaded. Verified against a real
# build with an unreachable API: it exited 0 and the grep still matched.
#
# The honest signal is the prerendered DETAIL pages. Those come from
# generateStaticParams, which returns an empty list when the API cannot be
# reached, so without content they do not exist at all. An empty build has
# exactly 8 pages and no detail pages.
log "     verifying the build actually picked up content"
DETAIL_PAGES="$(
  "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh web -c \
    'find apps/web/.next/server/app -path "*/services/*.html" 2>/dev/null | wc -l' \
    | tr -cd '0-9'
)"

if [ "${DETAIL_PAGES:-0}" -lt 1 ]; then
  fail "the build produced no service detail pages, so it could not reach the API.
       That image would serve a site with no services, brands or articles.
       Nothing was swapped in; the previous version is still serving."
fi
echo "    $DETAIL_PAGES service detail pages prerendered"

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
