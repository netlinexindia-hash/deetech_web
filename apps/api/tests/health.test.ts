import { describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });

describe("GET /api/v1/health", () => {
  it("reports ok and says the database is not configured yet", async () => {
    const app = buildApp({ config });

    const res = await request(app).get(`${API_PREFIX}/health`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("deetech-api");
    expect(res.body.checks.database).toBe("not_configured");
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("reports degraded when the database check fails", async () => {
    const app = buildApp({
      config,
      checkDatabase: async () => {
        throw new Error("connection refused");
      },
    });

    const res = await request(app).get(`${API_PREFIX}/health`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.database).toBe("unavailable");
  });
});

describe("unknown routes", () => {
  it("returns a structured 404", async () => {
    const app = buildApp({ config });

    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
    expect(typeof res.body.error.message).toBe("string");
  });
});

describe("security defaults", () => {
  it("does not advertise Express and sets helmet headers", async () => {
    const app = buildApp({ config });

    const res = await request(app).get(`${API_PREFIX}/health`);

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
