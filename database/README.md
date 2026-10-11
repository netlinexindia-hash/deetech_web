# Database

PostgreSQL 18.

```
migrations/   Forward-only SQL. Immutable once applied.
seeds/        Idempotent approved content. Safe to re-run.
```

## Running it

The plan deploys PostgreSQL in Docker, but Docker is not installed on every
machine that needs to run this project. For local work:

```bash
npm run db:dev --workspace=@deetech/api
```

That starts a real PostgreSQL 18 on `127.0.0.1:55432` via `embedded-postgres`
(a devDependency — it never ships), applies the migrations, applies the seeds,
and prints the `DATABASE_URL` to put in `.env`. Data lives in `.devdata/`,
which is git-ignored. Ctrl+C stops it.

Against any other database, set `DATABASE_URL` and run:

```bash
npm run db:migrate --workspace=@deetech/api   # schema only
npm run db:seed    --workspace=@deetech/api   # content only
npm run db:setup   --workspace=@deetech/api   # both
```

Create the first administrator:

```bash
npm run admin:create --workspace=@deetech/api -- --email you@example.com --name "Your Name"
```

The password is read from `ADMIN_PASSWORD` or generated and printed once. It is
deliberately **not** a command-line argument: argv is readable by other
processes and lands in shell history.

## Migrations

Named `NNNN_description.sql` and applied in name order. The runner
(`apps/api/src/db/migrate.ts`) gives three guarantees:

1. **Each migration runs in its own transaction.** A failure halfway through
   leaves no partial schema.
2. **A session advisory lock is held for the whole run.** Two containers
   starting at once cannot apply the same migration twice.
3. **Checksums are recorded.** Editing a migration that has already run is a
   hard error, not a silent divergence between environments.

So: **migrations are immutable once applied.** To change something, add a new
one. Line endings are normalised before hashing, so a Windows checkout and the
Linux VPS agree.

## Seeds

Unlike migrations, seeds are **re-runnable**. Every statement uses
`ON CONFLICT ... DO UPDATE`, so applying them again brings approved content
back in line rather than erroring or duplicating rows. They are not
checksummed, because re-applying them is a normal operation.

`001_services.sql` and `002_blog.sql` were generated from the reviewed Week 2
copy in the (now removed) `apps/web/src/lib/content/fixtures/`.

## Schema notes

The data model is specified in
[`../docs/02-sitemap-and-design-system.md`](../docs/02-sitemap-and-design-system.md),
section 2. Decisions worth knowing before you change anything:

- **`text`, not `varchar(n)`.** Length limits live in the Zod schemas, where
  they can produce a useful error message.
- **`timestamptz`, always.** `timestamp` without a zone is a trap.
- **CHECK constraints, not Postgres ENUMs.** Adding a value to an ENUM is a
  migration that cannot run inside a transaction on older servers; a CHECK is
  trivial to change.
- **A `slug` domain** enforces `^[a-z0-9]+(-[a-z0-9]+)*$` at the column level,
  matching `SLUG_PATTERN` in `@deetech/shared-types`.
- **`updated_at` is maintained by a trigger**, so a caller cannot forget it.
- **Partial indexes** on `WHERE status = 'published'`, because that is the
  filter every public read applies.

Four constraints exist specifically to stop defects found in the Day 1 audit
recurring. Each has a test in `apps/api/tests/schema.test.ts`:

| Constraint | Stops |
|---|---|
| `services_summary_key` (unique summary) | CQ-3 — the legacy site shipped one identical sentence on all six service cards |
| `media.alt_text NOT NULL` and non-blank | SEO-4 — all 53 legacy media items have empty alt text |
| `brands.relationship_type` CHECK | A guessed "subsidiary" claim about company structure |
| `*_published_has_date` CHECK | A published row with no publication date, which breaks date sorting |

Also deliberate:

- `products.brand_id` is `ON DELETE RESTRICT` — a brand cannot be deleted
  while products point at it; the admin has to decide what happens to them.
- `blog_posts.author_id` is `ON DELETE SET NULL` — deleting an author must not
  delete their articles. `author_name` carries the display name.
- `admin_users` has a unique index on `lower(email)`, because login matches
  case-insensitively and two accounts differing only in case would be a bug.
- `admin_sessions.id` stores a **hash** of the cookie value, so a database
  read does not yield a working session cookie.
- `contact_enquiries.ip_hash` and `admin_sessions.ip_hash` store an HMAC of
  the IP keyed with `SESSION_SECRET`, not the address. An unkeyed hash of an
  IPv4 address is reversible by brute force in seconds.
- `services.benefits` and `services.inclusions` are JSONB arrays of
  `{title, body}` rather than child tables: nothing queries inside them,
  ordering is free, and the CMS edits them as one list. A CHECK keeps them
  arrays.
