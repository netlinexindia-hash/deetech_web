#!/usr/bin/env node
/**
 * Verifies the redirect map against a running site.
 *
 *   node infrastructure/deployment/verify-redirects.mjs [--base http://localhost:3000]
 *
 * `generate-redirects.mjs` proves the map is internally consistent — no
 * loops, no duplicates, no chains. That is not the same as proving it is
 * *correct*. This checks the two things that actually break a migration:
 *
 *   1. **Coverage.** Every URL the live WordPress site serves has a rule.
 *      A missing rule is a page that 404s for everyone who had it
 *      bookmarked or linked.
 *   2. **Destinations.** Every target actually resolves on the new site.
 *      A rule pointing at a 404 is worse than no rule: it converts a
 *      recoverable 404 into a redirect to a 404, which search engines treat
 *      as a soft 404 and users experience as a broken site.
 *
 * Run it against staging before cutover, and against production after.
 * Exits non-zero on any failure so it can gate a deploy.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

const baseArg = process.argv.indexOf("--base");
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:3000";

/**
 * Every URL confirmed live on the WordPress site during the Day 1 audit.
 * Kept here rather than re-crawled, so this check works offline and against
 * staging, and so it keeps working after the old site is switched off.
 * Source: docs/01-wordpress-audit.md, section 3.
 */
const LEGACY_URLS = [
  "/",
  "/index.php/home-2/",
  "/index.php/about/",
  "/index.php/contact-us/",
  "/index.php/web-development/",
  "/index.php/managed-it-services/",
  "/index.php/network-service/",
  "/index.php/email-service/",
  "/index.php/web-hosting/",
  "/index.php/blog/",
  "/index.php/2023/10/26/hello-world/",
  "/index.php/category/uncategorized/",
  "/index.php/author/myzeontech/",
  "/index.php/feed/",
  "/index.php/comments/feed/",
  "/index.php/sitemap_index.xml",
];

function parseCsv() {
  const text = readFileSync(resolve(repoRoot, "docs", "redirects.csv"), "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("old_path,"))
    .map((line) => {
      const [oldPath, newPath, status] = line.split(",");
      return {
        oldPath: oldPath.trim(),
        newPath: newPath.trim(),
        status: Number(status),
      };
    });
}

async function headStatus(url) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    return response.status;
  } catch (error) {
    return `unreachable (${error instanceof Error ? error.message : error})`;
  }
}

const rules = parseCsv();
const byOldPath = new Map(rules.map((rule) => [rule.oldPath, rule]));
const failures = [];

// --- 1. coverage ------------------------------------------------------------
console.log(`Checking ${LEGACY_URLS.length} legacy URLs for a rule…`);
for (const legacy of LEGACY_URLS) {
  if (legacy === "/") continue; // the homepage keeps its URL
  if (!byOldPath.has(legacy)) {
    failures.push(`No redirect rule for the live legacy URL ${legacy}`);
  }
}

// --- 2. destinations --------------------------------------------------------
const destinations = [...new Set(rules.map((rule) => rule.newPath))].sort();
console.log(`Checking ${destinations.length} distinct destinations against ${BASE}…\n`);

for (const path of destinations) {
  const status = await headStatus(`${BASE}${path}`);
  const ok = status === 200;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${String(status).padEnd(12)} ${path}`);
  if (!ok) {
    failures.push(`Redirect destination ${path} returned ${status}, expected 200`);
  }
}

// --- report -----------------------------------------------------------------
console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} problem${failures.length === 1 ? "" : "s"}:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    "\nA rule pointing at a 404 is worse than no rule: it turns a recoverable\n" +
      "404 into a redirect to one, which reads as a soft 404 to a crawler.",
  );
  process.exit(1);
}

console.log(
  `All ${LEGACY_URLS.length - 1} legacy URLs have a rule, and all ` +
    `${destinations.length} destinations resolve.`,
);
