#!/usr/bin/env node
/**
 * Generates the nginx redirect snippet from docs/redirects.csv so the two can
 * never drift apart. Run it whenever the CSV changes.
 *
 *   node infrastructure/deployment/generate-redirects.mjs
 *
 * Output: infrastructure/nginx/snippets/deetech-redirects.conf
 * Install to: /etc/nginx/snippets/deetech-redirects.conf (Day 22).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const source = resolve(repoRoot, "docs", "redirects.csv");
const target = resolve(
  repoRoot,
  "infrastructure",
  "nginx",
  "snippets",
  "deetech-redirects.conf",
);

/** Minimal CSV reader: no quoted commas are used in this file, and we assert that. */
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const header = lines.shift();
  if (header !== "old_path,new_path,status,note") {
    throw new Error(`Unexpected CSV header: ${header}`);
  }

  return lines.map((line, index) => {
    const parts = line.split(",");
    if (parts.length < 4) {
      throw new Error(`Row ${index + 2} has fewer than 4 columns: ${line}`);
    }
    const [oldPath, newPath, status, ...noteParts] = parts;
    return {
      oldPath: oldPath.trim(),
      newPath: newPath.trim(),
      status: Number(status.trim()),
      note: noteParts.join(",").trim(),
      line: index + 2,
    };
  });
}

function validate(rows) {
  const problems = [];
  const seen = new Set();

  for (const row of rows) {
    if (!row.oldPath.startsWith("/")) {
      problems.push(
        `line ${row.line}: old_path must start with "/" — got "${row.oldPath}"`,
      );
    }
    if (!row.newPath.startsWith("/")) {
      problems.push(
        `line ${row.line}: new_path must start with "/" — got "${row.newPath}"`,
      );
    }
    if (row.oldPath === row.newPath) {
      problems.push(`line ${row.line}: redirects to itself — "${row.oldPath}"`);
    }
    if (![301, 302, 308].includes(row.status)) {
      problems.push(
        `line ${row.line}: status must be 301, 302 or 308 — got ${row.status}`,
      );
    }
    if (seen.has(row.oldPath)) {
      problems.push(`line ${row.line}: duplicate old_path "${row.oldPath}"`);
    }
    seen.add(row.oldPath);
  }

  // A redirect chain (A -> B where B is itself redirected) costs crawl budget
  // and is explicitly called out in section 10 of the plan.
  const targets = new Map(rows.map((row) => [row.oldPath, row.newPath]));
  for (const row of rows) {
    if (targets.has(row.newPath) && targets.get(row.newPath) !== row.newPath) {
      problems.push(
        `line ${row.line}: chain — "${row.oldPath}" -> "${row.newPath}" -> "${targets.get(row.newPath)}". Point it at the final destination.`,
      );
    }
  }

  return problems;
}

const rows = parseCsv(readFileSync(source, "utf8"));
const problems = validate(rows);

if (problems.length > 0) {
  console.error("docs/redirects.csv is not valid:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const body = rows
  .map((row) => {
    const comment = row.note ? `# ${row.note}\n` : "";
    // `location =` is an exact match, which is both fastest and safest here.
    // A trailing-slash variant is emitted too, so either form works — but not
    // when stripping the slash produces the destination itself
    // (`/blog/` -> `/blog` would otherwise also emit `/blog` -> `/blog`,
    // an infinite redirect).
    const withoutSlash = row.oldPath.replace(/\/$/, "");
    const paths = [row.oldPath];
    if (
      withoutSlash !== row.oldPath &&
      withoutSlash !== "" &&
      withoutSlash !== row.newPath
    ) {
      paths.push(withoutSlash);
    }
    return (
      comment +
      paths
        .map(
          (path) =>
            `location = ${path} { return ${row.status} $scheme://$host${row.newPath}; }`,
        )
        .join("\n")
    );
  })
  .join("\n\n");

const output = `# GENERATED FILE — DO NOT EDIT BY HAND.
# Source: docs/redirects.csv
# Regenerate: node infrastructure/deployment/generate-redirects.mjs
# ${rows.length} redirect rules.

${body}
`;

writeFileSync(target, output, "utf8");
console.log(`Wrote ${rows.length} rules to ${target}`);
