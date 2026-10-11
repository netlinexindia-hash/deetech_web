# syntax=docker/dockerfile:1
#
# Next.js image, built in standalone output mode. Build context is the
# repository root:
#   docker build -f infrastructure/docker/web.Dockerfile .

FROM node:24.13-alpine AS base
RUN apk add --no-cache tini
WORKDIR /app

# --------------------------------------------------------------------------
# deps
# --------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --include=dev

# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they have to be present here and not only at run time. Never pass a secret
# through a NEXT_PUBLIC_ build arg.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID

RUN npm run build --workspace=@deetech/shared-types \
 && npm run build --workspace=@deetech/web

# --------------------------------------------------------------------------
# runtime — standalone server, no node_modules tree to copy
# --------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
