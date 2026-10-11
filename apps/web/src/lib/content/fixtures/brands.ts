/**
 * Brands and products now live in the database and are served by
 * `GET /api/v1/brands` and `GET /api/v1/products`. There are no fixtures left
 * for them.
 *
 * BOTH TABLES ARE EMPTY. Neither "AnPreD" nor "InfraShield" appears anywhere
 * on the current WordPress site, so there is no source for their names,
 * positioning, logos or URLs (docs/01-wordpress-audit.md, section 6). More
 * importantly, `relationship_type` is a factual claim about company
 * structure, and the plan forbids "subsidiary" unless the ownership and legal
 * structure support it — so nothing was guessed.
 *
 * The /brands and /products routes and their detail templates are fully
 * built and render an honest empty state. To launch them, add rows:
 *
 *   INSERT INTO brands (name, slug, relationship_type, tagline, description,
 *                       logo_url, website_url, status, sort_order)
 *   VALUES ('AnPreD', 'anpred', '<one of: product_brand | division |
 *            subsidiary | partner | portfolio_company>',
 *           '<tagline>', '<description>', NULL, '<url>', 'published', 1);
 *
 * Better still, add them through the admin CMS once Week 4 lands, which
 * validates the relationship type and the slug for you.
 *
 * Needed from the owner (Day 8 of the plan, still outstanding):
 *   1. AnPreD      — name, tagline, description, logo, website, docs URL
 *   2. InfraShield — the same, plus how it relates to AnPreD
 *   3. The correct relationship_type for each
 *   4. Any other brands or companies to list at launch
 */

export {};
