import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { API_PREFIX, buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { makeDatabaseCheck } from "../src/db/pool.js";
import { startTestDatabase, type TestDatabase } from "./helpers/database.js";

let db: TestDatabase;
let app: Express;

const config = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  SESSION_SECRET: "test-secret-that-is-long-enough-for-the-schema",
});

beforeAll(async () => {
  db = await startTestDatabase(55602);
  app = buildApp({
    config,
    pool: db.pool,
    checkDatabase: makeDatabaseCheck(db.pool),
  });
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
  await db.applySeeds();
});

describe("GET /health with a real database", () => {
  it("reports the database as ok once it is actually reachable", async () => {
    const res = await request(app).get(`${API_PREFIX}/health`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.checks.database).toBe("ok");
  });
});

describe("GET /services", () => {
  it("returns the five seeded services in sort order", async () => {
    const res = await request(app).get(`${API_PREFIX}/services`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.items.map((s: { slug: string }) => s.slug)).toEqual([
      "web-development",
      "managed-it-services",
      "network-services",
      "email-services",
      "web-hosting",
    ]);
  });

  it("maps snake_case columns to the shared camelCase contract", async () => {
    const res = await request(app).get(`${API_PREFIX}/services`);
    const service = res.body.items[0];

    expect(service).toMatchObject({
      slug: "web-development",
      sortOrder: 1,
      status: "published",
    });
    expect(service.seoTitle).toBe("Web Development Services");
    expect(Array.isArray(service.benefits)).toBe(true);
    expect(service.benefits[0]).toHaveProperty("title");
    expect(service.benefits[0]).toHaveProperty("body");
    // No snake_case keys leak through.
    expect(Object.keys(service).some((k) => k.includes("_"))).toBe(false);
  });

  it("sets a cacheable Cache-Control header", async () => {
    const res = await request(app).get(`${API_PREFIX}/services`);
    expect(res.headers["cache-control"]).toContain("s-maxage");
  });

  it("never returns a draft", async () => {
    await db.pool.query(
      `INSERT INTO services (title, slug, summary, status)
       VALUES ('Secret', 'secret-service', 'Not for the public', 'draft')`,
    );

    const list = await request(app).get(`${API_PREFIX}/services`);
    expect(
      list.body.items.some((s: { slug: string }) => s.slug === "secret-service"),
    ).toBe(false);

    const detail = await request(app).get(`${API_PREFIX}/services/secret-service`);
    expect(detail.status).toBe(404);
  });
});

