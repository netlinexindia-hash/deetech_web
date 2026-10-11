# Day 1 — WordPress Content & SEO Audit

**Site audited:** https://www.deetechgroup.com/
**Audit date:** 2026-10-11
**Method:** Public HTTP + WordPress REST API (`/index.php/wp-json/wp/v2/*`), Yoast `yoast_head_json`, Elementor generated CSS. No admin access was used; items that need admin confirmation are flagged **[NEEDS ADMIN]**.

Raw extracted page copy is checked in under [`docs/audit/legacy-copy/`](audit/legacy-copy) for the Day 21 content migration.

---

## 1. Platform inventory

| Item | Finding |
|---|---|
| Web server | nginx/1.26.3 |
| Runtime | PHP 8.3.33 (`X-Powered-By` header is exposed) |
| Theme | Astra 4.4.0 |
| Page builder | Elementor 4.2.4 |
| Builder add-ons | ElementsKit Lite 4.0.5, Sina Extension for Elementor, MyStickyElements 2.3.9 |
| SEO plugin | Yoast SEO |
| Permalink structure | **`/index.php/%postname%/`** — the `index.php` prefix is present on every URL |
| Analytics / tag manager | **None detected** (no GA4, GTM, Clarity or Meta pixel in the homepage HTML) |
| Contact form | Sina Extension Elementor form (`sina-form`, nonce-protected admin-ajax POST) |
| Homepage HTML weight | 235 KB (uncompressed) |
| TTFB (single sample, from dev machine) | ~0.31 s |

**[NEEDS ADMIN]** Confirm the WordPress core version, the full active-plugin list, whether Sina form submissions are stored in the database or only emailed, and the SMTP configuration currently used for form notifications.

## 2. Content inventory

Totals from the REST API: **9 pages, 1 post, 1 category, 0 tags, 1 author, 53 media items.**

### Pages

| ID | Slug | Title | Live URL | Modified | Extracted copy |
|---|---|---|---|---|---|
| 22 | `home-2` | Home | `/` | 2024-01-09 | 3,778 chars |
| 431 | `about` | About | `/index.php/about/` | 2024-01-28 | 7,419 chars |
| 329 | `contact-us` | Contact us | `/index.php/contact-us/` | 2024-01-28 | 401 chars |
| 198 | `web-development` | Web Development | `/index.php/web-development/` | 2024-01-28 | 2,265 chars |
| 294 | `managed-it-services` | Managed IT Services | `/index.php/managed-it-services/` | 2024-01-28 | 2,182 chars |
| 301 | `network-service` | Network Service | `/index.php/network-service/` | 2024-01-28 | 2,204 chars |
| 311 | `email-service` | Email Service | `/index.php/email-service/` | 2024-01-28 | 1,945 chars |
| 322 | `web-hosting` | Web Hosting | `/index.php/web-hosting/` | 2024-01-28 | 2,300 chars |
| 829 | `blog` | Blog | `/index.php/blog/` | 2023-11-13 | 586 chars |

No parent/child nesting; all pages are top level. Nothing has been edited since **28 January 2024**.

### Posts

| ID | Slug | Title | URL | Category |
|---|---|---|---|---|
| 1 | `hello-world` | "What is Lorem Ipsum?" | `/index.php/2023/10/26/hello-world/` | Uncategorized |

The single post is the WordPress default `hello-world` post with placeholder body text. **There is no real blog content to migrate.**

### Taxonomy & authors

- Categories: 1 (`uncategorized`) — no real taxonomy to preserve.
- Tags: 0.
- Authors: 1 (`myzeontech`, exposed at `/index.php/author/myzeontech/`).

### Media

53 items: 31 PNG, 14 WebP, 8 JPEG. Mostly Elementor theme decoration (`dots-1.png`, `big-circle.png`, `hero-bg.png`, `brand-1..7.png`, `memphis.png`) plus stock photography (`istockphoto-*`, `photo-15193899…`) and five logo variants.

