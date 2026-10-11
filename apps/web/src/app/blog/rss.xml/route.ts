import { getAllPosts } from "@/lib/content";
import { site, SITE_URL } from "@/lib/site";

/**
 * RSS feed for the blog.
 *
 * This route exists because docs/redirects.csv points the legacy WordPress
 * feed (`/index.php/feed/`) here. Anyone subscribed to the old feed keeps
 * working after cutover instead of landing on a 404.
 */

/** Escapes the five XML entities. Post titles and excerpts are author input. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getAllPosts();
  const updated = posts[0]?.publishedAt ?? new Date().toISOString();

  const items = posts
    .map(
      (post) => `    <item>
      <title>${xmlEscape(post.title)}</title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}</guid>
      <description>${xmlEscape(post.excerpt)}</description>
      <pubDate>${new Date(post.publishedAt!).toUTCString()}</pubDate>
${post.category ? `      <category>${xmlEscape(post.category)}</category>\n` : ""}    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(site.name)} — Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>${xmlEscape(site.description)}</description>
    <language>en-IN</language>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
