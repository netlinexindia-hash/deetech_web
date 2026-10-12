import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import type { AppConfig } from "./config.js";
import type { DbPool } from "./db/pool.js";
import { logger } from "./logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { AdminContentRepository } from "./repositories/admin-content.js";
import { AuthRepository } from "./repositories/auth.js";
import { ContentRepository } from "./repositories/content.js";
import { EnquiryRepository } from "./repositories/enquiries.js";
import { MediaRepository } from "./repositories/media.js";
import { adminContentRouter } from "./routes/admin-content.js";
import { adminEnquiryRouter } from "./routes/admin-enquiries.js";
import { adminMediaRouter } from "./routes/admin-media.js";
import { authRouter } from "./routes/auth.js";
import { contentRouter } from "./routes/content.js";
import { enquiryRouter } from "./routes/enquiries.js";
import { healthRouter, type DatabaseCheck } from "./routes/health.js";
import { createMailer, type Mailer } from "./services/mailer.js";

export const API_VERSION = "0.1.0";
export const API_PREFIX = "/api/v1";

export interface BuildAppOptions {
  config: AppConfig;
  /** Omit to run without a database — only /health is mounted. */
  pool?: DbPool;
  checkDatabase?: DatabaseCheck;
  /** Overridden in tests so no mail is sent. */
  mailer?: Mailer;
}

/**
 * Builds the Express application without binding a port, so tests can drive
 * it through supertest and `server.ts` stays a thin entry point.
 */
export function buildApp({
  config,
  pool,
  checkDatabase,
  mailer,
}: BuildAppOptions): Express {
  const app = express();

  // Behind nginx. Needed for correct client IPs in rate limiting.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Response bodies are JSON consumed by code; pretty-printing is wasted bytes.
  app.set("json spaces", 0);

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
  app.use(cookieParser());

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

  if (pool) {
    const content = new ContentRepository(pool);
    const enquiries = new EnquiryRepository(pool);
    const auth = new AuthRepository(pool);

    app.use(API_PREFIX, contentRouter(content));

    // Application-level rate limits. nginx limits these paths too; this is
    // the layer that still applies if the API is ever reached directly, and
    // it returns the API's own error shape rather than nginx's HTML.
    const enquiryLimiter = rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        error: {
          code: "too_many_requests",
          message: "Too many requests. Please try again shortly.",
        },
      },
    });

    const loginLimiter = rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      // Successful sign-ins do not count towards the limit, so a busy admin
      // is never locked out by their own correct logins.
      skipSuccessfulRequests: true,
      message: {
        error: {
          code: "too_many_requests",
          message: "Too many sign-in attempts. Please try again shortly.",
        },
      },
    });

    app.use(`${API_PREFIX}/enquiries`, enquiryLimiter);
    app.use(`${API_PREFIX}/admin/login`, loginLimiter);

    app.use(
      API_PREFIX,
      enquiryRouter(enquiries, mailer ?? createMailer(config), config),
    );
    app.use(API_PREFIX, authRouter(auth, config));

    // Everything below is behind requireAuth, applied inside each router so
    // a route added later cannot accidentally be mounted unprotected.
    const adminContent = new AdminContentRepository(pool);
    const media = new MediaRepository(pool);

    app.use(API_PREFIX, adminContentRouter(adminContent, auth, config));
    app.use(API_PREFIX, adminMediaRouter(media, auth, config));
    app.use(API_PREFIX, adminEnquiryRouter(enquiries, auth, config));

    /**
     * Uploaded files.
     *
     * Public on purpose — these are images embedded in published pages. The
     * hardening is in what can get in here (verified magic bytes, generated
     * names, no SVG) plus the headers below: nothing is ever executed, and
     * a browser will not sniff a different type than we declare.
     */
    app.use(
      "/media",
      express.static(config.media.storagePath, {
        index: false,
        dotfiles: "deny",
        maxAge: "365d",
        immutable: true,
        setHeaders: (res) => {
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Content-Disposition", "inline");
          res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
        },
      }),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