**Every one of the 53 media items has an empty `alt_text`.**

Logo files found:

- `2024/01/Dtg-logo-new-e1705844072500.png` — the blue-and-green wordmark rendered in the live site's header.
- `2023/10/Dtg-logo-new.png`, `2023/10/DTG-logo.png`, `2023/10/Deetech-logo.png`, `2023/10/logoo-PhotoRoom.png-PhotoRoom.png` — duplicate and alternate variants.

> **Correction, 2026-10-11.** This section first called the magenta/cyan/yellow
> `DTG-logo.png` "retired" because the wordmark was the one actually rendered on
> the live site. That was wrong. The owner has confirmed the **Penrose-triangle
> mark is the current brand**, and supplied it as
> [`assets/brand/Deetech-logo.png`](../assets/brand/Deetech-logo.png) (661x606)
> with a favicon. The blue-and-green wordmark is the stale asset. The live site
> is still showing it — one more item for the Day 21 content pass.
>
> The brand palette is therefore cyan `#01B5F0`, magenta `#ED3C96`, yellow
> `#FFC50A`, not the blue/green the design system was first built on. See the
> revised "Brand colours" section of
> [`docs/02-sitemap-and-design-system.md`](02-sitemap-and-design-system.md).

**[NEEDS ADMIN]** Obtain vector (SVG/AI) source for the mark; every copy supplied so far is raster.

## 3. Complete URL inventory

Verified live status codes (2026-10-11):

| URL | Status | Note |
|---|---|---|
| `https://www.deetechgroup.com/` | 200 | Homepage |
| `/index.php/home-2/` | 301 to `/` | Already redirecting |
| `/index.php/about/` | 200 | |
| `/index.php/contact-us/` | 200 | |
| `/index.php/web-development/` | 200 | |
| `/index.php/managed-it-services/` | 200 | |
| `/index.php/network-service/` | 200 | |
| `/index.php/email-service/` | 200 | |
| `/index.php/web-hosting/` | 200 | |
| `/index.php/blog/` | 200 | |
| `/index.php/2023/10/26/hello-world/` | 200 | Placeholder post |
| `/index.php/category/uncategorized/` | 200 | No real content |
| `/index.php/author/myzeontech/` | 200 | Should not be indexed |
| `/index.php/feed/`, `/index.php/comments/feed/` | 200 | RSS |
| `/about/` (without `index.php`) | **404** | Clean paths do **not** resolve today |
| `/index.php/sitemap_index.xml` | **404** | See defect SEO-1 |
| `/wp-admin/` | 302 to `wp-login.php` | |

Host-level redirects already in place and working:

- `http://deetechgroup.com/` to `https://deetechgroup.com/`
- `https://deetechgroup.com/` to `https://www.deetechgroup.com/`

**Canonical host is `https://www.deetechgroup.com`.** Keep it; changing host and paths at the same time doubles migration risk.

The machine-readable old-to-new URL map is maintained in [`docs/redirects.csv`](redirects.csv) and is the input for Day 22.

## 4. SEO findings

