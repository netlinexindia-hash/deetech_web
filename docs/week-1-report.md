# Week 1 Report — Foundation and design

Days 1–5 of the 30-working-day plan. Completed 2026-10-11.

---

## Day 1 — Audit WordPress pages, URLs, media, blog content, plugins and SEO metadata

**Delivered:** [`docs/01-wordpress-audit.md`](01-wordpress-audit.md),
[`docs/redirects.csv`](redirects.csv),
[`docs/audit/legacy-copy/`](audit/legacy-copy) (plain-text extract of all 10 live pages/posts).

Audited over the public HTTP interface and the WordPress REST API. No admin
credentials were used, so 4 items are marked **[NEEDS ADMIN]** in the document.

Headline numbers: **9 pages, 1 post, 1 category, 0 tags, 1 author, 53 media
items.** Stack is Astra 4.4 + Elementor 4.2.4 + ElementsKit + Sina Extension +
MyStickyElements + Yoast, on nginx/PHP 8.3.

The ten findings that change the plan:

1. **Every URL carries an `/index.php/` prefix** and the clean paths 404. Every
   URL except `/` therefore changes in the rebuild.
2. **`robots.txt` advertises a sitemap that returns 404.** The site has no
   working XML sitemap at all.
3. **No meta description on any page or post.**
4. **No analytics of any kind is installed** — no GA4, GTM, Clarity or pixel.
   There is no historical traffic baseline to compare against after cutover.
5. **All 53 media items have empty alt text.**
6. **The blog is one default `hello-world` post** titled "What is Lorem Ipsum?".
   There is nothing to migrate.
7. **The old brand name "MyZeon Tech" is still live** in the About, Managed IT
   Services and Network Services page copy, and in the author slug.
8. **Lorem-style filler is live on the homepage**, the six service cards all
   share one identical description, the six portfolio tiles all share one
   identical description, and the stat counters all read "0 +".
9. **The Managed IT Services page lists web-development deliverables** under a
   heading that reads "Our Web Development Services Include:" — wrong content
   pasted into the page.
10. **Neither "AnPreD" nor "InfraShield" appears anywhere on the site.** All
    brand and product content has to be authored, not migrated.

Net effect: migration risk is **low** (no sitemap, no analytics, no real blog,
9 URLs that matter), but **content is the critical path**, not code.

## Day 2 — Finalize sitemap, content types, design references, brand colors and responsive design

**Delivered:** [`docs/02-sitemap-and-design-system.md`](02-sitemap-and-design-system.md).

Decisions made:

- **URL scheme** — keep the `www` host, drop `/index.php/`, no trailing slash,
  services nested under `/services/`, `contact-us` shortened to `contact`,
  `network-service`/`email-service` pluralised. A reserved-slug list stops a
  CMS page shadowing a route.
- **Content types** — the plan's eight tables, with the field-level decisions
  that were left open. Two are worth calling out:
  - `brands.relationship_type` is a **constrained enum**, not free text, and the
    displayed phrase is derived from it in one shared helper. That is how the
    plan's legal-wording requirement gets enforced instead of hoped for.
    `subsidiary` is not selectable until the ownership structure is confirmed.
  - `products` gets a **separate `lifecycle` field** (`available | beta |
    coming_soon`) rather than overloading `status`, which is publication state.
- **Brand colours** — the live site runs navy + coral while the logo runs blue +
  green. They do not agree. **The logo wins:** brand blue `#357AD1`, navy
  `#242F65` as ink, logo green `#7CB633` as the single accent. Coral is demoted
  from brand colour to the semantic `danger` colour, which removes the clash.
  Body text is darkened from the legacy `#767B92` (fails WCAG AA at body size)
  to `#4A4F63` (~8.1:1).
- **Typography** — the legacy site loads five Google font families. Replaced with
  **one** (Inter), self-hosted via `next/font`, removing a render-blocking
  third-party request.
- **Responsive** — mobile-first, review widths 375 / 768 / 1280.
- **Accessibility** — eight binding rules, checked again on Day 24.
- **Deliberately not rebuilt:** the floating widget stack, ~15 decorative
  Elementor PNGs, the portfolio grid (no real case studies) and the stat
  counters (no real figures).

## Day 3 — Create repository, lint/type-check/test scripts, environment templates and local Docker setup

**Delivered:** the repository skeleton in the structure the plan specifies.

```
apps/web  apps/api  packages/shared-types  database/  infrastructure/  tests/  docs/
```

