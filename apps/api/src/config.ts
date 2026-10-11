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

  /**
   * Optional until Week 3 Day 11, when the schema and migrations land.
   * The health endpoint reports `not_configured` while it is absent rather
   * than pretending the database is fine.
   */
  DATABASE_URL: z
    .url({
      // Constrained to a Postgres URL on purpose. Zod's bare `url()` accepts
      // `localhost:5432` (it parses as protocol "localhost:"), which would let
      // a malformed connection string through to the driver.
      protocol: /^postgres(ql)?$/,
      error: "Must be a postgres:// or postgresql:// connection URL",
    })
    .optional(),
});

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  host: string;
  corsAllowedOrigins: string[];
  logLevel: string;
  databaseUrl: string | undefined;
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

  return Object.freeze({
    nodeEnv: data.NODE_ENV,
    isProduction: data.NODE_ENV === "production",
    port: data.API_PORT,
    host: data.API_HOST,
    corsAllowedOrigins: data.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
  });
}
