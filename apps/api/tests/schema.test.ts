import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./helpers/database.js";

/**
 * Proves the schema enforces what the design says it enforces.
 *
 * These are the constraints that exist specifically to stop the defects found
 * in the Day 1 audit recurring, so they are worth a test each: if a future
 * migration drops one, that is a silent regression back to the legacy site's
 * behaviour.
 */

let db: TestDatabase;

beforeAll(async () => {
  db = await startTestDatabase(55601);
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
});

describe("slug domain", () => {
  it.each([
    ["Web-Development", "uppercase"],
    ["web development", "a space"],
    ["-web", "a leading hyphen"],
    ["web-", "a trailing hyphen"],
    ["web--dev", "a double hyphen"],
    ["", "empty"],
  ])("rejects %j (%s)", async (slug) => {
    await expect(
      db.pool.query(
        `INSERT INTO services (title, slug, summary) VALUES ('T', $1, 'S')`,
        [slug],
      ),
    ).rejects.toThrow();
  });

  it("accepts a well-formed slug", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO services (title, slug, summary) VALUES ('T', 'web-dev-2', 'S')`,
      ),
    ).resolves.toBeDefined();
  });
});

describe("publication state", () => {
  it("refuses a published page with no published_at", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO pages (title, slug, status) VALUES ('T', 'p', 'published')`,
      ),
    ).rejects.toThrow(/pages_published_has_date/);
  });

  it("allows a draft with no published_at", async () => {
    await expect(
      db.pool.query(`INSERT INTO pages (title, slug) VALUES ('T', 'p')`),
    ).resolves.toBeDefined();
  });

  it("refuses a status outside the allowed set", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO services (title, slug, summary, status) VALUES ('T','s','S','live')`,
      ),
    ).rejects.toThrow();
  });
});

describe("service summary uniqueness", () => {
  // The legacy homepage shipped one identical sentence on all six service
  // cards (CQ-3). This constraint is what makes that impossible.
  it("refuses two services with the same summary", async () => {
    await db.pool.query(
      `INSERT INTO services (title, slug, summary) VALUES ('A','a','Same line')`,
    );
    await expect(
      db.pool.query(
        `INSERT INTO services (title, slug, summary) VALUES ('B','b','Same line')`,
      ),
    ).rejects.toThrow(/services_summary_key/);
  });
});

describe("brand relationship_type", () => {
  it.each(["product_brand", "division", "subsidiary", "partner", "portfolio_company"])(
    "accepts %s",
    async (type) => {
      await expect(
        db.pool.query(
          `INSERT INTO brands (name, slug, relationship_type) VALUES ('B', $1, $2)`,
          [`brand-${type.replace(/_/g, "-")}`, type],
        ),
      ).resolves.toBeDefined();
    },
  );

  it("refuses anything else", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO brands (name, slug, relationship_type) VALUES ('B','b','owns')`,
      ),
    ).rejects.toThrow();
  });
});