| ID | Severity | Finding |
|---|---|---|
| SEO-1 | **High** | `robots.txt` advertises `http://www.deetechgroup.com/index.php/sitemap_index.xml`, which returns **404**. The site currently has **no working XML sitemap**. The URL is also `http://`, not `https://`. |
| SEO-2 | **High** | **No meta description on any page or post.** Every `yoast_head_json.description` is null; search engines are generating snippets unaided. |
| SEO-3 | **High** | The `/index.php/` prefix pollutes every URL. It adds no value, looks broken to users, and is an easy win to drop — but it means **every URL except `/` changes** in the rebuild. A complete 301 map is mandatory. |
| SEO-4 | Medium | All 53 media items have empty alt text — an accessibility failure and lost image-search signal. |
| SEO-5 | Medium | Mixed content: the HTTPS homepage references assets over `http://www.deetechgroup.com/...` (e.g. `About1.webp`, `big-circle.png`, `banner.webp`), including inside CSS `background-image` values. |
| SEO-6 | Medium | Open Graph images are served over `http://`, and the Blog page's `og:image` points at a **dead host**: `http://myzeontech.deetechgroup.com/wp-content/uploads/2023/10/hero-bg.png`. |
| SEO-7 | Medium | No analytics or Search Console tag is installed, so there is **no historical traffic baseline** and no conversion tracking. Install GA4 (or equivalent) on the new site from day one. |
| SEO-8 | Low | SEO titles are all `{Page} - DeeTechGroup` with no differentiation or keywords. |
| SEO-9 | Low | The author archive `/index.php/author/myzeontech/` is indexable and carries the old brand name in the URL. Add `noindex` or disable author archives. |
| SEO-10 | Low | Blog page lists the same placeholder post three times — it is a static Elementor mock-up, not a real post loop. |

Because there is **no sitemap, no analytics and essentially no blog content**, the usual "preserve link equity" risk is much lower than a typical WordPress migration. The 9 page URLs are what matter.

## 5. Content-quality findings (input for Day 21)

| ID | Severity | Finding |
|---|---|---|
| CQ-1 | **High** | **Stale brand name "MyZeon Tech" is still in the live copy.** Found in the About page body (twice: "MyZeon Tech Company prides itself…" and "MyZeon Tech Company remains steadfast…"), in a homepage testimonial, and in the author slug `myzeontech`. |
| CQ-2 | **High** | Lorem-style filler copy is live on the homepage: *"Am fined rejoiced drawings so he elegance. Set lose dear upon had two its what seen…"* under "Professional quality delivered!". |
| CQ-3 | **High** | All six homepage service cards share one identical description: *"Our web development team has the expertise and experience to turn your digital dreams into reality."* |
| CQ-4 | **High** | All six "Our work" portfolio items share one identical "Short Description" about web development. There is **no real portfolio content**. |
| CQ-5 | **High** | Counters read "0 + Successful Projects / 0 + Quality Customers / 0 + Trusted Partners" — they animate from 0 but the live HTML ships `0`. **[NEEDS ADMIN]** Supply real figures or drop the section. |
| CQ-6 | Medium | Company age is contradictory: About says *"a journey spanning over seven years"* in one paragraph and *"Over the past 4 years"* in the next. |
| CQ-7 | Medium | "Our Vission" is misspelled (should be "Vision") and appears twice; the sentence is truncated mid-word: *"…through innovatio"*. |
| CQ-8 | Medium | About page repeats the identical 70-word "We are committed to providing top-notch…" paragraph under both Mission and Vision. |
| CQ-9 | Medium | Team section mixes real and placeholder people: "Manoj Kumar — System Engineer" looks real; "Jhin — Seo Expert", "Jhan Stalker — Graphic Designer" and "AK — Adminstrator" (described in the body as "Sam Smith") do not. Note the "Adminstrator" typo. |
| CQ-10 | Medium | About counters list "Quality Customers" twice (four tiles, three labels). |
| CQ-11 | Low | Homepage testimonials are attributed to "Sam smith" and "Kimberly Garcia" — generic stock names, unlike the About page testimonials which name real-looking clients. |
| CQ-12 | Low | Web Development page CTA is a broken sentence: *"Dee Tech Group to discuss their web development needs, encouraging them to take action…"* — editor instructions left in the copy. |
| CQ-13 | Low | Partner logo strip uses generic `brand-1..7.png` placeholders. **[NEEDS ADMIN]** Supply real partner logos and written permission to display them, or remove the section. |
| CQ-14 | Low | Service naming is inconsistent: "Network Service" / "Email service" (singular, lowercase s) vs "Managed IT Services". |
| CQ-15 | **High** | The **Managed IT Services** page's inclusions list is headed *"Our Web Development Services Include:"* and lists web-development items (custom website development, e-commerce, responsive design, website maintenance). The wrong content was pasted into the page. |
| CQ-16 | **High** | "MyZeon Tech" also appears in the opening paragraph of the **Managed IT Services** page (*"That's where MyZeon Tech comes in…"*) and the **Network Services** page (*"MyZeon Tech offers comprehensive Network Services…"*). This widens CQ-1 beyond the About page. |
| CQ-17 | Medium | The "Why choose us" benefit blocks are copy-pasted across services. **Network Services** and **Web Hosting** both carry the web-development text *"Our team of web developers boasts a wealth of experience…"* under headings that read "Expertise" and "Reliability" respectively. |
| CQ-18 | Low | Heading inconsistency between service pages: Web Hosting says "Why Choose DeeTech Group for…" while the others say "Why Choose Dee Tech Group for…" — the company name is spelled two ways. |

