# Week 2 Report — Public pages

Days 6–10 of the 30-working-day plan. Completed 2026-10-11.

---

## The architectural decision that shaped the week

The plan builds the API in Week 3, so Week 2's pages needed something to read
from. Rather than hardcoding copy into components and rewriting every page
next week, this week introduced **`apps/web/src/lib/content/`** — an async
content layer with the exact signatures the API will have:

```ts
getServices(): Promise<Service[]>
getServiceBySlug(slug): Promise<Service | null>
getBrands() / getBrandBySlug()
getProducts() / getProductBySlug() / getProductsByBrand()
getPosts(page): Promise<Paginated<BlogPost>>
getPostBySlug(slug)
```

Every page reads through this module and nothing else. Today the bodies return
checked-in fixtures; on Day 13 they become `fetch` calls to the Express API.
**No page component has to change.** Two rules hold in both implementations:
only `published` records are ever returned, and every function is async even
though the fixtures are not.

## Day 6 — About, Contact and the service listing

**`/services`** — index of the five services, reading through the content layer.

**`/about`** — intro, mission, vision, four working principles, services teaser.

Three sections are present in the code but **render nothing**, because the
source material is contradictory or unverified:

| Section | Why it is off | Unblocks |
|---|---|---|
| Stat counters | Legacy counters all read "0 +" (CQ-5) | Real figures |
| Team | Three of four people look like placeholders; one bio describes a different person (CQ-9) | The real roster |
| History timeline | Legacy page says both "over seven years" and "over the past 4 years" (CQ-6) | The founding year |

The About copy therefore makes **no claim about the company's age at all**.
Corrections applied: "MyZeon Tech" removed, "Vission" fixed, the truncated
"...through innovatio" sentence completed, and the paragraph that was
duplicated under both Mission and Vision replaced with distinct text.

**`/contact`** — real contact details (phone, email, both addresses, WhatsApp),
`Organization` JSON-LD, and a working enquiry form.

### The enquiry form

`POST /api/v1/enquiries` does not exist until Day 14, so the form is built
around that:

- The Zod schema lives in **`@deetech/shared-types`**, so the Next.js server
  action and the Express route will validate against the identical rules.
- The server action **re-validates everything**. A server action is a public
  HTTP endpoint; the browser's copy of the rules is a convenience only.
- A **honeypot** field, hidden from layout and from the accessibility tree.
- Until the API lands, a valid submit fails with a clear message **and the
  phone number and email address**, and the user's typing is preserved. The
  form does not pretend to have sent something that went nowhere.

## Day 7 — Service detail template

`/services/[slug]`, prerendered for all five services via `generateStaticParams`.

Fixed template: hero → intro → three "why choose us" blocks → inclusions list →
other services → CTA. Services use **structured fields** (`intro`, `benefits[]`,
`inclusions[]`) rather than one free-text Markdown body, because every legacy
service page already shares that shape and discrete fields keep the CMS editor
honest about it.

The five services were rewritten from the live copy with the audit defects
fixed — see "Content corrections" below.

A shared **`CTABand`** component now closes every public page, replacing the
legacy site's different CTA per page (one of which was an unfinished sentence,
CQ-12).

## Day 8–9 — Brands and products

`/brands`, `/brands/[slug]`, `/products`, `/products/[slug]` are **fully built**:
relationship labelling, product-by-brand grouping, lifecycle badges, external
link handling, `Brand` and `SoftwareApplication` JSON-LD, `generateStaticParams`,
per-record metadata.

> **Both directories are empty and render an honest empty state.** AnPreD and
> InfraShield appear nowhere on the current site, so there is no source for
> their names, positioning, logos or URLs — and `relationshipType` is a factual
> claim about company structure that the plan explicitly says must not be
> guessed. Filling `apps/web/src/lib/content/fixtures/brands.ts` turns both
> sections on. **No template work is outstanding.**

The empty state is a real state, not a placeholder: it says the directory is
not live yet and offers Services and Contact instead of inventing sample
entries. `/brands` and `/products` are also **excluded from the sitemap while
empty** — there is no reason to invite a crawler to a thin page.

Two components worth noting:

- **`ExternalLink`** — every outbound link gets `rel="noopener noreferrer"`, a
  new-tab icon, and the destination host appended to its accessible name, so
  an unannounced new tab never surprises a screen-reader or mobile user.
- **`LifecycleBadge`** — Available / Beta / Coming soon, each with a distinct
  label as well as a distinct colour, so colour is never the only carrier of
  meaning.

## Day 10 — Blog, metadata and accessibility

**`/blog`** — paginated listing (9 per page) with date, category and reading time.
**`/blog/[slug]`** — article template with `BlogPosting` JSON-LD and a `.prose-article`
stylesheet that targets bare tags, because from Week 4 the HTML comes from the
CMS editor and carries no classes.

Markdown is rendered with `marked` and then **sanitised with a narrow
allowlist** — no raw HTML passthrough, no inline styles, no iframes, no `data:`
URIs (an SVG data URI is a script delivery mechanism). Today's only input is a
checked-in fixture, but from Week 4 this same function renders whatever an
admin typed, and an allowlist added later is an allowlist added after the first
stored-XSS.

The blog launches with **one seed article**, written to be factual and
vendor-neutral: it makes no claims about DeeTech Group's history, clients or
results, because none have been verified. The legacy `hello-world` post is not
migrated; its URL 301s to `/blog`.

### Baseline metadata

