# Week 4 Report — Admin CMS

Days 16–20 of the 30-working-day plan. Completed 2026-10-12.

---

## Day 16 — Protected layout, navigation, dashboard

**Routes.** `/admin/login` is public; everything else lives in a
`(protected)` route group whose layout checks the session and redirects.
`/admin/login` had to sit outside that group, because a login page behind a
login check is unreachable.

**The session gate is a convenience, not the control.** Every admin API route
is independently protected by `requireAuth` — bypassing the layout gains an
attacker an empty page. Verified: all four admin endpoint families return 401
with no cookie.

**Sign-in.** The API issues its session cookie for its own origin, which the
browser never sees because it only ever talks to the web app. The server
action reads the token out of the API's `Set-Cookie` and re-issues it on the
web origin with the same hardening (`HttpOnly`, `SameSite=Strict`, `Secure`
in production). The API remains the only thing that can mint or validate a
session.

**`src/lib/admin/api.ts`** starts with `import "server-only"`, which is
load-bearing: importing it from a client component is a build error, so the
session cookie cannot end up in a browser bundle.

**Dashboard** shows published/draft counts per type, media and enquiry
totals, and a banner when enquiries are waiting. One SQL round trip for all
thirteen counts rather than thirteen queries.

### The public site moved into a route group

`/admin` was rendering inside the marketing header and footer. The public
chrome now lives in `(site)/layout.tsx` and the root layout is just the
document shell. **No URL changed** — route groups are invisible in the path —
and the build output confirms every route is where it was.

## Day 17–19 — Content CRUD

Five content types with near-identical CRUD would have been five
near-identical sets of pages. Instead, `src/lib/admin/resources.ts` describes
each type's fields once and the list and edit pages render from it. The
registry describes **presentation only**; validation lives in the shared Zod
schemas.

| Capability | Where |
|---|---|
| List with status filter, search, pagination | `/admin/[resource]` |
| Create / edit | `/admin/[resource]/[id]`, `id=new` to create |
| Publish / unpublish without resubmitting the form | Status bar on the edit page |
| Preview the public URL | "View live page" / "Preview the URL" |
| Delete | Admin role only, both in the UI and in the API |

**Field types:** text, slug, textarea, markdown, number, select, status,
datetime, media, and a **repeater** for the service benefit and inclusion
lists. The repeater submits its rows as JSON in one hidden field, because a
dynamic list of pairs does not round-trip through flat form encoding.

**Blog publishing dates** follow one rule in one place
(`resolvePublishedAt`): publishing with no date stamps now, and returning to
draft keeps the existing date — so unpublishing and republishing does not
silently move an article to the top of the blog.

**Reserved slugs** are refused with the list of what is taken. Verified in the
browser: creating a page with the slug `services` is rejected.

**Revalidation.** Every save revalidates the affected public paths plus the
sitemap and, for articles, the RSS feed.

## Day 20 — Media and SEO fields

**Upload controls**, each independent because any one alone is bypassable:

1. **Size** — capped by multer (aborts the stream) and re-checked after.
2. **Declared type** — allowlist of PNG, JPEG, WebP, GIF, PDF.
3. **Actual bytes** — magic-byte check. A declared type is a claim; the bytes
   are evidence.
4. **Generated name** — the extension comes from the *verified* type and the
   name carries 8 random bytes. `shell.php.png` is stored as
   `shell-php-<random>.png`.
5. **Path containment** — anything resolving outside the storage root is
   refused, and `wx` means a collision fails rather than overwrites.

**SVG is deliberately excluded**: it is an XML document that can carry script,
and serving one from our own origin would be stored XSS.

Files are buffered in memory and only written after verification, so nothing
untrusted lands in the media directory even briefly. Serving adds
`nosniff`, `Content-Disposition: inline` and `default-src 'none'; sandbox`.

**Alt text is required at upload.** Every one of the 53 legacy media items has
none (SEO-4); the column is `NOT NULL` and the schema matches it at the edge.

**SEO fields** on every type, with the recommended lengths as hints rather
than hard limits — see the bug below.

**Enquiry inbox** is read-and-triage only: content is a record of what
somebody sent and is never editable, only `status`. The message renders as
plain text, never as markup.

---

## Verification — what was actually executed

### Tests

**146 passed, 8 files** (was 109). 37 new tests cover the admin write schemas.

### Driven by hand in a real browser