describe("media alt text", () => {
  // Every one of the 53 media items on the legacy site has empty alt text
  // (SEO-4). Making the column NOT NULL and non-blank is the fix.
  it("refuses blank alt text", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO media (file_name, storage_path, mime_type, size_bytes, alt_text)
         VALUES ('a.png','/a.png','image/png',10,'   ')`,
      ),
    ).rejects.toThrow();
  });

  it("refuses missing alt text", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO media (file_name, storage_path, mime_type, size_bytes)
         VALUES ('a.png','/a.png','image/png',10)`,
      ),
    ).rejects.toThrow();
  });

  it("accepts real alt text", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO media (file_name, storage_path, mime_type, size_bytes, alt_text)
         VALUES ('a.png','/a.png','image/png',10,'A server rack')`,
      ),
    ).resolves.toBeDefined();
  });
});

describe("referential integrity", () => {
  it("refuses to delete a brand that still has products", async () => {
    const { rows } = await db.pool.query<{ id: number }>(
      `INSERT INTO brands (name, slug, relationship_type)
       VALUES ('B','b','product_brand') RETURNING id`,
    );
    const brandId = rows[0]!.id;
    await db.pool.query(
      `INSERT INTO products (brand_id, name, slug, summary) VALUES ($1,'P','p','S')`,
      [brandId],
    );

    await expect(
      db.pool.query(`DELETE FROM brands WHERE id = $1`, [brandId]),
    ).rejects.toThrow();
  });

  it("keeps articles when their author is deleted", async () => {
    const { rows } = await db.pool.query<{ id: number }>(
      `INSERT INTO admin_users (email, password_hash, name)
       VALUES ('a@b.com','x','A') RETURNING id`,
    );
    const userId = rows[0]!.id;
    await db.pool.query(
      `INSERT INTO blog_posts (title, slug, author_id) VALUES ('T','t',$1)`,
      [userId],
    );

    await db.pool.query(`DELETE FROM admin_users WHERE id = $1`, [userId]);

    const posts = await db.pool.query(`SELECT author_id FROM blog_posts`);
    expect(posts.rowCount).toBe(1);
    expect(posts.rows[0]).toEqual({ author_id: null });
  });

  it("deletes sessions when their user is deleted", async () => {
    const { rows } = await db.pool.query<{ id: number }>(
      `INSERT INTO admin_users (email, password_hash, name)
       VALUES ('a@b.com','x','A') RETURNING id`,
    );
    await db.pool.query(
      `INSERT INTO admin_sessions (id, user_id, expires_at)
       VALUES ('s1', $1, now() + interval '1 hour')`,
      [rows[0]!.id],
    );

    await db.pool.query(`DELETE FROM admin_users WHERE id = $1`, [rows[0]!.id]);

    const sessions = await db.pool.query(`SELECT * FROM admin_sessions`);
    expect(sessions.rowCount).toBe(0);
  });
});

describe("case-insensitive admin email", () => {
  it("refuses two accounts differing only in case", async () => {
    await db.pool.query(
      `INSERT INTO admin_users (email, password_hash, name)
       VALUES ('Admin@DeeTech.com','x','A')`,
    );
    await expect(
      db.pool.query(
        `INSERT INTO admin_users (email, password_hash, name)
         VALUES ('admin@deetech.com','x','B')`,
      ),
    ).rejects.toThrow(/admin_users_email_lower_key/);
  });
});

describe("updated_at trigger", () => {
  it("advances updated_at on UPDATE without the caller setting it", async () => {
    await db.pool.query(
      `INSERT INTO services (title, slug, summary) VALUES ('A','a','S')`,
    );
    const before = await db.pool.query<{ updated_at: Date }>(
      `SELECT updated_at FROM services WHERE slug = 'a'`,
    );

    await db.pool.query(`UPDATE services SET title = 'B' WHERE slug = 'a'`);

    const after = await db.pool.query<{ updated_at: Date }>(
      `SELECT updated_at FROM services WHERE slug = 'a'`,
    );
    expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(
      before.rows[0]!.updated_at.getTime(),
    );
  });
});

describe("jsonb shape guard", () => {
  it("refuses benefits that are not an array", async () => {
    await expect(
      db.pool.query(
        `INSERT INTO services (title, slug, summary, benefits)
         VALUES ('A','a','S','{"not":"an array"}'::jsonb)`,
      ),
    ).rejects.toThrow();
  });
});

describe("text encoding", () => {
  /**
   * The cluster is pinned to UTF-8 in the test harness and in
   * docker-compose. It was not: initdb inherited the host locale, which on
   * Windows is WIN1252, so the development database silently rejected any
   * character outside Latin-1 while production accepted it. For a business
   * in India a rupee sign or Devanagari text is entirely ordinary content.
   */
  it("is UTF-8, not the host locale", async () => {
    const { rows } = await db.pool.query<{ encoding: string }>(
      `SELECT current_setting('server_encoding') AS encoding`,
    );
    expect(rows[0]!.encoding).toBe("UTF8");
  });

  it.each([
    ["a rupee amount", "₹1,20,000"],
    ["Devanagari", "डीटेक ग्रुप"],
    ["an em dash", "one — two"],
    ["curly quotes", "“quoted”"],
    ["a warning sign", "⚠ review before launch"],
  ])("stores and returns %s unchanged", async (_label, value) => {
    await db.pool.query(
      `INSERT INTO pages (title, slug, body) VALUES ($1, 'encoding-check', $1)`,
      [value],
    );
    const { rows } = await db.pool.query<{ title: string; body: string }>(
      `SELECT title, body FROM pages WHERE slug = 'encoding-check'`,
    );
    expect(rows[0]!.title).toBe(value);
    expect(rows[0]!.body).toBe(value);
  });
});

describe("migration runner", () => {
  it("records every applied migration with a checksum", async () => {
    const { rows } = await db.pool.query<{ name: string; checksum: string }>(
      `SELECT name, checksum FROM schema_migrations ORDER BY name`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.name).toBe("0001_initial_schema.sql");
    expect(rows[0]!.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("seeds", () => {
  it("are idempotent — applying them twice leaves the same row count", async () => {
    await db.applySeeds();
    const first = await db.pool.query(`SELECT count(*)::int AS c FROM services`);
    await db.applySeeds();
    const second = await db.pool.query(`SELECT count(*)::int AS c FROM services`);

    expect(second.rows[0]).toEqual(first.rows[0]);
    expect(first.rows[0]!.c).toBe(5);
  });

  it("publish AnPreD as a product brand, with InfraShield linked to it", async () => {
    await db.applySeeds();

    const brands = await db.pool.query<{
      id: number;
      slug: string;
      relationship_type: string;
      status: string;
      website_url: string;
      logo_url: string;
    }>(`SELECT id, slug, relationship_type, status, website_url, logo_url FROM brands`);

    expect(brands.rows).toHaveLength(1);
    expect(brands.rows[0]).toMatchObject({
      slug: "anpred",
      status: "published",
      website_url: "https://anpred.com/",
      logo_url: "/brand/anpred-logo.png",
    });

    // Guards the legal wording. The owner confirmed on 2026-10-11 that
    // AnPreD is a product of DeeTech Group, so this value is settled —
    // changing it to "subsidiary" would assert a separately incorporated
    // company and must fail here rather than drift in.
    expect(brands.rows[0]!.relationship_type).toBe("product_brand");

    const products = await db.pool.query<{
      slug: string;
      lifecycle: string;
      brand_id: number;
      documentation_url: string;
      download_url: string;
    }>(
      `SELECT slug, lifecycle, brand_id, documentation_url, download_url FROM products`,
    );

    expect(products.rows).toHaveLength(1);
    expect(products.rows[0]).toMatchObject({
      slug: "infrashield",
      lifecycle: "available",
      documentation_url: "https://anpred.com/documentation",
      download_url: "https://anpred.com/download",
    });
    // The seed resolves brand_id by slug rather than hardcoding an id,
    // because the id depends on insert order.
    expect(products.rows[0]!.brand_id).toBe(brands.rows[0]!.id);
  });

  it("publish five services with unique summaries and populated detail", async () => {
    await db.applySeeds();
    const { rows } = await db.pool.query<{
      slug: string;
      summary: string;
      benefits: number;
      inclusions: number;
    }>(
      `SELECT slug, summary,
              jsonb_array_length(benefits) AS benefits,
              jsonb_array_length(inclusions) AS inclusions
         FROM services WHERE status = 'published' ORDER BY sort_order`,
    );

    expect(rows.map((r) => r.slug)).toEqual([
      "web-development",
      "managed-it-services",
      "network-services",
      "email-services",
      "web-hosting",
    ]);
    expect(new Set(rows.map((r) => r.summary)).size).toBe(5);
    for (const row of rows) {
      expect(row.benefits).toBe(3);
      expect(row.inclusions).toBeGreaterThanOrEqual(5);
    }
  });
});
