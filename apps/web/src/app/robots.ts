import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Replaces the Yoast-generated robots.txt, which points at an `http://`
 * sitemap URL that returns 404 (SEO-1 in the Day 1 audit).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing here is secret — these are simply paths with no value in
        // an index. Access control is enforced in the API, not here.
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
