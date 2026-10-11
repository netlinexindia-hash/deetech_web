# DeeTech Group — website

Rebuild of [www.deetechgroup.com](https://www.deetechgroup.com/) from WordPress
to a Next.js public site and admin CMS, an Express API and PostgreSQL, deployed
with Docker Compose behind nginx.

The full specification and the 30-day backlog are in
`DeeTech_Group_Website_Development_Plan_for_Claude.docx`.

## Status

| Week | Focus | State |
|---|---|---|
| 1 | Audit, design system, repo, shared layout, homepage | **Done** — see [`docs/week-1-report.md`](docs/week-1-report.md) |
| 2 | Public pages | Not started |
| 3 | API and database | Not started |
| 4 | Admin CMS | Not started |
| 5 | Content migration and release candidate | Not started |
| 6 | Production launch | Not started |

## Stack

| Layer | Technology |
|---|---|
| Public site + admin UI | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| API | Node.js 24, Express 5, TypeScript, Zod, Pino |
| Database | PostgreSQL 17 *(Week 3)* |
| Deployment | Docker Compose, nginx |
| Tests | Vitest + Supertest (API); Playwright *(Week 5)* |

Flask is out of scope for the MVP, per the plan.

## Layout

```
apps/
  web/                    Next.js public site and admin UI
  api/                    Express API
packages/
  shared-types/           API contract shared by web and api
database/
  migrations/             (Week 3)
  seeds/                  (Week 3)
infrastructure/
  docker/                 Dockerfiles for web and api
  nginx/                  Reverse proxy config + generated redirect snippet
  deployment/             Deploy and maintenance scripts
docs/                     Audit, design system, week reports, redirect map
tests/                    Cross-service integration and end-to-end suites
```

## Getting started

Requires Node 24 (`.nvmrc`). Docker is only needed to run the full stack.

```bash
npm install
cp .env.example .env     # then edit; POSTGRES_PASSWORD has no default
npm run build --workspace=@deetech/shared-types
```

Run the public site on <http://localhost:3000>:

```bash
npm run dev
```

Run the API on <http://localhost:4000>:

```bash
npm run dev:api
```

Check it is alive:

```bash
curl http://localhost:4000/api/v1/health
```

### Full stack in Docker

```bash
docker compose up --build
```

The web app is published on `127.0.0.1:3000` and the API on `127.0.0.1:4000`.
PostgreSQL is **not** published — it is reachable only on the private `deetech`
Docker network.

## Scripts

Run from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run dev:api` | Express dev server with reload |
| `npm run build` | Builds shared-types, then api, then web |
| `npm run lint` | ESLint across every workspace |
| `npm run typecheck` | `tsc --noEmit` across every workspace |
| `npm test` | Vitest suites |
| `npm run format` / `format:check` | Prettier |
| `npm run redirects:build` | Regenerates the nginx redirect snippet from `docs/redirects.csv` |
| `npm run check` | Everything above, in the order CI runs it |

## Redirect map

Every legacy WordPress URL is listed in [`docs/redirects.csv`](docs/redirects.csv).
`npm run redirects:build` turns it into
`infrastructure/nginx/snippets/deetech-redirects.conf`, validating as it goes
that no rule points at itself, duplicates another, or forms a redirect chain.
Edit the CSV, never the generated file — CI fails if they are out of sync.

## Conventions

- **Server-side validation.** Every request body is parsed with a Zod schema.
  Client-side validation is a convenience, never a control.
- **Server-side authorization.** Hiding a control in React is not authorization;
  admin write routes are protected in the API.
- **Published content only.** Public endpoints never return `draft` rows.
- **No secrets in Git or in the browser bundle.** `.env.example` lists names and
  placeholders only. `NEXT_PUBLIC_*` values are inlined into client JavaScript —
  nothing sensitive goes behind that prefix.
- **Design tokens.** Colour, type and spacing live in
  `apps/web/src/app/globals.css`. Components do not hardcode hex values.
- **Tests are run, not claimed.** No statement that a suite passes without the
  output to show for it.

## Known issues

- **`npm audit` reports 5 high-severity findings** in `braces` / `micromatch` /
  `fast-glob`, reached only through `eslint-config-next`. The advisory covers
  *all* published versions of `braces`, so there is no version to upgrade to;
  npm's suggested "fix" is a downgrade to `eslint-config-next@14`, which is a
  regression, not a fix. These packages are dev-only lint tooling and are not
  shipped. CI therefore gates on `npm audit --omit=dev --audit-level=high`,
  which is clean. Re-check when the advisory is resolved upstream.
- **Docker is not installed on the current development machine**, so
  `docker-compose.yml` and both Dockerfiles have been written but **not yet
  executed**. They must be built and run before the Week 6 deployment work.
- `apps/web/public/brand/deetech-logo.png` is a 243x79 raster copy taken from
  the live site. Replace it with the vector source when it is supplied.

## Documentation

- [`docs/01-wordpress-audit.md`](docs/01-wordpress-audit.md) — content, URL, SEO and content-quality audit of the live WordPress site
- [`docs/02-sitemap-and-design-system.md`](docs/02-sitemap-and-design-system.md) — URL scheme, content model, design tokens, accessibility rules
- [`docs/week-1-report.md`](docs/week-1-report.md) — what Week 1 delivered, what was verified, and what is blocked
- [`docs/redirects.csv`](docs/redirects.csv) — legacy URL map
- [`docs/audit/legacy-copy/`](docs/audit/legacy-copy) — plain-text extract of every live page, for the Day 21 content migration
