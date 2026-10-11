import pg from "pg";
import { logger } from "../logger.js";

const { Pool, types } = pg;

/**
 * `bigint` columns arrive as strings by default, because a Postgres bigint
 * can exceed Number.MAX_SAFE_INTEGER. Our ids are identity columns that will
 * not approach 2^53, and the shared types declare them as `number`, so they
 * are parsed here in exactly one place rather than at every call site.
 *
 * If a table ever genuinely needs the full bigint range, this is the line
 * that has to change.
 */
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));

/**
 * `numeric` is left as a string on purpose — converting it to a float would
 * silently lose precision, which is the whole reason to use numeric.
 */

export type DbPool = pg.Pool;

export function createPool(connectionString: string): DbPool {
  const pool = new Pool({
    connectionString,
    // Sized for a single small VPS container, not a fleet.
    max: 10,
    idleTimeoutMillis: 30_000,
    // Fail fast when the database is unreachable rather than queueing
    // requests behind a connection that will never come.
    connectionTimeoutMillis: 5_000,
    // A query that has run this long is a bug; let it be killed rather than
    // hold a connection open indefinitely.
    statement_timeout: 15_000,
  });

  // An idle client erroring (the database restarted, the network dropped) is
  // emitted on the pool. Without a listener, Node treats it as an unhandled
  // error event and exits the process.
  pool.on("error", (error) => {
    logger.error({ err: error }, "Idle database client error");
  });

  return pool;
}

/**
 * Health probe used by `GET /api/v1/health`. Returns what it actually
 * observed — a failed query reports `unavailable`, never a hopeful `ok`.
 */
export function makeDatabaseCheck(pool: DbPool) {
  return async (): Promise<"ok" | "unavailable"> => {
    try {
      await pool.query("SELECT 1");
      return "ok";
    } catch (error) {
      logger.warn({ err: error }, "Database health check failed");
      return "unavailable";
    }
  };
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export async function withTransaction<T>(
  pool: DbPool,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
      // The connection may already be broken; the original error is what
      // matters and is rethrown below.
    });
    throw error;
  } finally {
    client.release();
  }
}
