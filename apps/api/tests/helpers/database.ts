import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import type { Pool } from "pg";
import { createPool } from "../../src/db/pool.js";
import { migrate } from "../../src/db/migrate.js";
import { seed } from "../../src/db/seed.js";

/**
 * Spins up a throwaway PostgreSQL 18 for integration tests, applies the real
 * migrations, and tears it down afterwards.
 *
 * Deliberately a real Postgres rather than an in-memory emulation: these
 * tests exist to prove the CHECK constraints, the partial indexes, the
 * triggers and the published-only filtering actually behave, and an emulator
 * would let a divergence pass as a green test.
 *
 * Each suite gets its own cluster on its own port, so suites cannot see each
 * other's rows and can run in any order.
 */

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../../database/migrations/", import.meta.url),
);
const SEEDS_DIR = fileURLToPath(
  new URL("../../../../database/seeds/", import.meta.url),
);

export interface TestDatabase {
  pool: Pool;
  url: string;
  /** Truncates every content table, leaving the schema in place. */
  reset(): Promise<void>;
  /** Re-applies the checked-in seed files. */
  applySeeds(): Promise<void>;
  stop(): Promise<void>;
}

const TABLES = [
  "login_attempts",
  "admin_sessions",
  "contact_enquiries",
  "media",
  "blog_posts",
  "products",
  "brands",
  "services",
  "pages",
  "admin_users",
];

export async function startTestDatabase(port: number): Promise<TestDatabase> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "deetech-pgtest-"));

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "test",
    password: "test",
    port,
    persistent: false,
    /**
     * Pin the cluster to UTF-8.
     *
     * Without this, initdb inherits the host locale — on Windows that is
     * WIN1252, so the dev database silently rejects any character outside
     * Latin-1 while production (postgres:17-alpine) accepts it. For a business
     * in India that means a rupee sign or Devanagari text would work in
     * production and fail here, which is the worst way round to find out.
     *
     * `--no-locale` means locale C, i.e. byte-order collation: deterministic,
     * identical on every platform, and the one locale name that is valid on
     * both Windows and Alpine. (`C.UTF-8` is not a valid locale name on
     * Windows — initdb rejects it.)
     */
    initdbFlags: ["--encoding=UTF8", "--no-locale"],
  });

  await pg.initialise();
  await pg.start();

  const url = `postgresql://test:test@127.0.0.1:${port}/postgres`;
  const pool = createPool(url);

  await migrate(pool, MIGRATIONS_DIR);

  return {
    pool,
    url,
    async reset() {
      // RESTART IDENTITY so ids are predictable per test; CASCADE because
      // products reference brands and sessions reference users.
      await pool.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
    },
    async applySeeds() {
      await seed(pool, SEEDS_DIR);
    },
    async stop() {
      await pool.end().catch(() => {});
      await pg.stop().catch(() => {});
      await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
