# Day 2 — Sitemap, Content Types and Design System

Decisions here are the contract for Weeks 2–4. Everything is derived from the project plan plus the Day 1 audit.

---

## 1. Site map and URL scheme

Canonical host: **`https://www.deetechgroup.com`** (keep `www`; the apex already 301s to it).
No `/index.php/` prefix. No trailing slashes. Lowercase kebab-case slugs.

```
/                                    Home
/about                               About the group
/services                            Service index
/services/[slug]                     Service detail      (CMS: services)
/brands                              Brands & companies directory
/brands/[slug]                       Brand profile       (CMS: brands)  - AnPreD lives here
/products                            Product index
/products/[slug]                     Product detail      (CMS: products)
/blog                                Blog listing, paginated
/blog/[slug]                         Article             (CMS: blog_posts)
/contact                             Contact + enquiry form
/[slug]                              Generic CMS page    (CMS: pages) - privacy, terms, etc.

/sitemap.xml                         Generated from published content
/robots.txt                          Generated
/blog/rss.xml                        Blog feed (replaces the WordPress /feed/)

/admin/login                         Admin sign-in
/admin                               Dashboard
/admin/pages | services | brands | products | blog | media | enquiries
```

### Slug decisions

| Legacy | New | Reason |
|---|---|---|
| `contact-us` | `contact` | Shorter, conventional |
| `network-service` | `network-services` | Consistent pluralisation (CQ-14) |
| `email-service` | `email-services` | Consistent pluralisation (CQ-14) |
| `web-development`, `web-hosting`, `managed-it-services` | unchanged, nested under `/services/` | |

The generic `/[slug]` catch-all is matched **last** so it can never shadow `/about`, `/services`, `/brands`, `/products`, `/blog` or `/contact`. Those six words plus `admin`, `api`, `sitemap.xml` and `robots.txt` are a **reserved-slug list** enforced in the admin UI and again in the API on write.

### Primary navigation

`Services` (dropdown with the 5 services + "All services") · `Brands` · `Products` · `About` · `Blog` · `Contact` + a **Get a quote** button.

### Footer

Four columns: company blurb + logo · Services · Company (About, Brands, Products, Blog, Contact) · Get in touch (phone, email, both addresses). Bottom bar: copyright, Privacy, Terms.

## 2. Content types

The plan's data model, with the field-level decisions needed to build against it.

### `pages`

`id, title, slug, body, status, seo_title, seo_description, published_at, created_at, updated_at`

Generic CMS pages. `status` is `draft | published`. `slug` is unique and validated against the reserved list. Body is Markdown (rendered server-side, sanitised).

### `services`

`id, title, slug, summary, description, image_url, icon, status, sort_order, seo_title, seo_description, timestamps`

Every service page on the legacy site shares the same shape, so the detail template is fixed rather than free-form:

1. Hero — title + `summary`
2. Intro paragraph
3. "Why choose DeeTech Group for X" — 3 benefit cards
4. "What's included" — bullet list
5. CTA band

`description` is Markdown; benefits and inclusions are expressed as headings and lists inside it. `summary` is the one-liner used on cards, the services index and `/`. **`summary` must be unique per service** — that is the direct fix for CQ-3.

Launch set (5): Web Development, Managed IT Services, Network Services, Email Services, Web Hosting.
"Web Design" appears as a sixth card on the legacy homepage but has no page behind it. **Decide at Day 21:** either write a real Web Design service or drop the card.

### `brands`

`id, name, slug, relationship_type, tagline, description, logo_url, website_url, status, sort_order, seo_*, timestamps`

`relationship_type` is a constrained enum, not free text, so the legal wording in the plan is enforced in one place:

```
product_brand       -> "A product brand by DeeTech Group"
division            -> "A division of DeeTech Group"
subsidiary          -> "A subsidiary of DeeTech Group"
partner             -> "A DeeTech Group partner"
portfolio_company   -> "Part of the DeeTech Group portfolio"
```

The display string is derived from the enum in one shared helper. Nothing hardcodes "subsidiary" in a template. **`subsidiary` is not to be selected until the ownership structure is confirmed in writing.**

### `products`

`id, brand_id, name, slug, summary, description, website_url, documentation_url, download_url, status, sort_order, seo_*, timestamps`

`brand_id` is a nullable FK to `brands` — a product can belong to the group directly. `status` covers publication (`draft | published`); a separate `lifecycle` field (`available | beta | coming_soon`) covers the "status" the plan's site map asks for, because overloading one column for both would be a mistake.

### `blog_posts`

`id, title, slug, excerpt, body, author_id, featured_image, status, published_at, seo_*, timestamps`

Flat category via `category` (nullable) for now; no tag table in the MVP. One real seed article; `hello-world` is not migrated.

### `media`

