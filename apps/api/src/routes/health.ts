import { Router } from "express";
import type { HealthResponse } from "@deetech/shared-types";

const startedAt = Date.now();

export type DatabaseCheck = () => Promise<"ok" | "unavailable">;

/**
 * Liveness/readiness endpoint used by Docker health checks, nginx and the
 * uptime monitor (Day 28).
 *
 * It reports only what it has actually verified. No database check exists
 * until Week 3 Day 11, so the endpoint says `not_configured` rather than
 * asserting a healthy database it has never contacted. Pass `checkDatabase`
 * once a real connection pool exists.
 */
export function healthRouter(version: string, checkDatabase?: DatabaseCheck): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const database: HealthResponse["checks"]["database"] = checkDatabase
      ? await checkDatabase().catch(() => "unavailable" as const)
      : "not_configured";

    const body: HealthResponse = {
      status: database === "unavailable" ? "degraded" : "ok",
      service: "deetech-api",
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      checks: { database },
    };

    // A degraded dependency is still a live process; the container should not
    // be restarted for it. nginx and the uptime monitor read `status`.
    res.status(200).json(body);
  });

  return router;
}
