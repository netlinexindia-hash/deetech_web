import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

/**
 * Shared logger. `redact` is not optional security theatre here: request
 * bodies and headers routinely carry credentials, and the plan forbids
 * logging passwords, tokens or sensitive form contents.
 */
export const logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[redacted]",
  },
  ...(process.env.NODE_ENV === "production"
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true } } }),
});
