import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";

const config = loadConfig();
const app = buildApp({ config });

const server = app.listen(config.port, config.host, () => {
  logger.info(
    { port: config.port, host: config.host, env: config.nodeEnv },
    "DeeTech API listening",
  );
});

/**
 * Containers are stopped with SIGTERM. Finish in-flight requests before
 * exiting, but do not hang forever if a connection will not close.
 */
function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "Shutting down");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
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
