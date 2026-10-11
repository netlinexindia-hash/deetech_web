# Week 3 Report — API and database

Days 11–15 of the 30-working-day plan. Completed 2026-10-11.

---

## The blocker, and how it was solved

The plan runs PostgreSQL in Docker. **Docker is not installed on this machine**
(flagged in the Week 1 report), and there is no native Postgres either. Writing
migrations I could not run would have meant handing over a schema that had
never touched a database, and claiming tests pass without a database to test
against.

Instead: `embedded-postgres` as a **devDependency**, which downloads and runs a
genuine **PostgreSQL 18.4** binary.

```bash
npm run db:dev --workspace=@deetech/api
```

Starts real Postgres on `127.0.0.1:55432`, applies the migrations, applies the
seeds, prints the `DATABASE_URL`. Data lives in git-ignored `.devdata/`.

This is deliberately a real engine rather than an in-memory emulation like
`pg-mem`. The whole point of this week's tests is to prove the CHECK
constraints, partial indexes, triggers and published-only filtering actually
behave — an emulator would let a divergence pass as a green test. Production
is unchanged: the `db` service in `docker-compose.yml`.

## Day 11 — Schema, migrations, seeds

**`database/migrations/0001_initial_schema.sql`** — 11 tables: `admin_users`,
`pages`, `services`, `brands`, `products`, `blog_posts`, `media`,
`contact_enquiries`, `admin_sessions`, `login_attempts`, plus
`schema_migrations`. 33 indexes.

Four constraints exist specifically to stop Day 1 audit defects recurring:

| Constraint | Stops |
|---|---|
| `services_summary_key` — unique summary | CQ-3: one identical sentence on all six legacy service cards |
| `media.alt_text` NOT NULL and non-blank | SEO-4: all 53 legacy media items have empty alt text |
| `brands.relationship_type` CHECK over five values | A guessed "subsidiary" claim about company structure |
| `*_published_has_date` CHECK | A published row with no publication date |

**The migration runner** (`apps/api/src/db/migrate.ts`) is written in-house
rather than pulled in, because it is the thing that changes production schema
and should be readable by whoever is on call. It gives three guarantees a
"run every .sql file" loop does not:

1. Each migration runs in its own transaction — no partial schema on failure.
2. A session advisory lock is held for the whole run — two containers starting
   at once cannot double-apply.
3. Checksums are recorded — editing an applied migration is a hard error, not
   a silent divergence. Line endings are normalised first, so a Windows
   checkout and the Linux VPS agree.

**Seeds** are the opposite: idempotent and re-runnable, every statement using
`ON CONFLICT ... DO UPDATE`. Generated from the reviewed Week 2 copy.

## Day 12 — API foundation

Extended the Week 1 foundation with the database layer:

- **`db/pool.ts`** — pool sized for one small VPS container, with
  `statement_timeout`, an `error` listener on idle clients (without it, a
  database restart crashes the process), and an `int8` type parser set in one
  place so ids arrive as numbers rather than strings.
- **`makeDatabaseCheck`** — `/health` now reports `database: "ok"` only after
  actually running `SELECT 1`. It still reports `not_configured` with no
  `DATABASE_URL`, and `degraded` when the check fails.
- **Config** gained `SESSION_SECRET`, SMTP settings and enquiry-throttle
  settings, plus a **production guard**: `NODE_ENV=production` without
  `DATABASE_URL` or a 32-character `SESSION_SECRET` refuses to start.
- **Graceful degradation**: with no `DATABASE_URL` only `/health` is mounted
  and the process logs why, rather than crash-looping.
- Env files load through Node's `--env-file-if-exists`, so there is no `dotenv`
  dependency.

## Day 13 — Public content endpoints

| Method | Endpoint |
|---|---|
| GET | `/api/v1/services`, `/api/v1/services/:slug` |
| GET | `/api/v1/brands`, `/api/v1/brands/:slug` |
| GET | `/api/v1/products` (`?brandId=`), `/api/v1/products/:slug` |
| GET | `/api/v1/blog` (`?page=&perPage=`), `/api/v1/blog/all`, `/api/v1/blog/:slug` |
| GET | `/api/v1/pages/:slug` |

Every query in `ContentRepository` filters `status = 'published'`. That is
deliberately not a caller's responsibility — a route that forgot it would leak
drafts, so the filter lives in the only code that talks to the database.
Pagination uses `count(*) OVER ()` so the total cannot disagree with the rows.

**The web app now reads the API.** `apps/web/src/lib/content/index.ts` had its
function bodies swapped for `fetch` calls and the fixtures were deleted. **No
page component changed** — which was the entire point of introducing that seam
in Week 2.