| Flow | Result |
|---|---|
| Unauthenticated `/admin` | Redirects to `/admin/login`, standalone (no public chrome) |
| Sign in | Lands on the dashboard with real counts |
| Services list | 5 rows, status filters, search |
| Edit a service | All 5 sections render, repeater pre-populated with 3 benefits and 5 inclusions |
| Invalid save | Field-level errors, `aria-invalid`, typed values retained |
| Valid save | "Saved." → row updated in Postgres → **public page shows the change** |
| Reserved slug `services` | Refused, with the reserved list in the message |
| Create a page | Created as a draft; `/privacy-policy` 404s publicly |
| Publish it | "Published" → `/privacy-policy` returns 200 with the content |
| Upload with no alt text | Rejected |
| **PHP payload renamed `.png`, declared `image/png`** | **Rejected on magic bytes** |
| Genuine PNG | Accepted; safe name, dimensions extracted, thumbnail renders |
| Media path traversal / dotfile | 404 |
| Enquiry inbox and detail | Real enquiry listed; triage buttons work |

### Accessibility

| Page | Text nodes | Contrast failures | Heading skips | Unlabelled fields | Overflow |
|---|---|---|---|---|---|
| `/admin/enquiries/1` | 37 | 0 | none | — | 0 px |
| `/admin/brands/1` | 45 | 0 | none | **0** | 0 px |

### Build

`npm run build` succeeds; 31 routes. Every admin route is `ƒ` (dynamic) — a
prerendered admin page would be a cached admin page.

## Bugs found and fixed

1. **The admin schemas were not idempotent.** This is the significant one.
   Every save is validated **twice**: once by the server action against the
   form, then by the API against what the action forwards — so the second
   parse sees the first parse's *output*. Optional fields normalised `""` to
   `null` on the way out but only accepted `""` or `undefined` on the way in.
   Every save with an empty optional field passed in the browser and was
   rejected by the API with a bare "The request did not pass validation."
   Fixed by accepting `null` as input too, with round-trip tests on all five
   schemas.
2. **The SEO length cap rejected the seeded copy.** 180 characters was a hard
   error, and `web-development`'s description is 182 — so an editor could not
   save an existing record without shortening it. A search engine truncates a
   long description; it does not reject the page. The caps are now defensive
   bounds (150 / 320) and the ~60/~155 guidance is in the field hints.
3. **`ADMIN_RESOURCES` lived in a `"use client"` module.** A server component
   importing a non-component value from a client module gets a client
   reference proxy, so `.map` was not a function and the dashboard crashed.
   Moved to a plain module.
4. **The Zod schema could not cross the server/client boundary.** Passing the
   whole `ResourceSpec` to the form failed with "Only plain objects... can be
   passed to Client Components". The form now takes only its serialisable
   parts.
5. **Media thumbnails were broken in development.** Content stores
   origin-relative `/media/...` URLs, which nginx proxies to the API in
   production but nothing proxied in development. Added a rewrite so both
   behave the same.
6. **Admin nav labels failed contrast** at 4.22:1 — the same `navy-400`
   on `navy-950` problem fixed in the public footer in Week 1.
7. **`.devdata/` was only ignored at the repo root**, so the API's media
   directory showed up as untracked.

## A deployment constraint worth knowing now

`next build` **prerenders content pages by calling the API**. With the API
down, the build still succeeds — the content layer catches the failure and
returns empty — but it produces a site with no services, no brands and no
articles. That is the failure policy working as designed for a *runtime*
blip, and exactly wrong at build time.

So the Week 6 deployment must either:

- bring the database and API up before building the web image, or
- build the web image without prerendering and let the revalidate window
  populate pages on first request.

Noted for Day 26. It does not affect anything before then.

## Still blocked on the owner

| # | Needed | Turns on |
|---|---|---|
| 1 | SMTP provider and credentials | Enquiry notification emails actually sending |
| 2 | Real figures / team roster / founding year | The hidden About sections |
| 3 | Written permission for the four named testimonials | The homepage testimonials |

All three are content, not code. Item 1 is still the only one that changes
behaviour: enquiries are saved and visible in the inbox, but nobody is
emailed.

## Next

**Week 5, Day 21 — migrate the approved copy and review the placeholder
material.** The CMS now exists to do it in, which is the point: the remaining
content work is data entry rather than code. Day 22's redirect map is already
written and validated.
