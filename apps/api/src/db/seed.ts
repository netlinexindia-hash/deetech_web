import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { logger } from "../logger.js";

/**
 * Applies the SQL files in database/seeds/ in name order.
 *
 * Unlike migrations, seeds are **idempotent and re-runnable**: every file
 * uses `ON CONFLICT ... DO UPDATE`, so running them again brings approved
 * content back in line rather than erroring or duplicating rows. They are
 * not checksummed and not recorded, because re-applying them is a normal
 * operation, not a schema change.
 */

const SEEDS_DIR = fileURLToPath(
  new URL("../../../../database/seeds/", import.meta.url),
);

export async function seed(pool: Pool, dir: string = SEEDS_DIR): Promise<string[]> {
  const entries = await readdir(dir);
  const files = entries.filter((name) => name.endsWith(".sql")).sort();
  const applied: string[] = [];

  const client = await pool.connect();
  try {
    for (const name of files) {
      const sql = await readFile(path.join(dir, name), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("COMMIT");
        applied.push(name);
        logger.info({ seed: name }, "Applied seed");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Seed ${name} failed and was rolled back: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        );
      }
    }
    return applied;
  } finally {
    client.release();
  }
}
