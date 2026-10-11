import type { Brand, Product } from "@deetech/shared-types";

/**
 * BOTH ARRAYS ARE EMPTY ON PURPOSE.
 *
 * Neither "AnPreD" nor "InfraShield" appears anywhere on the current
 * WordPress site — not in page content, post content, media filenames or
 * generated CSS (docs/01-wordpress-audit.md, section 6). There is no source
 * for their names, positioning, logos, URLs or lifecycle status.
 *
 * More importantly, `relationshipType` is a factual claim about company
 * structure. The plan is explicit that "subsidiary company" may only be used
 * if the ownership and legal structure support it. Guessing it would put a
 * false statement about the business on a public page, so nothing is guessed
 * here.
 *
 * The /brands and /products routes and their detail templates are fully
 * built and render an honest empty state while these are empty. To launch
 * them, fill in the rows below — no template work is outstanding.
 *
 * Needed from the owner (Day 8 of the plan):
 *   1. AnPreD      — name, tagline, description, logo, website, docs URL
 *   2. InfraShield — the same, plus how it relates to AnPreD
 *   3. The correct `relationshipType` for each, from the five allowed values
 *      in @deetech/shared-types (product_brand | division | subsidiary |
 *      partner | portfolio_company)
 *   4. Any other brands or companies to list at launch
 */

export const brands: Brand[] = [];

export const products: Product[] = [];