describe("GET /services/:slug", () => {
  it("returns the service", async () => {
    const res = await request(app).get(`${API_PREFIX}/services/web-hosting`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Web Hosting");
    expect(res.body.inclusions.length).toBeGreaterThan(0);
  });

  it("404s for an unknown slug", async () => {
    const res = await request(app).get(`${API_PREFIX}/services/nope`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("400s for a malformed slug rather than querying with it", async () => {
    const res = await request(app).get(`${API_PREFIX}/services/Not%20A%20Slug`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("is not injectable through the slug parameter", async () => {
    const res = await request(app).get(
      `${API_PREFIX}/services/${encodeURIComponent("x' OR '1'='1")}`,
    );
    expect(res.status).toBe(400);

    // And the table is still there.
    const after = await request(app).get(`${API_PREFIX}/services`);
    expect(after.body.items).toHaveLength(5);
  });
});

describe("GET /brands and /products", () => {
  it("return empty lists when nothing is published", async () => {
    const brands = await request(app).get(`${API_PREFIX}/brands`);
    const products = await request(app).get(`${API_PREFIX}/products`);

    expect(brands.status).toBe(200);
    expect(brands.body.items).toEqual([]);
    expect(products.status).toBe(200);
    expect(products.body.items).toEqual([]);
  });

  it("return a published brand with its products", async () => {
    const { rows } = await db.pool.query<{ id: number }>(
      // `brands` has no published_at: only pages and blog_posts carry a
      // publication date, because only those two are dated content.
      `INSERT INTO brands (name, slug, relationship_type, description, status)
       VALUES ('TestBrand','test-brand','product_brand','A test brand','published')
       RETURNING id`,
    );
    const brandId = rows[0]!.id;
    await db.pool.query(
      `INSERT INTO products (brand_id, name, slug, summary, lifecycle, status)
       VALUES ($1,'TestProduct','test-product','A test product','beta','published')`,
      [brandId],
    );

    const brand = await request(app).get(`${API_PREFIX}/brands/test-brand`);
    expect(brand.status).toBe(200);
    expect(brand.body.relationshipType).toBe("product_brand");

    const filtered = await request(app).get(
      `${API_PREFIX}/products?brandId=${brandId}`,
    );
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({
      slug: "test-product",
      lifecycle: "beta",
      brandId,
    });
  });

  it("rejects a non-numeric brandId", async () => {
    const res = await request(app).get(`${API_PREFIX}/products?brandId=abc`);
    expect(res.status).toBe(400);
  });
});

describe("GET /blog", () => {
  it("returns the seeded article with pagination metadata", async () => {
    const res = await request(app).get(`${API_PREFIX}/blog`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, total: 1, totalPages: 1 });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe("shared-cloud-or-dedicated-hosting");
  });

  it("paginates, newest first", async () => {
    for (let i = 0; i < 12; i++) {
      await db.pool.query(
        `INSERT INTO blog_posts (title, slug, excerpt, status, published_at)
         VALUES ($1, $2, 'E', 'published', now() - ($3 || ' days')::interval)`,
        [`Post ${i}`, `post-${i}`, String(i + 1)],
      );
    }

    const first = await request(app).get(`${API_PREFIX}/blog?perPage=5`);
    expect(first.body.items).toHaveLength(5);
    expect(first.body.total).toBe(13);
    expect(first.body.totalPages).toBe(3);
    // The seeded article is dated today, so it sorts first.
    expect(first.body.items[0].slug).toBe("shared-cloud-or-dedicated-hosting");

    const last = await request(app).get(`${API_PREFIX}/blog?perPage=5&page=3`);
    expect(last.body.items).toHaveLength(3);
    expect(last.body.page).toBe(3);

    // No row appears on two pages.
    const slugs = [...first.body.items, ...last.body.items].map(
      (p: { slug: string }) => p.slug,
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("caps perPage rather than letting a caller ask for everything", async () => {
    const res = await request(app).get(`${API_PREFIX}/blog?perPage=5000`);
    expect(res.status).toBe(400);
  });

  it("rejects a negative page", async () => {
    const res = await request(app).get(`${API_PREFIX}/blog?page=-1`);
    expect(res.status).toBe(400);
  });

  it("excludes drafts and posts with no publication date", async () => {
    await db.pool.query(
      `INSERT INTO blog_posts (title, slug, status) VALUES ('Draft','draft-post','draft')`,
    );

    const res = await request(app).get(`${API_PREFIX}/blog`);
    expect(res.body.total).toBe(1);

    const detail = await request(app).get(`${API_PREFIX}/blog/draft-post`);
    expect(detail.status).toBe(404);
  });
});

describe("GET /blog/all", () => {
  it("returns every published post unpaginated, for the sitemap and feed", async () => {
    const res = await request(app).get(`${API_PREFIX}/blog/all`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("is not shadowed by the :slug route", async () => {
    // `/blog/all` must hit the list route, not be read as a slug lookup.
    const res = await request(app).get(`${API_PREFIX}/blog/all`);
    expect(res.body).toHaveProperty("items");
  });
});

describe("GET /pages/:slug", () => {
  it("returns a published page", async () => {
    await db.pool.query(
      `INSERT INTO pages (title, slug, body, status, published_at)
       VALUES ('Privacy policy','privacy-policy','Body text','published', now())`,
    );
    const res = await request(app).get(`${API_PREFIX}/pages/privacy-policy`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Privacy policy");
  });

  it("404s for a draft page", async () => {
    await db.pool.query(`INSERT INTO pages (title, slug) VALUES ('Terms','terms')`);
    const res = await request(app).get(`${API_PREFIX}/pages/terms`);
    expect(res.status).toBe(404);
  });
});
