# syntax=docker/dockerfile:1
#
# Express API image. Build context is the repository root:
#   docker build -f infrastructure/docker/api.Dockerfile .

# Pinned to a digest-stable minor. Bump deliberately, never with `:latest`.
FROM node:24.13-alpine AS base
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

# --------------------------------------------------------------------------
# deps — install the full workspace so the shared package resolves
# --------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --include=dev

# --------------------------------------------------------------------------
# build — compile shared-types, then the API
# --------------------------------------------------------------------------
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN npm run build --workspace=@deetech/shared-types \
 && npm run build --workspace=@deetech/api

# --------------------------------------------------------------------------
# runtime — production dependencies and compiled output only
# --------------------------------------------------------------------------
FROM base AS runtime

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --omit=dev --workspace=@deetech/api --include-workspace-root \
 && npm cache clean --force

COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

# The migration runner and the seeder read these SQL files at runtime, not at
# build time, resolving them relative to the compiled output — so
# apps/api/dist/db/ looks up four levels to /app/database/. They are data
# rather than code, which is why they are copied instead of compiled.
#
# Without this the image builds and the API serves fine; only `cli.js
# migrate` fails, and only when run, with ENOENT on
# /app/database/migrations/. That is step 3 of deploy.sh.
COPY database ./database

# Run unprivileged. The `node` user ships with the base image as uid 1000.
USER node

EXPOSE 4000

# tini reaps zombies and forwards SIGTERM so the graceful shutdown in
# server.ts actually runs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/server.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