- **npm workspaces**, with `@deetech/shared-types` compiled to `dist` so the API
  can import runtime values from it (not just types) without a `.ts` file
  reaching production.
- **`apps/api`** — Express 5 + TypeScript, Helmet, CORS, Pino with redaction of
  `authorization`, `cookie`, `set-cookie`, `*.password` and `*.token`. Zod-parsed
  configuration that **refuses to start** on bad input rather than guessing.
  Central error handler that never leaks a stack trace. Graceful SIGTERM
  shutdown with a 10s cap. `GET /api/v1/health`.
- **`apps/web`** — Next.js 16 App Router, React 19, TypeScript, Tailwind 4, in
  `output: "standalone"` mode.
- **Scripts** — `lint`, `typecheck`, `test`, `format`, `build` and a single
  `npm run check` that runs them in CI order.
- **`.env.example`** — every variable the project will need through Week 6,
  grouped and commented, with no real values and no production-shaped defaults.
- **Docker** — multi-stage Dockerfiles for both apps (non-root `node` user, tini
  as PID 1, health checks, pinned base images) and a `docker-compose.yml` where
  **PostgreSQL has no `ports:` entry** and the two apps publish only to
  `127.0.0.1`.
- **nginx** — a draft reverse-proxy config with the security headers the current
  site is missing, rate limits on the enquiry and admin-login endpoints, 410s
  for legacy WordPress endpoints, and a read-only alias that keeps old
  `/wp-content/uploads/` image URLs working after cutover.
- **Redirect generator** — `npm run redirects:build` compiles `docs/redirects.csv`
  into the nginx snippet and **fails the build** on a self-redirect, a duplicate
  or a redirect chain. CI also fails if the generated file is out of sync with
  the CSV, so the two can never drift.
- **CI** — GitHub Actions running format, redirect sync, lint, typecheck, test,
  build and `npm audit --omit=dev`.

## Day 4 — Build shared header, footer, navigation, typography, buttons and responsive layout

**Delivered:** the design tokens and the shared chrome.

- `apps/web/src/app/globals.css` — all colour, type, radius and shadow tokens in
  a Tailwind v4 `@theme` block, plus base styles, a global focus ring, and a
  `prefers-reduced-motion` block.
- `Button` — four variants, three sizes, renders `<Link>` when given `href` and
  `<button>` otherwise, so navigation is never faked with a click handler.
- `Container`, `Section` (four tones, one vertical rhythm), `SectionHeading`
  (with an explicit `level` so heading order stays correct), `Card`, `LinkCard`.
- `Header` — sticky, logo, desktop nav with a Services dropdown, phone number
  and quote CTA; below `lg`, a full-height mobile drawer with focus trap,
  `Escape` to close, focus returned to the toggle, and body scroll locked.
- `Footer` — four columns, both office addresses, phone, email, legal links.
- `layout.tsx` — Inter via `next/font`, skip-to-content link, full `metadata`
  including `metadataBase`, canonical, Open Graph and Twitter cards, `lang="en-IN"`.

## Day 5 — Build homepage sections and first responsive review

**Delivered:** `apps/web/src/app/page.tsx` and `src/components/home/Hero.tsx`.

Sections: hero, services grid, "a technology partner" capability band,
testimonials, closing CTA. Plus a 404 page.

**Content honesty.** `src/lib/content/home.ts` holds the copy. Two arrays in it
are **empty on purpose** and their sections render nothing:

- `featuredBrands` — AnPreD and InfraShield details do not exist yet, and the
  correct legal relationship wording has not been confirmed. Nothing was
  invented to fill the space.
- `stats` — the legacy counters all read "0 +".

The five service summaries were **rewritten to be unique**, derived from the
real copy on each service page. That is the direct fix for the legacy site
shipping one identical sentence on all six cards.

### Responsive and accessibility review

Run against the dev server in a real browser at 375, 768 and 1280 px.

| Check | Result |
|---|---|
| Horizontal overflow at 375 / 768 / 1280 | **0 px** at all three |
| Heading structure | One `<h1>`; `h2` sections; `h3` within. No skipped levels |
| Elements with no accessible name | 0 of 42 links and buttons |
| Service grid | 1 col at 375, 2 at 768, 3 at 1280 |
| Mobile drawer | Opens, traps focus (first item focused), locks body scroll, closes on `Escape`, returns focus to the toggle |
| `lang` | `en-IN` |
| Images | Both have real `alt` text |