| Route | What it does |
|---|---|
| `/sitemap.xml` | Generated from published content. Cannot list a draft or a non-existent page. Replaces the Yoast sitemap that returns **404** (SEO-1). |
| `/robots.txt` | Points at a sitemap that actually exists, over `https`. |
| `/blog/rss.xml` | Required — `docs/redirects.csv` maps the legacy `/index.php/feed/` here, so existing subscribers keep working. |

Every page has a unique title, a meta description and a canonical URL — the
direct fix for SEO-2 (no page had a meta description) and SEO-8 (every title
was `{Page} - DeeTechGroup`). Structured data: `Organization` on contact,
`Service` on service pages, `Brand` and `SoftwareApplication` on the
directories, `BlogPosting` on articles.

## Content corrections applied

Rewriting the service copy fixed seven audit findings:

| ID | Fix |
|---|---|
| CQ-1 / CQ-16 | "MyZeon Tech" removed from the Managed IT and Network Services intros |
| CQ-3 | Every `summary` is now unique; the legacy site shipped one identical sentence on all six cards |
| CQ-14 | "Network Service" / "Email service" pluralised and cased consistently |
| CQ-15 | Managed IT Services no longer lists web-development deliverables under "Our Web Development Services Include" |
| CQ-17 | The "why choose us" blocks for Network Services and Web Hosting no longer repeat the web-development text |
| CQ-18 | "Dee Tech Group" / "DeeTech Group" normalised |
| SEO-2 / SEO-8 | Every service has a distinct `seoTitle` and `seoDescription` |

---

## Verification — what was actually executed

| Command / check | Result |
|---|---|
| `npm run format:check` | Clean |
| `npm run lint` | Clean, 0 errors, 0 warnings |
| `npm run typecheck` | Clean, all three workspaces |
| `npm test` | **24 passed, 3 files** (was 9) — 15 new tests cover the enquiry schema and the honeypot |
| `npm run build` | Succeeded; 22 routes, 9 prerendered static, `/blog` and `/blog/rss.xml` dynamic |
| All 9 public routes | HTTP 200 |
| `/sitemap.xml`, `/robots.txt`, `/blog/rss.xml` | 200 with correct content types; sitemap lists 11 URLs and correctly omits the empty `/brands` and `/products` |
| `/services/nope`, `/blog/nope` | 404 |

### Browser-verified accessibility

Every page swept at 1280px for contrast, heading order, accessible names and
overflow; the new pages re-checked at 375px.

| Page | Text nodes checked | Contrast failures | Heading skips | Overflow |
|---|---|---|---|---|
| `/about` | 85 | 0 | none | 0 px |
| `/contact` | 69 | 0 | none | 0 px |
| `/services` | 64 | 0 | none | 0 px |
| `/brands` | 52 | 0 | none | 0 px |
| `/blog/[slug]` | 85 | 0 | none | 0 px |

### The enquiry form, driven in a real browser

| Case | Result |
|---|---|
| Invalid submit | All four fields rejected server-side; `role="alert"` summary; each field got `aria-invalid` and an `aria-describedby` error |
| Valid submit, API not running | Clear error naming the phone number and email; the user's typing retained |
| Honeypot filled | Accepted silently with the normal success panel; nothing sent onward |

## Bugs found and fixed this week

1. **Doubled page titles.** Service pages rendered
   `Web Development Services | DeeTech Group | DeeTech Group` — the fixtures'
   `seoTitle` included the brand and the Next.js metadata template appended it
   again. Suffix stripped from the fixtures and the convention documented on
   `SeoFields`.
2. **The honeypot leaked.** `website` was `z.literal("")`, so a filled trap
   produced a *validation error* — a distinguishable response a bot could tune
   against, and a "check the highlighted fields" message pointing at a field
   the user cannot see. Validation is now permissive on that field and
   `isLikelySpam()` decides, so a trapped submission gets the ordinary success
   response and is dropped.
3. **`danger` and `warning` failed contrast.** `#EA5356` is 3.58:1 on white and
   `#B7791F` is 3.64:1 — both below AA, and `danger` was carrying the form's
   error text and required-field asterisks. Both demoted to a `-400`
   decorative step, with darker base values (`#C44548`, `#9B661A`) for text.
4. **`/services` skipped h1 → h3.** The card titles are `h3` and the page had
   no `h2`. Added a visually-hidden "All services" heading.

## Still blocked on the owner

Unchanged from Week 1, and now more concrete because the templates exist:

| # | Needed | What it turns on |
|---|---|---|
| 1 | AnPreD: name, tagline, description, logo, website, docs URL | `/brands`, `/brands/anpred`, the homepage brands section |
| 2 | InfraShield: the same, plus how it relates to AnPreD | `/products` |
| 3 | **The `relationshipType` for each** — product_brand, division, subsidiary, partner or portfolio_company | The relationship wording on every brand surface |
| 4 | Real figures for the stat counters | The stats band on `/` and `/about` |
| 5 | The real team roster | The team section on `/about` |
| 6 | The founding year (4 or 7?) | The history timeline on `/about` |
| 7 | Written permission for the four named testimonials | The testimonials on `/` |
| 8 | Keep or drop "Web Design" as a sixth service | `/services` |
| 9 | SMTP provider and credentials | Day 14 — makes the contact form actually deliver |

Items 1–3 are the only ones that were due this week. Everything else in Week 2
shipped without them.

## Next

**Week 3, Day 11 — design the PostgreSQL schema and write the migrations and
seeds.** The fixtures in `apps/web/src/lib/content/fixtures/` are the seed data:
five services and one article, already in the shape the tables need.
