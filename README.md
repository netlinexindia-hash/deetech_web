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
| 2 | Public pages | **Done** — see [`docs/week-2-report.md`](docs/week-2-report.md) |
| 3 | API and database | **Done** — see [`docs/week-3-report.md`](docs/week-3-report.md) |
| 4 | Admin CMS | **Done** — see [`docs/week-4-report.md`](docs/week-4-report.md) |
| 5 | Content migration and release candidate | **Done** — see [`docs/week-5-report.md`](docs/week-5-report.md) |
| 6 | Production launch | **Prepared, not deployed** — see [`docs/week-6-report.md`](docs/week-6-report.md) |

## Stack

| Layer | Technology |
|---|---|
| Public site + admin UI | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| API | Node.js 24, Express 5, TypeScript, Zod, Pino |
| Database | PostgreSQL 18 |
| Deployment | Docker Compose, nginx |
| Tests | Vitest + Supertest (API); Playwright *(Week 5)* |

Flask is out of scope for the MVP, per the plan.

## Layout

```
apps/
  web/                    Next.js public site and admin UI
    src/app/(site)/       Public pages, inside the marketing chrome
    src/app/admin/        The CMS, outside it
    src/lib/content/      Content layer — reads the API
  api/                    Express API
packages/
  shared-types/           API contract shared by web and api
database/
  migrations/             (Week 3)
  seeds/                  (Week 3)
assets/
  brand/                  Source logo artwork + the favicon generator
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

Start a real PostgreSQL 18 (no Docker needed), apply migrations and seeds:

```bash
npm run db:dev --workspace=@deetech/api
```

It prints the `DATABASE_URL` to put in `.env`. Then run the API on
<http://localhost:4000>:

```bash
npm run dev:api
```

Create the first administrator:

```bash
npm run admin:create --workspace=@deetech/api -- --email you@example.com --name "Your Name"
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
| `npm run db:dev --workspace=@deetech/api` | Real PostgreSQL 18 on :55432, migrated and seeded |
| `npm run db:migrate\|db:seed\|db:setup --workspace=@deetech/api` | Against whatever `DATABASE_URL` points at |
| `npm run admin:create --workspace=@deetech/api` | Creates an admin account |
| `node infrastructure/deployment/verify-redirects.mjs` | Checks every legacy URL has a rule and every destination resolves |
| `node infrastructure/deployment/smoke-test.mjs --base <url>` | 80+ acceptance checks against a deployed site |
| `npm run check` | Everything above, in the order CI runs it |

## Redirect map

Every legacy WordPress URL is listed in [`docs/redirects.csv`](docs/redirects.csv).
`npm run redirects:build` turns it into
`infrastructure/nginx/snippets/deetech-redirects.conf`, validating as it goes
that no rule points at itself, duplicates another, or forms a redirect chain.
Edit the CSV, never the generated file — CI fails if they are out of sync.

## Brand assets

Source artwork lives in [`assets/brand/`](assets/brand). The web logo and the
whole favicon set are generated from it:

```bash
python assets/brand/build-icons.py
```

That writes `apps/web/public/brand/deetech-mark.png` (trimmed mark),
`apps/web/src/app/icon.png` (512), `apps/web/src/app/apple-icon.png` (180,
flattened onto white because iOS ignores transparency) and
`apps/web/src/app/favicon.ico` (16/32/48). Re-run it whenever the source
artwork changes; do not hand-edit the generated files. Requires Pillow.

## The content layer

Every public page reads content through `apps/web/src/lib/content/`, never from
a fixture directly. Its functions already have the signatures the API will
have, so on Day 13 their bodies are swapped for `fetch` calls and no page
component changes.

Two rules hold in both implementations:

- Only `published` records are returned. Draft content must never reach a
  public route.
- Everything is async, even though today's fixtures are not.

As of Week 3 Day 13 these functions call the Express API and the fixtures are
gone. Content lives in PostgreSQL.

**The brands and products tables are empty**, and the About page's team, stats
and history sections still read from `src/lib/content/fixtures/about.ts` with
empty arrays — because the source material does not exist or contradicts
itself. Those sections render nothing rather than shipping invented content.
Each carries a comment explaining what is needed to turn it on.

A list request that cannot reach the API returns empty and a detail returns
null, rendering as an empty state or a 404. Letting the error propagate would
turn a brief API restart into a 500 on every page.

## The admin CMS

`/admin`, signed in with an account created by `admin:create`. It manages
pages, services, brands, products, blog posts, media and the enquiry inbox.

Two things worth knowing before changing it:

- **The API is the control, not the UI.** Every admin route is behind
  `requireAuth` in Express, and deletes additionally require the `admin`
  role. Hiding a button in React is not authorization.
