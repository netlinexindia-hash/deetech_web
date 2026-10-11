/**
 * Database CLI.
 *
 *   npm run db:migrate --workspace=@deetech/api
 *   npm run db:seed    --workspace=@deetech/api
 *   npm run db:setup   --workspace=@deetech/api   (migrate, then seed)
 *
 * Reads DATABASE_URL from the environment. Exits non-zero on failure so a
 * deploy script can gate on it.
 */
import { loadConfig } from "../config.js";
import { logger } from "../logger.js";
import { createPool } from "./pool.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";

type Command = "migrate" | "seed" | "setup";

const command = (process.argv[2] ?? "migrate") as Command;

if (!["migrate", "seed", "setup"].includes(command)) {
  console.error(`Unknown command "${command}". Use migrate, seed or setup.`);
  process.exit(2);
}

const config = loadConfig();

if (!config.databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in, or " +
      "start the local test database with: npm run db:dev --workspace=@deetech/api",
  );
  process.exit(2);
}

const pool = createPool(config.databaseUrl);

try {
  if (command === "migrate" || command === "setup") {
    const { applied, skipped } = await migrate(pool);
    logger.info(
      { applied: applied.length, alreadyApplied: skipped.length },
      applied.length > 0 ? "Migrations applied" : "Schema already up to date",
    );
  }

  if (command === "seed" || command === "setup") {
    const applied = await seed(pool);
    logger.info({ seeds: applied.length }, "Seeds applied");
  }
} catch (error) {
  logger.error(
    { err: error },
    `Database ${command} failed — no changes were left half-applied`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
