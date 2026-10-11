import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("applies safe defaults for local development", () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe("development");
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(4000);
    expect(config.corsAllowedOrigins).toEqual(["http://localhost:3000"]);
    expect(config.databaseUrl).toBeUndefined();
  });

  it("parses a comma-separated CORS origin list", () => {
    const config = loadConfig({
      CORS_ALLOWED_ORIGINS:
        "https://www.deetechgroup.com, https://staging.deetechgroup.com",
    });

    expect(config.corsAllowedOrigins).toEqual([
      "https://www.deetechgroup.com",
      "https://staging.deetechgroup.com",
    ]);
  });

  it("refuses to start on an invalid port rather than guessing", () => {
    expect(() => loadConfig({ API_PORT: "not-a-port" })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("refuses a DATABASE_URL that is not a postgres URL", () => {
    expect(() => loadConfig({ DATABASE_URL: "localhost:5432" })).toThrow(
      /Invalid environment configuration/,
    );
    expect(() => loadConfig({ DATABASE_URL: "https://example.com" })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("accepts a postgres connection URL", () => {
    const url = "postgresql://deetech:secret@db:5432/deetech";
    expect(loadConfig({ DATABASE_URL: url }).databaseUrl).toBe(url);
  });
});
