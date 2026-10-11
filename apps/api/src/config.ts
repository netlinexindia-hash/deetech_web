import { z } from "zod";

/**
 * Every environment variable the API reads is declared here and nowhere else.
 * Nothing falls back to a production-shaped default: if a required value is
 * missing the process refuses to start, which is better than silently running
 * with the wrong configuration.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default("0.0.0.0"),

  /**
   * Comma-separated list of browser origins allowed to call this API.
   * Empty in production means "same-origin only", which is the correct
   * default when nginx proxies both apps under one hostname.
   */
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z
    .url({
      // Constrained to a Postgres URL on purpose. Zod's bare `url()` accepts
      // `localhost:5432` (it parses as protocol "localhost:"), which would let
      // a malformed connection string through to the driver.
      protocol: /^postgres(ql)?$/,
      error: "Must be a postgres:// or postgresql:// connection URL",
    })
    .optional(),

  /**
   * Used to hash session ids and client IPs. Required in production — a
   * predictable hash of an IP is not meaningfully better than storing it.
   */
  SESSION_SECRET: z.string().min(32).optional(),

  /** Session lifetime, in hours. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),

  // --- SMTP ----------------------------------------------------------------
  // Optional as a group. With no host the mailer is a no-op that logs; an
  // enquiry is still saved and still appears in the admin list.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("DeeTech Group <no-reply@deetechgroup.com>"),
  ENQUIRY_NOTIFICATION_TO: z.string().default("support@deetechgroup.com"),

  // --- enquiry throttling --------------------------------------------------
  ENQUIRY_MAX_PER_WINDOW: z.coerce.number().int().min(1).max(100).default(5),
  ENQUIRY_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
});

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  host: string;
  corsAllowedOrigins: string[];
  logLevel: string;
  databaseUrl: string | undefined;
  sessionSecret: string | undefined;
  sessionTtlHours: number;
  smtp: Readonly<{
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    password: string | undefined;
    from: string;
    notificationTo: string;
  }>;
  enquiry: Readonly<{
    maxPerWindow: number;
    windowMinutes: number;
  }>;
}>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const data = parsed.data;
  const isProduction = data.NODE_ENV === "production";

  // Checked after parsing because the requirement depends on NODE_ENV.
  // Starting production without these would mean unauthenticated admin
  // routes or a database that is not there.
  if (isProduction) {
    const missing: string[] = [];
    if (!data.DATABASE_URL) missing.push("DATABASE_URL");
    if (!data.SESSION_SECRET) missing.push("SESSION_SECRET (at least 32 characters)");
    if (missing.length > 0) {
      throw new Error(
        `Missing required production configuration:\n${missing
          .map((name) => `  - ${name}`)
          .join("\n")}`,
      );
    }
  }

  return Object.freeze({
    nodeEnv: data.NODE_ENV,
    isProduction,
    port: data.API_PORT,
    host: data.API_HOST,
    corsAllowedOrigins: data.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
    sessionSecret: data.SESSION_SECRET,
    sessionTtlHours: data.SESSION_TTL_HOURS,
    smtp: Object.freeze({
      host: data.SMTP_HOST,
      port: data.SMTP_PORT,
      secure: data.SMTP_SECURE,
      user: data.SMTP_USER,
      password: data.SMTP_PASSWORD,
      from: data.MAIL_FROM,
      notificationTo: data.ENQUIRY_NOTIFICATION_TO,
    }),
    enquiry: Object.freeze({
      maxPerWindow: data.ENQUIRY_MAX_PER_WINDOW,
      windowMinutes: data.ENQUIRY_WINDOW_MINUTES,
    }),
  });
}
