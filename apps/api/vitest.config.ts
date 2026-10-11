import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    globals: false,
    // Each integration suite starts its own PostgreSQL cluster, which takes a
    // few seconds on a cold start.
    testTimeout: 30_000,
    hookTimeout: 180_000,
    // Suites run in separate processes; one cluster each, on its own port.
    pool: "forks",
  },
});
