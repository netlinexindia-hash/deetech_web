# Week 5 Report — Migration and release candidate

Days 21–25 of the 30-working-day plan. Completed 2026-10-12.

---

## Day 21 — Content migration and placeholder review

The footer linked to `/privacy-policy` and `/terms`; both 404ed.
`database/seeds/004_legal_pages.sql` adds them.

**They are drafts, deliberately**, and the seed's `ON CONFLICT` clause does
not touch `status` — so once somebody reviews and publishes them, re-running
the seeds cannot quietly unpublish them again.

They are **drafted, not templated**. Every factual claim describes what this
system actually does and is checkable against the code: which columns
`contact_enquiries` has, that the IP is HMAC-hashed rather than stored, that
fonts are self-hosted so loading a page tells no third party, that no
analytics is configured. A generic template would have claimed practices the
site does not follow, which is worse than having no page.

**They have not been reviewed by a lawyer.** That is stated at the top of
each page and in the seed. They are a sound starting point and a useful
briefing document for whoever does review them, particularly against India's
DPDP Act 2023.

### A defect this surfaced

Shipping the legal pages as drafts meant the footer would link to two 404s on
every page until somebody published them. The footer now **renders a legal
link only when that page is actually published** — the link appears the
moment the page does. Verified both ways: with both as drafts the footer
shows neither, and publishing the privacy policy through the CMS made its
link appear immediately.

## Day 22 — Redirects

`generate-redirects.mjs` already proved the map is internally consistent. That
is not the same as correct, so `verify-redirects.mjs` checks the two things
that actually break a migration:

- **Coverage** — every URL the live WordPress site serves has a rule.
- **Destinations** — every target resolves. A rule pointing at a 404 is worse
  than no rule: it turns a recoverable 404 into a redirect to one, which a
  crawler reads as a soft 404.

```
All 15 legacy URLs have a rule, and all 11 destinations resolve.
```

It exits non-zero on failure, so it can gate the Day 30 cutover. Run it
against staging before, and production after.

## Day 23 — Permissions and email

**46 new permission tests**, driven against the API with no UI involved —
the only way to prove the control is real rather than cosmetic.

- Every one of the 16 admin endpoints returns 401 with no cookie and with a
  forged cookie. Listing them exhaustively means a new endpoint added
  unprotected fails the suite.
- An editor can read, edit, publish and unpublish — and **cannot** delete
  content, media or enquiries (403, and the row survives).
- Unpublishing removes a record from the public API immediately while the
  editor still sees it in the CMS.
- Validation is enforced at the API, not only the form: a reserved slug, a
  duplicate slug and a duplicate service summary are all refused when posted
  directly.
- The enquiry inbox accepts a status change and **ignores** attempts to edit
  the message or the sender's address in the same request.

**10 mailer tests.** Nodemailer's `jsonTransport` builds the real message —
same envelope, same header encoding — and hands it back instead of opening a
connection, so headers are asserted as a mail server would receive them.
That makes the header-injection test meaningful rather than a test of my own
sanitiser in isolation: a `Bcc:` smuggled into the subject or the sender's
name produces no extra header and no `bcc` field.

Also covered: `reply-to` is the submitter while `from` stays a domain we are
authorised to send as, the HTML part is escaped, unfilled optional fields are
omitted, and a transport failure returns false rather than throwing — because
the enquiry is already saved and failing the request would make the visitor
submit it again.

## Day 24 — Responsive, accessibility, performance, dependency and security

### Accessibility and structure — 12 public pages

| Check | Result |
|---|---|
| Single `<h1>` | 12/12 |
| Heading order | No skips on any page |
| Canonical URL | 12/12 |
| Meta description | 12/12 (87–175 characters) |
| Images missing `alt` | 0 |
| Outbound links without `rel="noopener"` | 0 |
| Contrast failures (WCAG AA) | 0 across every rendered page |
| Horizontal overflow at 375 px | **0 px on all 12** |
| Structured data | `Service`, `Brand`, `SoftwareApplication`, `BlogPosting`, `Organization` |

### Performance

| | Legacy WordPress | New site |
|---|---|---|
| Homepage HTML | 235 KB | **81 KB** |
| Other pages | — | 49–74 KB |
| Warm response | — | 0.13–0.28 s |

A 65% reduction on the homepage, before compression. The legacy figure is the
same page measured on the same connection.

### Dependencies and security

- `npm audit --omit=dev`: **0 vulnerabilities**.
- `zod` patched 4.6.5 → 4.6.6 — the only shipped dependency with an update.
- Everything else outdated is dev tooling (ESLint 10, TypeScript 7), held
  back deliberately: `eslint-config-next` requires ESLint 9, and TypeScript 7
  is the native rewrite.
- The 5 remaining dev advisories are the unfixable `braces` chain documented
  in the README.

## Day 25 — Backup, restore and rollback

`backup.sh` and `restore.sh` are written, with the properties that matter:

