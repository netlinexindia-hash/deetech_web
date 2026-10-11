/**
 * Links that leave the site — product websites, documentation, downloads.
 *
 * Three things every one of them needs and that are easy to forget on a
 * one-off anchor:
 *   - `rel="noopener noreferrer"`, so the opened page cannot reach back
 *     through `window.opener` and cannot read the referrer.
 *   - A visible icon *and* text in the accessible name saying it opens in a
 *     new tab, because an unannounced new tab is disorienting with a screen
 *     reader and on mobile.
 *   - The destination host, so people can see where they are being sent
 *     before they click.
 */

export interface ExternalLinkItem {
  label: string;
  href: string;
}

function hostOf(href: string): string | null {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function NewTabIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4" />
    </svg>
  );
}

export function ExternalLink({ label, href }: ExternalLinkItem) {
  const host = hostOf(href);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-semibold text-brand-800 hover:text-brand-900"
    >
      <span className="underline underline-offset-4">{label}</span>
      <NewTabIcon />
      {/* Appended to the visible label, not a repeat of it — the accessible
          name reads "Visit website (example.com, opens in a new tab)". */}
      <span className="sr-only">
        {host ? ` (${host}, opens in a new tab)` : " (opens in a new tab)"}
      </span>
    </a>
  );
}

export function ExternalLinkList({ links }: { links: ExternalLinkItem[] }) {
  if (links.length === 0) return null;

  return (
    <ul className="space-y-1">
      {links.map((link) => (
        <li key={link.href}>
          <ExternalLink {...link} />
        </li>
      ))}
    </ul>
  );
}
