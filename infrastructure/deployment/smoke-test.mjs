#!/usr/bin/env node
/**
 * Acceptance tests against a deployed site.
 *
 *   node infrastructure/deployment/smoke-test.mjs --base https://www.deetechgroup.com
 *
 * These are the checks from the plan's launch acceptance checklist that can
 * be made from outside, over HTTP, against whatever is actually running.
 * They are deliberately black-box: no database access, no assumptions about
 * the host, so the same command works against staging and production.
 *
 * It does NOT submit the contact form. Doing that on production creates a
 * real enquiry and sends a real email; that check is in the runbook as a
 * manual step with a recognisable subject line.
 *
 * Exits non-zero if anything fails, so it can gate a cutover.
 *
 * Flags:
 *   --base <url>  the site to test (default http://localhost:3000)
 *   --api  <url>  where the API lives, if not behind the same origin.
 *                 In production nginx proxies /api/ so this is not needed.
 *   --dev         skip the checks that only nginx provides — the security
 *                 headers and the legacy 301s. Use this against a local
 *                 `npm run dev` stack. NEVER use it against production:
 *                 those checks are exactly how you find out the proxy is
 *                 misconfigured.
 */

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const BASE = arg("--base", "http://localhost:3000").replace(/\/$/, "");
const API = arg("--api", BASE).replace(/\/$/, "");
const DEV = process.argv.includes("--dev");

let passed = 0;
let skipped = 0;
const failures = [];

function skip(label, why) {
  skipped += 1;
  console.log(`  skip  ${label} — ${why}`);
}