`id, file_name, storage_path, mime_type, size_bytes, width, height, alt_text, created_at`

`alt_text` is **required on upload** — the direct fix for SEO-4, where all 53 legacy items had none.

### `contact_enquiries`

`id, name, email, company, phone, subject, message, source_page, status, ip_hash, created_at`

`status` is `new | read | replied | spam`. `ip_hash` (hashed, not raw) supports rate limiting without storing a bare IP.

### `admin_users`

`id, email, password_hash, name, role, is_active, last_login_at, timestamps` — `role` is `admin | editor`.

### Shared conventions

- Every public-facing table has `status` and the public API returns **only `published`** rows.
- Every slug is unique within its table, lowercase, `^[a-z0-9]+(-[a-z0-9]+)*$`.
- `seo_title` and `seo_description` exist on every public type; when empty, the frontend falls back to `title` and `summary`/`excerpt`. This is the fix for SEO-2 and SEO-8.
- Timestamps are `timestamptz`, UTC.

## 3. Design system

### Brand colours

> **Revised 2026-10-11.** This section originally derived the palette from
> `Dtg-logo-new.png`, the blue-and-green wordmark on the live site. The owner
> then supplied the actual brand mark (`assets/brand/Deetech-logo.png`), a
> cyan/magenta/yellow Penrose triangle, and the palette was re-derived from it.

Sampled from the brand mark and from the Elementor stylesheets in use:

| Source | Value |
|---|---|
| Logo cyan ("Dee" ribbon) | `#01B5F0` |
| Logo magenta ("Tech" ribbon) | `#ED3C96` |
| Logo yellow ("Group" ribbon) | `#FFC50A` |
| Elementor kit primary | `#121242` |
| Dominant page navy (37 uses) | `#242F65` |
| Body text grey (19 uses) | `#767B92` |
| Legacy CTA coral | `#EA5356` and `#FF5151` |

All three logo colours are too light to carry text on white:

| Colour | Contrast on white | Verdict |
|---|---|---|
| Cyan `#01B5F0` | 2.37:1 | Mark only; darken to `#007DB3` (4.58:1) to use |
| Magenta `#ED3C96` | 3.69:1 | Mark only; darken to `#C21A79` (5.65:1) to use |
| Yellow `#FFC50A` | 1.59:1 | **Mark only.** There is no accessible way to use it for text, a button or an icon on a light background, so it is deliberately not a UI token |

**Resolution.** Navy `#242F65` stays the ink and the dark-section background —
it is the quiet counterweight the saturated mark needs. The primary action
colour is the logo cyan darkened to **`#007DB3`** (`brand-700`). Magenta
darkened to **`#C21A79`** (`accent-700`) is the single accent, reserved for the
most important call to action on a page. Coral is kept only as the semantic
`danger` colour. Yellow lives in the mark.

### Tokens

Defined once in `apps/web/src/app/globals.css` as a Tailwind v4 `@theme` block. No component hardcodes a hex value.

```
Brand
  --color-brand-50 … 950      cyan ramp anchored on the logo's #01B5F0 (= brand-500)
                              brand-700 #007DB3 is the lightest step that carries
                              white text; brand-800 #01648F for text on white
  --color-navy-50 … 950       navy ramp around #242F65 (800 is the base)
  --color-accent-400 … 800    magenta ramp anchored on the logo's #ED3C96 (= accent-500)
                              accent-700 #C21A79 is the text/button-safe step
Neutral
  --color-ink                 #121226  headings                       18.4:1
  --color-body                #4A4F63  body copy                       8.1:1
  --color-muted               #6A6E83  metadata                        5.0:1
  --color-surface             #FFFFFF
  --color-surface-subtle      #F6F8FB
  --color-border              #E3E8F0
Semantic
  --color-success / --color-warning / --color-danger (#EA5356) / --color-info
```

Both neutrals are darkened from the legacy site's `#767B92`, which is 4.18:1 on
white and fails AA for normal text at any size.

**The contrast rule that follows from this palette:** the two light steps of
each brand ramp (`brand-500`/`600`, `accent-500`/`600`) are decoration — fills,
gradients, borders, hover washes. Anything carrying text uses `-700` or darker.
Verified in the browser: primary button white-on-`brand-700` 4.58:1, eyebrow
`brand-800` on `surface-subtle` 6.13:1, "Learn more" `brand-800` on white
6.52:1, nav links navy-800 on white 12.58:1.

### Logo usage

The mark is square (555x533 after trimming) and the words "Dee", "Tech" and
"Group" written along its ribbons are illegible below roughly 120px. The header
and footer therefore pair the mark with a **typeset wordmark** ("DeeTech Group"
+ "Make IT Possible") rather than relying on the artwork to carry the name.
`Logo` takes a `tone` prop: `light` for dark text on light backgrounds, `dark`
for white text on navy. The mark itself needs no inversion or background chip —
it is transparent and carries no dark ink.