Its failure policy is explicit: a list that cannot reach the API returns empty
and a detail returns null, which pages render as an empty state or a 404.
Letting the error propagate would turn a brief API restart into a 500 on every
page. Every failure is logged server-side.

## Day 14 — Enquiries

`POST /api/v1/enquiries`, in this order:

1. Validate against the schema shared with the web app.
2. **Honeypot** — store as `spam`, respond **exactly** as for a real
   submission, send no email. A bot learns nothing.
3. **Per-source throttle** — N per window, counted from the hashed IP.
4. Persist.
5. Notify by email — **best effort**.

Step 5 matters: a failed notification does **not** fail the request. The
enquiry is already saved and visible in the admin list; telling the visitor
"that didn't work" would make them submit again. With no `SMTP_HOST` the
mailer is a no-op that logs a warning.

Mail headers are sanitised (`headerSafe` strips CR/LF and bounds length), so a
newline in the subject cannot append a `Bcc:`. `replyTo` is the submitter so a
reply reaches them, while `from` stays a domain we are allowed to send as.

## Day 15 — Admin authentication

`POST /api/v1/admin/login`, `POST /api/v1/admin/logout`, `GET /api/v1/admin/me`.

- **Argon2id** password hashing (OWASP first choice; memory-hard), with
  parameters written out explicitly rather than inherited silently.
- **Session cookie**: `HttpOnly`, `SameSite=Strict`, `Secure` in production,
  with an expiry. `SameSite=Strict` is the CSRF defence for the admin writes
  coming in Week 4 — no admin flow starts from an external link.
- **The cookie value is never stored.** `admin_sessions.id` holds an HMAC of
  it, so reading the database does not yield a working cookie. There is a test
  asserting that presenting the stored id is rejected.
- **No account enumeration.** An unknown address and a wrong password return
  an identical status and message, and an unknown address is still verified
  against a dummy hash so it costs the same time.
- **Throttling** on failed attempts, counted by **email or IP** — by email
  alone, an attacker spraying one password across many accounts is never
  throttled.
- **Deactivation and expiry are enforced in SQL**, in the session lookup, so a
  disabled account cannot keep using a live session.
- `requireAuth` + `requireRole` are server-side middleware. Hiding a control in
  React is not authorization.
- Expired sessions are swept hourly.
- **`admin:create`** reads the password from `ADMIN_PASSWORD` or generates and
  prints it once — never from argv, which is readable by other processes and
  lands in shell history.

---

## Verification — what was actually executed

### Tests

**106 passed, 7 files** (was 24). 60 of them are new integration tests running
against a real PostgreSQL 18, each suite on its own throwaway cluster.

| Suite | Tests | Covers |
|---|---|---|
| `schema.test.ts` | 29 | Slug domain, publication CHECKs, unique summary, relationship enum, alt-text requirement, FK behaviour (RESTRICT / SET NULL / CASCADE), case-insensitive email, `updated_at` trigger, JSONB guard, migration checksums, seed idempotency |
| `content-api.test.ts` | 21 | All public endpoints, snake_case → camelCase mapping, cache headers, draft exclusion, pagination with no duplicates across pages, malformed slug → 400, SQL-injection attempt through the slug |
| `auth-api.test.ts` | 20 | Login, cookie flags, hash-not-token storage, wrong password, unknown address parity, deactivated account, throttling, expiry, logout, session sweeping |
| `enquiries-api.test.ts` | 13 | Storage, IP hashing, validation detail, notification failure tolerance, honeypot indistinguishability, per-source throttling, header injection |
| `health`, `config`, `enquiry-schema` | 23 | Carried over from Weeks 1–2 |

### Live stack, driven by hand

| Check | Result |
|---|---|
| `db:dev` | PostgreSQL 18.4 started; `0001_initial_schema.sql` applied; both seeds applied |
| Schema in the database | 11 tables, 33 indexes, 5 services (3 benefits / 5 inclusions each), 1 article |
| `GET /health` | `{"status":"ok", ..., "checks":{"database":"ok"}}` |
| `GET /services` | 5 services, correct order, camelCase, numeric ids, `s-maxage=300` |
| `GET /blog` | `total: 1, totalPages: 1` |
| `GET /brands`, `/products` | `{"items":[]}` — correct, both tables are empty |
| Unknown slug / malformed slug | 404 / 400 |
| All 11 website routes | 200, now rendering from the database |
| `sitemap.xml` | 11 URLs from the database, still omitting the empty directories |
| **Contact form, browser to database** | Submitted in a real browser → success panel → row in `contact_enquiries` with the IP stored as a 64-char HMAC, not an address |
| `admin:create` | Account created, password printed once |
| Login → `/admin/me` → logout → `/admin/me` | 200 → 200 → 200 → 401 |
| Wrong password vs unknown address | Byte-identical 401 responses |
| Workspace `npm run check` | format, lint, typecheck clean; 106 tests pass |
| `npm run build` | Succeeds; pages now carry a 5-minute revalidate |

