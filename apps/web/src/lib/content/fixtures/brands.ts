/**
 * Brands and products live in the database and are served by
 * `GET /api/v1/brands` and `GET /api/v1/products`.
 *
 * AnPreD and its InfraShield platform were seeded on 2026-10-11 from
 * https://anpred.com/ — see `database/seeds/003_brands_and_products.sql`,
 * which records where each claim came from and why `relationship_type` is
 * `product_brand` rather than `subsidiary`.
 *
 * To add another brand, either add it to that seed file or use the admin CMS
 * once Week 4 lands; the CMS validates the relationship type and the slug.
 */

export {};