Source artwork and the icon generator live in `assets/brand/`. Running
`python assets/brand/build-icons.py` regenerates the trimmed mark plus the
favicon set (`icon.png` 512, `apple-icon.png` 180 flattened onto white, and a
16/32/48 `favicon.ico`). The artwork is **raster only** — a vector source is
still outstanding.

### Typography

The legacy site loads Merriweather, Roboto, Roboto Slab, Lato **and** Poppins — five families, four of them unused by the rendered design. That is pure page weight.

**Decision: two families, self-hosted via `next/font`.**

- **Headings + UI:** Inter (variable). Clean, neutral, excellent at small sizes, widely available.
- **Body:** Inter as well, at a larger size and looser leading.
- **Mono:** system mono stack, for code in blog articles only.

No webfont CSS from Google's CDN at runtime; `next/font` inlines and self-hosts, which removes a third-party render-blocking request and the privacy question that comes with it.

Scale (fluid, `clamp()`):

```
display  clamp(2.5rem, 1.6rem + 3.6vw, 4rem)      /  1.05 leading, -0.02em tracking
h1       clamp(2rem,   1.5rem + 2.1vw, 3rem)      /  1.12
h2       clamp(1.625rem, 1.35rem + 1.2vw, 2.25rem)/  1.2
h3       clamp(1.25rem, 1.15rem + 0.45vw, 1.5rem) /  1.3
body-lg  1.125rem / 1.7
body     1rem / 1.7
small    0.875rem / 1.55
```

### Spacing, radius, shadow

- Spacing: Tailwind's default 4px scale. Section vertical rhythm is `py-16 md:py-24 lg:py-28`.
- Container: `max-w-7xl` (1280px) with `px-4 sm:px-6 lg:px-8`. Prose columns cap at `max-w-prose`.
- Radius: `--radius-sm 6px`, `--radius 10px`, `--radius-lg 16px`, `--radius-full 9999px`.
- Shadow: three steps only (`card`, `card-hover`, `overlay`). Soft and navy-tinted, not black.

### Breakpoints

Tailwind defaults: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. **Mobile-first**; every component is authored at 375px and widened. Review widths: **375, 768, 1280**.

### Component inventory (built Day 4–5)

`Container` · `Section` · `Button` (primary / secondary / ghost / link; sm / md / lg; renders as `<a>` or `<button>`) · `Header` with mobile drawer and Services dropdown · `Footer` · `Logo` · `SectionHeading` (eyebrow + title + lead) · `Card` · `ServiceCard` · `StatTile` · `TestimonialCard` · `CTABand` · `Prose`.

### Accessibility rules (binding, checked on Day 24)

1. One `<h1>` per page; heading levels never skip.
2. Visible focus ring on every interactive element (`focus-visible:ring-2 ring-brand-500 ring-offset-2`).
3. Tap targets at least 44x44 CSS px.
4. Every image has meaningful `alt`, or `alt=""` if decorative. Enforced at upload (`media.alt_text` required).
5. Colour is never the only carrier of meaning.
6. The mobile drawer traps focus, closes on `Escape`, and restores focus to its trigger.
7. "Skip to content" link as the first focusable element.
8. `prefers-reduced-motion` disables all non-essential animation.

## 4. Design references

The rebuild follows the legacy site's **information architecture** (hero, services grid, about band, stats, work, testimonials, CTA) because it is a reasonable B2B structure — but not its visual execution. Specifically dropped:

- The MyStickyElements floating widget stack — replaced by one unobtrusive WhatsApp/contact link in the header and footer.
- Decorative Elementor confetti (`dots-1.png`, `big-circle.png`, `memphis.png`, `art-1/2.png`) — replaced by CSS gradients and a single subtle pattern, saving ~15 image requests.
- The "Our work" portfolio grid — **hidden at launch** until real case studies exist (CQ-4). It is a template, not a deleted feature; it returns when there is content.
- The animated 0+ counters — **hidden at launch** until real figures are supplied (CQ-5).

## 5. Open decisions blocking later weeks

| # | Decision | Needed by |
|---|---|---|
| 1 | AnPreD and InfraShield: names, descriptions, logos, URLs, lifecycle status | Day 8 |
| 2 | The legal `relationship_type` for AnPreD | Day 8 |
| 3 | Real figures for the stats band, or confirm it stays hidden | Day 21 |
| 4 | Keep or drop the "Web Design" service | Day 21 |
| 5 | Written permission for the four named testimonials and any partner logos | Day 21 |
| 6 | SMTP provider and credentials for enquiry notifications | Day 14 |
| 7 | GA4 property (or chosen alternative) + Search Console access | Day 28 |