- The backup **verifies its own output** — a dump that is empty or truncated
  is deleted rather than left looking like a backup.
- `restore.sh` **refuses to run** unless `RESTORE_CONFIRM` matches the target
  database name. A restore pointed at the wrong database is what turns an
  incident into a catastrophe.
- It verifies the archive **before** touching the database, so a corrupt
  backup is discovered while the current data is still intact.
- `psql --set ON_ERROR_STOP=1`, so a failed statement aborts rather than
  leaving a half-restored schema that looks like it worked.
- It prints row counts afterwards and says to check them.

**The scripts themselves are unexecuted.** They wrap `pg_dump` and `psql`,
and the embedded Postgres used for development ships only `initdb`, `pg_ctl`
and `postgres` — no client tools. Their syntax is validated (`bash -n`), and
they must be run for real against staging on Day 25 of the deployment.

What **is** tested is the guarantee the procedure exists to provide, and the
part that is ours to get wrong — **6 round-trip tests** that snapshot every
table, truncate everything, restore, and verify:

- every table returns with identical contents;
- **identity sequences are restored**, so the next insert does not collide.
  A restore that brings rows back but leaves sequences at zero looks like a
  success and then fails on the next insert — the kind of thing you find
  during an incident rather than before one;
- the Argon2 password hash survives, so operators can still sign in;
- enquiries survive, which matters most because content can be re-entered
  from the CMS and an enquiry somebody sent cannot be recovered from anywhere;
- the brand-to-product relationship survives;
- the schema still **enforces its constraints** afterwards — a restore that
  dropped them would pass every other check and silently accept bad data.

---

## The significant bug: the development database was not UTF-8

`initdb` inherits the host locale. On Windows that is **WIN1252**, so the
development cluster silently rejected any character outside Latin-1 while
production (`postgres:17-alpine`) accepts it.

It surfaced when seeding a page containing `⚠`, but the real exposure is
larger: for a business in Noida, a **rupee sign or Devanagari text is
ordinary content**. It would have worked in production and failed in
development — or, worse, been "fixed" by removing the character.

Fixed by pinning `--encoding=UTF8 --no-locale` in three places: the dev
server, the test harness, and `POSTGRES_INITDB_ARGS` in `docker-compose.yml`
so production is explicit rather than defaulted. (`C.UTF-8` is not a valid
locale name on Windows — initdb rejects it — so `--no-locale` is used, which
means locale C and is valid everywhere.)

There are now tests asserting the cluster is UTF-8 and that `₹1,20,000`,
`डीटेक ग्रुप`, em dashes, curly quotes and `⚠` all round-trip unchanged.

## Other bugs found and fixed

1. **A blocked delete returned 500.** Postgres raises **23001**
   (`restrict_violation`) for `ON DELETE RESTRICT`, not 23503
   (`foreign_key_violation`). Only 23503 was handled, so "this brand still
   has products" was an unhandled error instead of a useful message.
2. **A seed collided with two tests** that inserted `privacy-policy` and
   `terms` by hand. The tests now use their own slugs, plus a new test
   asserting the seeded legal pages stay unpublished.
3. **`.devdata/` was only ignored at the repo root**, so the API's media
   directory showed as untracked. (Carried over from Week 4.)
4. Two pieces of sloppy test code of mine — an unused variable and a line
   Prettier rewrapped into an ambiguous property access.

## Something that looked like a bug and was not

`/privacy-policy` kept returning 200 after being set to draft. The API was
correctly returning 404 throughout. The cause was a **stale production build
in `.next`** from my own earlier `npm run build`, being served by the dev
server. Removing `.next` resolved it. Worth chasing rather than assuming,
because the same symptom would have been a serious draft leak.

## Verification

| Command | Result |
|---|---|
| `npm run format:check` | Clean |
| `npm run redirects:build` | 24 rules, no loops, duplicates or chains |
| `npm run lint` | Clean |
| `npm run typecheck` | Clean, all three workspaces |
| `npm test` | **215 passed, 11 files** (was 146) |
| `verify-redirects.mjs` | 15/15 legacy URLs covered, 11/11 destinations resolve |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `bash -n` on both scripts | Syntax OK |

## Still blocked on the owner

| # | Needed | Blocks |
|---|---|---|
| 1 | **Legal review of the privacy policy and terms** | Publishing them. They ship as drafts until then. |
| 2 | SMTP provider and credentials | Enquiry notification emails |
| 3 | Real figures / team roster / founding year | The hidden About sections |
| 4 | Written permission for the four named testimonials | The homepage testimonials |

## Next

**Week 6, Day 26 — production images, Docker Compose, nginx and health
checks.** Two things already identified that belong to Day 26:

- **Docker has never been run.** The compose file and both Dockerfiles are
  written and unexecuted; this is the week they have to work.
- **`next build` prerenders content by calling the API.** With the API down
  the build succeeds and ships empty content pages, so the build order has
  to be settled: bring the database and API up first, or drop prerendering.
