import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone, which the Docker runtime stage copies instead
  // of shipping a full node_modules tree.
  output: "standalone",
  // The repo root, not apps/web — needed so standalone tracing picks up the
  // hoisted workspace node_modules.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),

  // Deliberately left off for now. Cache Components changes the data-fetching
  // model (dynamic APIs must sit behind Suspense), and the CMS integration in
  // Week 3 is easier to reason about without it. Revisit after launch.
  cacheComponents: false,

  poweredByHeader: false,
  reactStrictMode: true,

  // Canonical URLs have no trailing slash. See docs/02-sitemap-and-design-system.md.
  trailingSlash: false,

  /**
   * Uploaded media.
   *
   * Content stores origin-relative URLs like /media/2026/10/photo-ab12.png,
   * but the files are served by the API. In production nginx proxies
   * /media/ straight to it; this rewrite makes development behave the same
   * way, so a URL pasted into content works in both.
   */
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
    return [{ source: "/media/:path*", destination: `${apiBaseUrl}/media/:path*` }];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