- **Write schemas are shared and must stay idempotent.** Every save is
  validated twice — by the Next.js server action against the form, then by
  the API against what the action forwards. The second parse sees the first
  parse's output, so a schema that rejects its own output breaks every save
  with an empty optional field. There are round-trip tests for this.

Field layout for the CMS forms is described once in
`apps/web/src/lib/admin/resources.ts`; the list and edit pages render from
it. That registry is presentation only — validation lives in the shared Zod
schemas.

## Deploying

Follow **[`docs/06-deployment-runbook.md`](docs/06-deployment-runbook.md)**.
Once the server is set up, a deploy is:

```bash
infrastructure/deployment/deploy.sh
```

It backs up first, migrates in a throwaway container, waits for the API to
be healthy **before** building web (the build prerenders by calling the API,
and without it the build succeeds and ships empty content pages), validates
the nginx config before reloading, and leaves the previous version serving
if any step fails. `rollback.sh` reverses it, warning if migrations were
added in between.

**None of the deployment has been run.** Docker is not installed on the
development machine and there is no VPS access from it, so the compose
files, nginx config and scripts are written and syntax-checked but
unexecuted. Work through the runbook on a staging hostname first.

## Backup and restore

```bash
DATABASE_URL=... infrastructure/deployment/backup.sh /path/off/this/server
RESTORE_CONFIRM=<dbname> DATABASE_URL=... infrastructure/deployment/restore.sh dump.sql.gz media.tar.gz
```

A Docker volume is not a backup — write to somewhere off the VPS. The backup
verifies its own output and deletes a truncated dump rather than leaving one
that looks valid. The restore refuses to run unless `RESTORE_CONFIRM` matches
the target database name, and verifies the archive before touching anything.

**These scripts have not been executed yet** — they wrap `pg_dump` and
`psql`, which the embedded Postgres used for development does not ship. Run
them for real against staging before cutover. The round-trip guarantee they
exist to provide is covered by `apps/api/tests/backup-restore.test.ts`.

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
  Local development uses `embedded-postgres` instead, which runs a genuine
  PostgreSQL 18 binary — see [`database/README.md`](database/README.md). It is
  a devDependency, pinned exactly because it is published only as a
  prerelease, and pulls a ~107 MB platform binary on install.
- **The privacy policy and terms are drafts pending legal review.** They are
  seeded unpublished, and the footer links to a legal page only once it is
  published, so nothing links to a 404 in the meantime.
- **Enquiry notification email is not configured.** Submissions are saved to
  the database and appear in the admin inbox, but nobody is emailed until
  `SMTP_HOST` and credentials are set.
- **`next build` prerenders content pages by calling the API.** With the API
  down the build still succeeds — the content layer catches the failure and
  returns empty — but it produces a site with no services, brands or
  articles. Bring the database and API up before building the web image, or
  drop prerendering and let the revalidate window fill pages on first
  request. To be settled on Day 26.
- **The brand artwork is raster only.** `assets/brand/Deetech-logo.png` is a
  661x606 PNG. A vector (SVG/AI) source is still outstanding; until it arrives
  the mark cannot be recoloured or scaled cleanly beyond its source resolution.
- **The live WordPress site still shows the old blue-and-green wordmark.** The
  rebuild uses the current Penrose-triangle mark. Updating the live site is not
  in scope here, but it is worth doing before cutover so the two do not disagree
  in search results and link previews.

## Documentation

- [`docs/01-wordpress-audit.md`](docs/01-wordpress-audit.md) — content, URL, SEO and content-quality audit of the live WordPress site
- [`docs/02-sitemap-and-design-system.md`](docs/02-sitemap-and-design-system.md) — URL scheme, content model, design tokens, accessibility rules
- [`docs/week-1-report.md`](docs/week-1-report.md) — what Week 1 delivered, what was verified, and what is blocked
- [`docs/week-2-report.md`](docs/week-2-report.md) — the public pages, the content layer, and what is still blocked
- [`docs/week-3-report.md`](docs/week-3-report.md) — schema, migrations, public endpoints, enquiries, admin auth
- [`docs/week-4-report.md`](docs/week-4-report.md) — the admin CMS, media uploads, and the build-time API constraint
- [`docs/week-5-report.md`](docs/week-5-report.md) — legal pages, redirect verification, permission and email tests, backup/restore
- [`docs/week-6-report.md`](docs/week-6-report.md) — what is ready to deploy and what has not been run
- **[`docs/06-deployment-runbook.md`](docs/06-deployment-runbook.md) — how to put this on the VPS and cut over from WordPress**
- [`database/README.md`](database/README.md) — how to run migrations and seeds, and why the schema is shaped the way it is
- [`docs/redirects.csv`](docs/redirects.csv) — legacy URL map
- [`docs/audit/legacy-copy/`](docs/audit/legacy-copy) — plain-text extract of every live page, for the Day 21 content migration
