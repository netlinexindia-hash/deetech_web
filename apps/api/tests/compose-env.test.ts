/**
 * The compose file must pass every config key through to the API container.
 *
 * A container does not inherit .env. Compose passes only what the service's
 * `environment:` block names, so a key that exists in the config schema but
 * is missing from that block silently falls back to its schema default.
 *
 * That is not hypothetical. The SMTP settings were in .env.example and in the
 * config schema but were never passed through, so supplying credentials would
 * have changed nothing — and because the mailer no-ops without SMTP_HOST by
 * design, nothing would have errored. Enquiries would have kept saving and no
 * email would ever have been sent.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config.js";

const COMPOSE = new URL("../../../docker-compose.yml", import.meta.url);

/** The `environment:` keys of one service in the compose file. */
function environmentKeys(yaml: string, service: string): Set<string> {
  const lines = yaml.split("\n");

  const serviceAt = lines.findIndex((line) => line === `  ${service}:`);
  if (serviceAt === -1) throw new Error(`no ${service} service in the compose file`);

  // The service ends at the next line indented by exactly two spaces.
  let serviceEnd = lines.length;
  for (let i = serviceAt + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i] ?? "")) {
      serviceEnd = i;
      break;
    }
  }

  const envAt = lines.findIndex(
    (line, i) => i > serviceAt && i < serviceEnd && line === "    environment:",
  );
  if (envAt === -1) throw new Error(`no environment block for ${service}`);

  const keys = new Set<string>();
  for (let i = envAt + 1; i < serviceEnd; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    // A line indented less than six spaces ends the environment block.
    if (!/^ {6}\S/.test(line)) break;
    const key = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*):/)?.[1];
    if (key) keys.add(key);
  }
  return keys;
}

describe("docker-compose.yml", () => {
  const yaml = readFileSync(COMPOSE, "utf8");

  it("passes every API config key through to the api container", () => {
    const declared = environmentKeys(yaml, "api");
    const required = Object.keys(envSchema.shape);

    const missing = required.filter((key) => !declared.has(key));

    expect(
      missing,
      `These keys are read by apps/api/src/config.ts but are not passed to the ` +
        `api container, so they silently fall back to their defaults:\n` +
        missing.map((k) => `  - ${k}`).join("\n"),
    ).toEqual([]);
  });

  it("finds the keys it is meant to be checking", () => {
    // Guards the parser itself: if environmentKeys silently returned nothing,
    // the test above would pass only because `required` was compared against
    // an empty set it never matched. Both of these must be non-trivial.
    const declared = environmentKeys(yaml, "api");
    expect(declared.size).toBeGreaterThan(10);
    expect(declared).toContain("DATABASE_URL");
    expect(Object.keys(envSchema.shape).length).toBeGreaterThan(10);
  });
});
