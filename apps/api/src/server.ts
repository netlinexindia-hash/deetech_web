import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool, makeDatabaseCheck } from "./db/pool.js";
import { logger } from "./logger.js";
import { AuthRepository } from "./repositories/auth.js";

const config = loadConfig();

// Without DATABASE_URL only /health is mounted. That is a deliberate,
// visible degradation rather than a crash loop: the container stays up and
// the health endpoint reports why.
const pool = config.databaseUrl ? createPool(config.databaseUrl) : undefined;

if (!pool) {
  logger.warn(
    "DATABASE_URL is not set — only /api/v1/health is available. " +
      "Run `npm run db:dev --workspace=@deetech/api` for a local database.",
  );
}

const app = buildApp({
  config,
  pool,
  checkDatabase: pool ? makeDatabaseCheck(pool) : undefined,
});

const server = app.listen(config.port, config.host, () => {
  logger.info(
    { port: config.port, host: config.host, env: config.nodeEnv },
    "DeeTech API listening",
  );
});

/**
 * Expired rows are deleted on a timer rather than left to accumulate. An
 * hour is frequent enough that the table stays small and infrequent enough
 * that it is not worth a scheduler.
 */
let sweeper: NodeJS.Timeout | undefined;
if (pool) {
  const auth = new AuthRepository(pool);
  const sweep = () =>
    auth
      .deleteExpiredSessions()
      .then((count) => {
        if (count > 0) logger.info({ count }, "Swept expired sessions");
      })
      .catch((error) => logger.warn({ err: error }, "Session sweep failed"));
  void sweep();
  sweeper = setInterval(sweep, 60 * 60 * 1000);
  sweeper.unref();
}

/**
 * Containers are stopped with SIGTERM. Finish in-flight requests before
 * exiting, but do not hang forever if a connection will not close.
 */
function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "Shutting down");
  if (sweeper) clearInterval(sweeper);

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
    // Drain the pool after the listener is closed, so no in-flight query
    // loses its connection mid-statement.
    await pool?.end().catch(() => {});
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn("Forcing shutdown after 10s grace period");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
