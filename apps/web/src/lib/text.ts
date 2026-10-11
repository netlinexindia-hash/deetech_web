/**
 * Plain-text helpers for places that must not render Markdown — card
 * summaries, meta descriptions, Open Graph tags and JSON-LD.
 */

/** Strips the small set of inline Markdown the CMS body can contain. */
function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The opening paragraph, as plain text. */
export function firstParagraph(markdown: string): string {
  const [first = ""] = markdown.split(/\n\s*\n/);
  return stripMarkdown(first);
}

/**
 * A meta-description-length excerpt, cut on a word boundary so it does not
 * end mid-word.
 */
export function excerpt(markdown: string, maxLength = 180): string {
  const text = stripMarkdown(markdown);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}