## Bugs found and fixed this week

1. **The API never loaded `.env`.** `loadConfig` reads `process.env` and
   nothing populated it, so `DATABASE_URL` was absent and only `/health`
   mounted — which is exactly the graceful degradation working as designed,
   masking the real problem. Fixed with Node's `--env-file-if-exists` on the
   dev and CLI scripts. `NODE_OPTIONS` rejects that flag, so Next.js is left
   on its own defaults instead; they already point at localhost, so the web
   app needs no env file in development.
2. **`db:dev` could not restart after an unclean stop.** A killed cluster
   leaves `postmaster.pid` behind and Postgres then refuses to start with
   "pre-existing shared memory block is still in use". It now checks for
   `PG_VERSION` to decide whether to initialise (rather than swallowing the
   error, which also hid a genuinely corrupt data directory) and removes a
   stale pid file after confirming nothing is listening on the port.
3. **`/admin/me` and `/admin/login` returned different user shapes** — `me`
   included `isActive`. Unified, with a test asserting the keys match.
4. One of my own tests inserted `published_at` into `brands`, which has no
   such column. That is correct by design — only `pages` and `blog_posts` are
   dated content — so the test was wrong, not the schema.

## Dependencies added

| Package | Why | Ships? |
|---|---|---|
| `pg` | PostgreSQL driver | Yes |
| `@node-rs/argon2` | Argon2id hashing | Yes |
| `nodemailer` | SMTP | Yes |
| `cookie-parser` | Session cookie | Yes |
| `express-rate-limit` | Application-layer rate limits | Yes |
| `embedded-postgres` | Real Postgres for dev and tests | **No** — devDependency |

`npm audit --omit=dev --audit-level=high` is clean. `embedded-postgres` is
published only as a prerelease (`18.4.0-beta.17`), which is why it is pinned
exactly and confined to development. It pulls a ~107 MB platform binary on
install — worth noting before adding it to CI.

## Addendum — AnPreD and InfraShield are live

The owner supplied <https://anpred.com/> after the week's work was committed,
which unblocked the longest-running gap in the project.

**AnPreD** is the brand; **InfraShield** is its platform. Both were authored
into `database/seeds/003_brands_and_products.sql` entirely from AnPreD's own
site (homepage, `/infrashield`, `/about`) — every claim is one AnPreD makes
about itself. The logo was cut out of their `logo.png`, which ships with a
baked-in off-white background; a saturation mask drops it cleanly, and the
untouched original is kept in `assets/brand/`.

**The relationship wording.** The AnPreD footer reads *"© 2026 AnPreD. Owned
by Dee Tech Group"*. That establishes ownership but **not** a separate legal
entity, and the plan forbids "subsidiary" unless the structure supports it —
so `relationship_type` is `product_brand`, rendering as *"A product brand by
DeeTech Group"*. If AnPreD is separately incorporated this is one `UPDATE`,
and there is a test asserting the current value so the change has to be
deliberate rather than accidental.

Supporting work this needed:

- Brand and product descriptions render **Markdown** through the existing
  sanitiser, instead of being dumped into a `<p>`.
- The brand logo renders on the directory card and in the detail sidebar.
- `src/lib/text.ts` gives card summaries, meta descriptions and JSON-LD
  plain-text excerpts, so Markdown no longer leaks into a `<meta>` tag.
- **Bug fixed:** the lifecycle badge used a translucent tint, which takes its
  contrast from whatever is behind it — **2.4:1 on the navy page header**. It
  is now a solid fill with white text, legible on any surface.

`/brands`, `/brands/anpred`, `/products`, `/products/infrashield` and the
homepage brands section all switched themselves on, and the sitemap picked up
the two new URLs, because each was already reading the content layer and
gated on whether rows existed.

## Still blocked on the owner

| # | Needed | Turns on |
|---|---|---|
| 1 | SMTP provider and credentials | Enquiry notifications actually sending |
| 2 | Confirmation that `product_brand` is right for AnPreD, or that it is separately incorporated | The relationship line on every brand surface |
| 3 | Real figures / team roster / founding year | The hidden About sections |
| 4 | Written permission for the four named testimonials | The homepage testimonials |

Item 1 is the only one that changes behaviour rather than content: enquiries
are being saved correctly, but nobody is emailed about them yet.

## Next

**Week 4, Day 16 — the protected admin layout, navigation and dashboard.**
`requireAuth` and `requireRole` are in place and tested, so Day 16 is UI plus
the admin write endpoints behind them.
