import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../src/services/password.js";
import { AuthRepository } from "../src/repositories/auth.js";
import { startTestDatabase, type TestDatabase } from "./helpers/database.js";

/**
 * The rollback guarantee.
 *
 * `infrastructure/deployment/backup.sh` and `restore.sh` wrap `pg_dump` and
 * `psql`, which are not bundled with the embedded Postgres used for these
 * tests, so those scripts cannot be executed here — that is stated plainly
 * in the Week 5 report.
 *
 * What IS tested is the property the procedure exists to provide, and the
 * part that is ours to get wrong: that a full logical snapshot taken before
 * a destructive event restores every table intact afterwards, **including
 * the identity sequences**. A restore that brings the rows back but leaves
 * sequences at zero looks like a success and then fails on the next insert
 * with a duplicate key — which is exactly the kind of thing you discover
 * during an incident rather than before one.
 */

let db: TestDatabase;

const TABLES = [
  "admin_users",
  "pages",
  "services",
  "brands",
  "products",
  "blog_posts",
  "media",
  "contact_enquiries",
] as const;

/** Identity columns whose sequences must survive a restore. */
const SEQUENCES: Record<string, string> = {
  admin_users: "admin_users_id_seq",
  pages: "pages_id_seq",
  services: "services_id_seq",
  brands: "brands_id_seq",
  products: "products_id_seq",
  blog_posts: "blog_posts_id_seq",
  media: "media_id_seq",
  contact_enquiries: "contact_enquiries_id_seq",
};

interface Snapshot {
  rows: Record<string, Record<string, unknown>[]>;
  sequences: Record<string, number>;
}

/** The logical equivalent of what `pg_dump` captures. */
async function snapshot(): Promise<Snapshot> {
  const rows: Snapshot["rows"] = {};
  for (const table of TABLES) {
    const result = await db.pool.query(`SELECT * FROM ${table} ORDER BY id`);
    rows[table] = result.rows;
  }

  const sequences: Snapshot["sequences"] = {};
  for (const [table, sequence] of Object.entries(SEQUENCES)) {
    const { rows: seq } = await db.pool.query<{ last_value: string }>(
      `SELECT last_value FROM ${sequence}`,
    );
    sequences[table] = Number(seq[0]!.last_value);
  }

  return { rows, sequences };
}

/** The logical equivalent of `restore.sh`: wipe, reinsert, reset sequences. */
async function restore(snap: Snapshot): Promise<void> {
  await db.pool.query(
    `TRUNCATE ${[...TABLES].reverse().join(", ")} RESTART IDENTITY CASCADE`,
  );

  for (const table of TABLES) {
    for (const row of snap.rows[table]!) {
      const columns = Object.keys(row);
      // jsonb columns come back from pg as parsed JS values; handing an
      // array straight back makes the driver send a Postgres array literal
      // rather than JSON. Re-serialise them, exactly as the admin
      // repository does on write.
      const values = Object.values(row).map((value) =>
        value !== null && typeof value === "object" && !(value instanceof Date)
          ? JSON.stringify(value)
          : value,
      );
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      await db.pool.query(
        `INSERT INTO ${table} (${columns.join(", ")})
         OVERRIDING SYSTEM VALUE
         VALUES (${placeholders.join(", ")})`,
        values,
      );
    }
    // What pg_dump emits as setval, and the step that is easy to omit.
    const highest = snap.rows[table]!.length;
    if (highest > 0) {
      await db.pool.query(`SELECT setval($1, (SELECT max(id) FROM ${table}))`, [
        SEQUENCES[table],
      ]);
    }
  }
}

beforeAll(async () => {
  db = await startTestDatabase(55606);
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
  await db.applySeeds();

  // A realistic production shape: content, an operator, an enquiry, a file.
  const auth = new AuthRepository(db.pool);
  await auth.createUser({
    email: "admin@deetechgroup.com",
    name: "An Admin",
    role: "admin",
    passwordHash: await hashPassword("a-sufficiently-long-test-password"),
  });
  await db.pool.query(
    `INSERT INTO contact_enquiries (name, email, subject, message)
     VALUES ('Priya Sharma', 'priya@example.com', 'New site', 'A message body.')`,
  );
  await db.pool.query(
    `INSERT INTO media (file_name, storage_path, mime_type, size_bytes, alt_text)
     VALUES ('logo.png', '2026/10/logo-abc123.png', 'image/png', 2048, 'The logo')`,
  );
});

describe("backup and restore round trip", () => {
  it("brings every table back after a total wipe", async () => {
    const before = await snapshot();

    // Disaster.
    await db.pool.query(
      `TRUNCATE ${[...TABLES].reverse().join(", ")} RESTART IDENTITY CASCADE`,
    );
    const emptied = await db.pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM services`,
    );
    expect(Number(emptied.rows[0]!.count)).toBe(0);

    await restore(before);

    const after = await snapshot();
    for (const table of TABLES) {
      expect(after.rows[table], `${table} row count`).toHaveLength(
        before.rows[table]!.length,
      );
    }
    expect(after.rows).toEqual(before.rows);
  });

  it("restores sequences, so the next insert does not collide", async () => {
    const before = await snapshot();
    await restore(before);

    // The failure this guards against: rows restored, sequence left at 1,
    // next insert tries id=1 and hits a duplicate key.
    const { rows } = await db.pool.query<{ id: number }>(
      `INSERT INTO services (title, slug, summary)
       VALUES ('After restore', 'after-restore', 'A distinct summary, long enough.')
       RETURNING id`,
    );
    const maxBefore = Math.max(...before.rows.services!.map((row) => Number(row.id)));
    expect(rows[0]!.id).toBeGreaterThan(maxBefore);
  });

  it("preserves the admin password hash, so operators can still sign in", async () => {
    const before = await snapshot();
    await restore(before);

    const auth = new AuthRepository(db.pool);
    const user = await auth.findForLogin("admin@deetechgroup.com");
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBe(
      (before.rows.admin_users![0] as { password_hash: string }).password_hash,
    );
    expect(user!.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("preserves enquiries, which exist nowhere else", async () => {
    // Content can be re-entered from the CMS; an enquiry somebody sent
    // cannot be recovered from anywhere if it is lost.
    const before = await snapshot();
    await restore(before);

    const { rows } = await db.pool.query<{ name: string; message: string }>(
      `SELECT name, message FROM contact_enquiries`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      name: "Priya Sharma",
      message: "A message body.",
    });
  });

  it("preserves the brand-to-product relationship", async () => {
    const before = await snapshot();
    await restore(before);

    const { rows } = await db.pool.query<{ product: string; brand: string }>(
      `SELECT p.slug AS product, b.slug AS brand
         FROM products p JOIN brands b ON b.id = p.brand_id`,
    );
    expect(rows).toEqual([{ product: "infrashield", brand: "anpred" }]);
  });

  it("leaves the schema able to enforce its constraints afterwards", async () => {
    const before = await snapshot();
    await restore(before);

    // A restore that dropped the constraints would pass every test above
    // and silently accept bad data from then on.
    await expect(
      db.pool.query(
        `INSERT INTO media (file_name, storage_path, mime_type, size_bytes, alt_text)
         VALUES ('x.png', '/x.png', 'image/png', 1, '  ')`,
      ),
    ).rejects.toThrow();

    await expect(
      db.pool.query(
        `INSERT INTO services (title, slug, summary)
         VALUES ('Dup', 'dup-slug', $1)`,
        [before.rows.services![0]!.summary],
      ),
    ).rejects.toThrow();
  });
});