**One real bug found and fixed.** The mobile drawer rendered at **1 px tall**.
`backdrop-blur` on `<header>` makes it a containing block for fixed-position
descendants, so the drawer's `inset-x-0 top-18 bottom-0` resolved against the
72 px header box instead of the viewport. The drawer now renders as a sibling of
`<header>`, and the reason is commented in the file so it does not get moved back.

**Tap targets.** Footer links, the header phone link and the dropdown items were
28–32 px tall. Raised to 44 px on touch widths (relaxing to 36 px from `sm:` up,
where the pointer is a mouse). Remaining sub-44 px elements are a phone number
inline inside a sentence (exempt under WCAG 2.2 SC 2.5.8) and the service card
titles, whose real target is the full card via a covering `::after` overlay.

---

## Verification — what was actually executed

Every command below was run and its output observed.

| Command | Result |
|---|---|
| `npm run format:check` | All matched files use Prettier code style |
| `npm run redirects:build` | Wrote 24 rules; validation found no self-redirects, duplicates or chains |
| `npm run lint` | Clean, both workspaces, 0 errors and 0 warnings |
| `npm run typecheck` | Clean, all three workspaces |
| `npm test` | **9 passed, 2 files** (health endpoint, 404 shape, security headers, config parsing) |
| `npm run build` | Succeeded; `/` and `/_not-found` prerendered static; standalone server emitted |
| `curl /api/v1/health` | `{"status":"ok","service":"deetech-api","version":"0.1.0","checks":{"database":"not_configured"}}` |
| `curl /nope` | `404 {"error":{"code":"not_found",...}}` |
| Response headers | `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` present; `X-Powered-By` absent |

**Not executed:** `docker compose up`. Docker is not installed on this machine
(`docker` is not on PATH, and there is no Docker install under Program Files).
The Dockerfiles and compose file are written but **unverified**. They must be
built and run before Week 6.

### Dependency audit

`npm audit` reports 5 high-severity findings, all one chain:
`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` →
`braces`. The advisory covers **every published version of `braces`**, so there
is no version to move to; npm's suggested fix is a downgrade to
`eslint-config-next@14`, which is a regression. These are dev-only lint
dependencies and are not shipped. `npm audit --omit=dev --audit-level=high` is
clean, and that is what CI gates on.

Two findings **were** fixed during the week: a critical prototype-pollution RCE
in `tinypool` and a path-traversal in `@vitest/mocker`, both resolved by moving
Vitest from 3.x to 5.x.

---

## Blocked on the owner

Nothing in Week 2 is blocked. These block **Week 2 Day 8 onwards**:

| # | Needed | Blocks |
|---|---|---|
| 1 | AnPreD: full name, positioning, description, logo, website URL, docs URL, lifecycle status | Day 8 |
| 2 | InfraShield: the same, plus its relationship to AnPreD | Day 8–9 |
| 3 | **The legal relationship wording.** Is DeeTech Group a proprietorship with AnPreD as a product brand, or does the ownership structure support "subsidiary"? | Day 8 |
| 4 | Any other brands or companies to list at launch | Day 8 |
| 5 | Real figures for the stats band, or confirmation it stays hidden | Day 21 |
| 6 | Keep or drop the "Web Design" service (a card exists, no page behind it) | Day 21 |
| 7 | Written permission for the four named client testimonials and for any partner logos | Day 21 |
| 8 | Whether the company is 4 or 7 years old (the About page says both) | Day 21 |
| 9 | Which team members are real (several look like placeholders) | Day 21 |
| 10 | Vector source for the logo | Before launch |
| 11 | WordPress admin access, or answers to the 4 **[NEEDS ADMIN]** items | Day 21–22 |
| 12 | SMTP provider and credentials | Day 14 |
| 13 | A GA4 property and Search Console access | Day 28 |
| 14 | VPS SSH access for the capacity and port audit in plan section 9 | Day 26 |

## Recommended next step

**Day 6 — build the About, Contact and service listing pages.** Nothing in Day 6
or Day 7 depends on an open question, so Week 2 can start immediately. Day 8 is
the first day that needs answers, so items 1–4 above should be settled within
the next two working days.

One schedule note: the plan budgets Day 21 for "migrate approved copy… review
placeholder or outdated material". Given 18 content-quality defects, two of them
wrong-content-on-the-wrong-page, **one day is optimistic**. Either start the
copy rewrite in parallel now, or expect Day 21 to run over.
