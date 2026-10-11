import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { logger } from "../logger.js";

/**
 * Forward-only SQL migration runner.
 *
 * Deliberately written here rather than pulled in as a dependency: it is
 * ~100 lines, it is the thing that changes production schema, and it should
 * be readable by whoever is on call. It gives three guarantees that a
 * hand-rolled "run every .sql file" loop does not:
 *
 *   1. Each migration runs inside its own transaction, so a failure halfway
 *      through leaves no partial schema.
 *   2. A session-level advisory lock is held for the whole run, so two
 *      containers starting at once cannot apply the same migration twice.
 *   3. Every applied file's checksum is recorded. Editing a migration that
 *      has already run is an error, not a silent divergence between
 *      environments.
 */

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../../database/migrations/", import.meta.url),
);

/** Arbitrary but fixed: identifies this application's migration lock. */
const ADVISORY_LOCK_KEY = 4_919_270_111;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  const entries = await readdir(dir);
  const files = entries.filter((name) => name.endsWith(".sql")).sort();

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(path.join(dir, name), "utf8");
      return {
        name,
        sql,
        // Normalise line endings first — a checkout on Windows must not
        // produce a different checksum from one on the Linux VPS.
        checksum: createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex"),
      };
    }),
  );
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function migrate(
  pool: Pool,
  dir: string = MIGRATIONS_DIR,
): Promise<MigrationResult> {
  const migrations = await loadMigrations(dir);
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // Session-level, so it is held across the per-migration transactions
    // below and released in `finally`.
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await ensureMigrationsTable(client);

    const { rows } = await client.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM schema_migrations",
    );
    const alreadyApplied = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const migration of migrations) {
      const previous = alreadyApplied.get(migration.name);

      if (previous !== undefined) {
        if (previous !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} has been modified since it was applied ` +
              `(recorded ${previous.slice(0, 12)}, file ${migration.checksum.slice(0, 12)}). ` +
              `Migrations are immutable once applied — add a new one instead.`,
          );
        }
        skipped.push(migration.name);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migration.name, migration.checksum],
        );
        await client.query("COMMIT");
        applied.push(migration.name);
        logger.info({ migration: migration.name }, "Applied migration");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Migration ${migration.name} failed and was rolled back: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        );
      }
    }

    return { applied, skipped };
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
      .catch(() => {
        // Releasing the lock is best-effort: if the connection has already
        // dropped, Postgres releases it for us when the session ends.
      });
    client.release();
  }
}
