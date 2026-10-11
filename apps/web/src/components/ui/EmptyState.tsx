import type { ReactNode } from "react";

/**
 * Shown when a listing has no published records yet.
 *
 * This is a real state, not a placeholder: the brands and products
 * directories launch empty because that content does not exist yet
 * (docs/01-wordpress-audit.md, section 6). It says so plainly and offers a
 * way forward, rather than rendering invented sample entries.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-6 py-14 text-center">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mx-auto size-10 text-navy-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>

      <h2 className="mt-5 text-h3">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-body">{body}</p>

      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
