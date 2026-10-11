import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Renders Markdown to HTML for blog article bodies.
 *
 * The output is always sanitised, even though today's only input is a
 * checked-in fixture. From Week 4 this same function renders whatever an
 * admin typed into the CMS editor, and an allowlist that was added "later"
 * is an allowlist that was added after the first stored-XSS. The allowlist
 * is deliberately narrow: no raw HTML passthrough, no inline styles, no
 * event handlers, no iframes.
 */

const ALLOWED_TAGS = [
  "h2",
  "h3",
  "h4",
  "p",
  "a",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "blockquote",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "figure",
  "figcaption",
];

export async function renderMarkdown(source: string): Promise<string> {
  const raw = await marked.parse(source, { gfm: true, breaks: false });

  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      code: ["class"],
      th: ["scope"],
    },
    // No `data:` — an SVG data URI is a script delivery mechanism.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            // Outbound links open in a new tab and cannot reach back into
            // this page through window.opener.
            ...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          },
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: "lazy", decoding: "async" },
      }),
    },
  });
}

/** Rough reading time, for the blog listing and article header. */
export function readingTimeMinutes(source: string): number {
  const words = source.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