function record(ok, label, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path, options = {}) {
  // /api/ and /media/ are proxied by nginx in production, so they share the
  // site origin there. In development they are on their own port.
  const origin = path.startsWith("/api/") ? API : BASE;
  try {
    return await fetch(`${origin}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      ...options,
    });
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function section(name) {
  console.log(`\n${name}`);
}

// ---------------------------------------------------------------------------
section("Public pages respond");
// ---------------------------------------------------------------------------
const PAGES = [
  "/",
  "/about",
  "/services",
  "/services/web-development",
  "/services/managed-it-services",
  "/services/network-services",
  "/services/email-services",
  "/services/web-hosting",
  "/brands",
  "/products",
  "/blog",
  "/contact",
];

const bodies = new Map();
for (const path of PAGES) {
  const res = await get(path);
  const ok = res.status === 200;
  record(
    ok,
    `GET ${path}`,
    ok ? "" : `status ${res.status}${res.error ? ` (${res.error})` : ""}`,
  );
  if (ok) bodies.set(path, await res.text());
}

// ---------------------------------------------------------------------------
section("Machine-readable routes");
// ---------------------------------------------------------------------------
for (const [path, expect] of [
  ["/sitemap.xml", "xml"],
  ["/robots.txt", "text/plain"],
  ["/blog/rss.xml", "rss"],
  ["/icon.png", "image/png"],
  ["/favicon.ico", "image"],
]) {
  const res = await get(path);
  const type = res.headers?.get?.("content-type") ?? "";
  record(
    res.status === 200 && type.includes(expect),
    `GET ${path}`,
    res.status === 200 ? `content-type ${type}` : `status ${res.status}`,
  );
}

const robots = await (await get("/robots.txt")).text?.();
if (robots) {
  record(/Sitemap:\s*https?:\S+/.test(robots), "robots.txt advertises a sitemap");
  record(/Disallow:\s*\/admin/.test(robots), "robots.txt disallows /admin");

  // The old site advertised a sitemap that 404ed. Prove this one does not.
  const advertised = robots.match(/Sitemap:\s*(\S+)/)?.[1];
  if (advertised) {
    const res = await fetch(advertised, { signal: AbortSignal.timeout(20_000) }).catch(
      () => ({ status: 0 }),
    );
    record(
      res.status === 200,
      "the advertised sitemap actually resolves",
      `status ${res.status}`,
    );
  }
}

// ---------------------------------------------------------------------------
section("SEO essentials on every page");
// ---------------------------------------------------------------------------
for (const [path, html] of bodies) {
  const hasTitle = /<title>[^<]{10,}<\/title>/.test(html);
  const hasDescription = /<meta name="description" content="[^"]{40,}"/.test(html);
  const hasCanonical = /<link rel="canonical"/.test(html);
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;

  record(hasTitle, `${path} has a title`);
  record(hasDescription, `${path} has a meta description`);
  record(hasCanonical, `${path} has a canonical URL`);
  record(h1Count === 1, `${path} has exactly one h1`, `found ${h1Count}`);
}

// ---------------------------------------------------------------------------
section("Admin is protected and not indexable");
// ---------------------------------------------------------------------------
{
  const login = await get("/admin/login");
  record(
    login.status === 200,
    "GET /admin/login is reachable",
    `status ${login.status}`,
  );

  const admin = await get("/admin");
  record(
    admin.status === 307 || admin.status === 302 || admin.status === 200,
    "GET /admin responds",
    `status ${admin.status}`,
  );

  // Signed out, /admin must not return admin content.
  if (admin.status === 200) {
    const html = await admin.text();
    record(!/Dashboard<\/h1>/.test(html), "signed out, /admin shows no dashboard");
  }

  const loginHtml = await (await get("/admin/login")).text?.();
  if (loginHtml) {
    record(/noindex/.test(loginHtml), "/admin/login is noindex");
  }

  // The API's admin surface must reject an unauthenticated request.
  for (const path of [
    "/api/v1/admin/dashboard",
    "/api/v1/admin/content/services",
    "/api/v1/admin/media",
    "/api/v1/admin/enquiries",
  ]) {
    const res = await get(path);
    record(
      res.status === 401,
      `${path} is 401 unauthenticated`,
      `status ${res.status}`,
    );
  }
}

// ---------------------------------------------------------------------------
section("Public API returns published content only");
// ---------------------------------------------------------------------------
{
  const res = await get("/api/v1/services");
  if (res.status === 200) {
    const body = await res.json();
    const items = body.items ?? [];
    record(items.length > 0, "services are published", `${items.length} found`);
    record(
      items.every((s) => s.status === "published"),
      "no draft leaked into the public services list",
    );
    const summaries = new Set(items.map((s) => s.summary));
    record(
      summaries.size === items.length,
      "every service summary is distinct",
      `${summaries.size} distinct of ${items.length}`,
    );
  } else {
    record(false, "GET /api/v1/services", `status ${res.status}`);
  }

  const health = await get("/api/v1/health");
  if (health.status === 200) {
    const body = await health.json();
    record(body.status === "ok", "API health is ok", body.status);
    record(
      body.checks?.database === "ok",
      "database is reachable",
      body.checks?.database,
    );
  } else {
    record(false, "GET /api/v1/health", `status ${health.status}`);
  }
}

// ---------------------------------------------------------------------------
section("Security headers");
// ---------------------------------------------------------------------------
{
  const res = await get("/");
  const header = (name) => res.headers?.get?.(name) ?? "";
  const isHttps = BASE.startsWith("https://");

  // nginx sets these on every response. The Next dev server does not, so
  // they are skipped with --dev and strictly required without it.
  if (DEV) {
    skip("security headers", "nginx is not in front of a dev server");
  } else {
    record(
      header("x-content-type-options") === "nosniff",
      "X-Content-Type-Options: nosniff",
    );
    record(
      /SAMEORIGIN|DENY/i.test(header("x-frame-options")),
      "X-Frame-Options is set",
    );
    record(header("referrer-policy").length > 0, "Referrer-Policy is set");
  }
  record(
    !header("x-powered-by"),
    "X-Powered-By is not exposed",
    header("x-powered-by"),
  );

  if (isHttps) {
    record(
      /max-age=\d{7,}/.test(header("strict-transport-security")),
      "HSTS is set with a long max-age",
      header("strict-transport-security"),
    );
  } else {
    skip("HSTS", "not an https origin");
  }
}

// ---------------------------------------------------------------------------
section("Legacy URLs redirect");
// ---------------------------------------------------------------------------
if (DEV) {
  skip("legacy 301s", "they are served by the nginx redirect snippet");
} else {
  for (const [from, to] of [
    ["/index.php/about/", "/about"],
    ["/index.php/contact-us/", "/contact"],
    ["/index.php/web-development/", "/services/web-development"],
    ["/index.php/blog/", "/blog"],
  ]) {
    const res = await get(from);
    const location = res.headers?.get?.("location") ?? "";
    const redirects = res.status === 301 && location.endsWith(to);
    record(
      redirects,
      `${from} 301s to ${to}`,
      redirects ? "" : `status ${res.status} -> ${location || "(none)"}`,
    );
  }
}

// ---------------------------------------------------------------------------
section("404 handling");
// ---------------------------------------------------------------------------
for (const path of [
  "/no-such-page",
  "/services/no-such-service",
  "/blog/no-such-post",
]) {
  const res = await get(path);
  record(res.status === 404, `${path} returns 404`, `status ${res.status}`);
}

// ---------------------------------------------------------------------------
console.log("");
if (failures.length > 0) {
  console.error(`${passed} passed, ${failures.length} FAILED:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error("");
  process.exit(1);
}
console.log(
  `All ${passed} checks passed against ${BASE}` +
    (skipped > 0 ? ` (${skipped} skipped).` : "."),
);
if (DEV) {
  console.log("");
  console.log("  Run WITHOUT --dev against staging and production: the skipped");
  console.log("  checks are how a misconfigured proxy gets caught.");
}
console.log("");
console.log("Still to do by hand (see docs/06-deployment-runbook.md):");
console.log("  - submit the contact form and confirm the email arrives");
console.log("  - sign in to /admin, publish something, see it on the site");
console.log("  - check the site on a real phone");