### Content that is real and worth keeping

- **Contact details** (verified on the live Contact page):
  - Phone: `+91-8630010632` (also used by the WhatsApp sticky widget)
  - Email: `support@deetechgroup.com`
  - Office: A-47, A Block, Sector 2, Noida, Uttar Pradesh 201301
  - Registered: H.N. 1, Siau, Chandpur, Bijnor, Uttar Pradesh 246725
- **Named testimonials on the About page** — Raj Kumar (CEO, Fast Track Money Service Pvt. Ltd.), Abhinav Chalana (MD, Skyline Construction and Advisers), Anil Maurya (MD, Loan4wish), Krishan Kumar (MD, Myzeon Venture Pvt. Ltd.). **[NEEDS ADMIN]** Confirm each is genuine and that permission to publish is on file.
- **Service body copy** — the five service pages have usable, non-placeholder descriptions (benefits, inclusions lists, CTAs). These are the strongest existing assets and should be migrated with light editing.
- **Mission / history narrative** on About — usable once the year count and brand name are corrected.

## 6. Gaps against the project plan

The plan requires a Brands/Companies directory, an AnPreD profile and a Products section.

> **Neither "AnPreD" nor "InfraShield" appears anywhere on the current website.** Searching all page content, post content, media filenames and generated CSS returned zero matches.

All brand and product content must therefore be **authored from scratch**, not migrated. **[NEEDS ADMIN]** Before Week 2 Day 8–9 the following are needed:

1. AnPreD — full name, one-line positioning, description, logo, website URL, documentation URL, current status.
2. InfraShield — same, plus its relationship to AnPreD (product of AnPreD? sibling brand?).
3. The **legal relationship wording**. The plan is explicit: use "subsidiary company" only if ownership and legal structure support it. If DeeTech Group is a proprietorship and AnPreD is a product brand, the site must say "A product brand by DeeTech Group" or similar. Pick the wording now so it is applied consistently.
4. Any additional brands or companies to list at launch.

## 7. Security observations on the current site

Not blocking for the rebuild, but worth noting since the same VPS and nginx will host the new site:

- **No security headers at all** — no `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` or CSP. The new nginx config should set these (Day 26).
- `X-Powered-By: PHP/8.3.33` leaks the exact runtime version.
- `xmlrpc.php` is reachable (a standard brute-force and pingback-amplification target).
- `/wp-admin/` is publicly reachable with no IP restriction or rate limit visible.

## 8. Conclusions carried into Day 2 and beyond

1. **Migration risk is low.** Nine pages, one placeholder post, no sitemap, no analytics, no backlink-bearing archive. Dropping `/index.php/` is safe with a complete 301 map.
2. **Content is the critical path, not code.** Every service page needs an editing pass; the homepage, About team/counters/portfolio, and all brand & product content need the owner's input. This is the most likely source of schedule slip.
3. **Keep the `www` host.** Change paths only.
4. **Treat the five service pages as the content model** for the `services` table — they already share a consistent shape (intro, why choose us, inclusions list, CTA).
5. **Blog launches empty.** Build the templates, seed one real article, and do not migrate `hello-world`.
