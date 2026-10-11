/**
 * Starts a real PostgreSQL 18 on localhost:55432 for local development,
 * then applies migrations and seeds.
 *
 *   npm run db:dev --workspace=@deetech/api
 *
 * Why this exists: the plan deploys PostgreSQL in Docker, but Docker is not
 * installed on every machine that needs to run this project. `embedded-postgres`
 * downloads and runs a genuine Postgres binary, so migrations and integration
 * tests exercise the real engine rather than an emulator. It is a
 * devDependency and never ships — production uses the `db` service in
 * docker-compose.yml.
 *
 * The data directory lives outside the repository and is git-ignored.
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { logger } from "../logger.js";
import { createPool } from "./pool.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";

const DATA_DIR = fileURLToPath(
  new URL("../../../../.devdata/postgres/", import.meta.url),
);
const PORT = 55432;
const USER = "deetech";
const PASSWORD = "deetech-local-only";
const DATABASE = "postgres";

export const DEV_DATABASE_URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;

await mkdir(path.dirname(DATA_DIR), { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  // Keeps the cluster between runs, so seeded content and any local edits
  // survive a restart.
  persistent: true,
});

/**
 * `initialise()` fails if the directory already holds a cluster, so check
 * for one rather than relying on a swallowed error — a swallowed error also
 * hides a genuinely corrupt data directory.
 */
const alreadyInitialised = existsSync(path.join(DATA_DIR, "PG_VERSION"));

if (!alreadyInitialised) {
  await pg.initialise();
}

/**
 * A cluster killed without a clean shutdown leaves `postmaster.pid` behind,
 * and Postgres then refuses to start with "pre-existing shared memory block
 * is still in use". Removing the stale pid file is safe once we have
 * confirmed no postgres process is listening on our port.
 */
async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(true));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(true);
    });
  });
}

const pidFile = path.join(DATA_DIR, "postmaster.pid");
if (existsSync(pidFile) && (await portIsFree(PORT))) {
  logger.warn(
    "Found a stale postmaster.pid from a cluster that was not shut down cleanly — removing it",
  );
  await rm(pidFile, { force: true });
}

await pg.start();
logger.info(
  { port: PORT, freshCluster: !alreadyInitialised },
  "Local PostgreSQL started",
);

const pool = createPool(DEV_DATABASE_URL);
try {
  const { applied, skipped } = await migrate(pool);
  logger.info({ applied, alreadyApplied: skipped.length }, "Migrations complete");
  const seeds = await seed(pool);
  logger.info({ seeds }, "Seeds complete");
} finally {
  await pool.end();
}

console.log("");
console.log("  PostgreSQL is running. Put this in your .env:");
console.log("");
console.log(`    DATABASE_URL=${DEV_DATABASE_URL}`);
console.log("");
console.log("  Press Ctrl+C to stop.");
console.log("");

async function shutdown() {
  logger.info("Stopping local PostgreSQL");
  await pg.stop().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
