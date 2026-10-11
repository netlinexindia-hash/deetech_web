import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { AppConfig } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter, type DatabaseCheck } from "./routes/health.js";

export const API_VERSION = "0.1.0";
export const API_PREFIX = "/api/v1";

export interface BuildAppOptions {
  config: AppConfig;
  checkDatabase?: DatabaseCheck;
}

/**
 * Builds the Express application without binding a port, so tests can drive
 * it through supertest and `server.ts` stays a thin entry point.
 */
export function buildApp({ config, checkDatabase }: BuildAppOptions): Express {
  const app = express();

  // Behind nginx. Needed for correct client IPs in rate limiting (Day 14).
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin: config.corsAllowedOrigins.length > 0 ? config.corsAllowedOrigins : false,
      credentials: true,
    }),
  );

  // 100kb is generous for an enquiry form and keeps oversized bodies from
  // reaching the parser at all.
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  app.use(
    pinoHttp({
      logger,
      // Health checks fire every few seconds; logging them buries real traffic.
      autoLogging: {
        ignore: (req: { url?: string }) => req.url === `${API_PREFIX}/health`,
      },
    }),
  );

  app.use(API_PREFIX, healthRouter(API_VERSION, checkDatabase));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
