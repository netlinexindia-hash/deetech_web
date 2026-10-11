import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white p-6 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A card whose whole surface is one link.
 *
 * The anchor covers the card with an absolutely positioned overlay rather than
 * wrapping the content, so nested interactive elements stay reachable and the
 * accessible name comes from the title alone.
 */
export function LinkCard({
  href,
  title,
  description,
  footer,
  className,
}: {
  href: string;
  title: string;
  description: string;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-white p-6 shadow-card",
        "transition-[box-shadow,border-color,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover",
        "focus-within:border-brand-300",
        className,
      )}
    >
      <h3 className="text-h3">
        <Link href={href} className="after:absolute after:inset-0 after:content-['']">
          {title}
        </Link>
      </h3>

      <p className="mt-3 text-body">{description}</p>

      {footer ? <div className="mt-5">{footer}</div> : null}

      <span
        aria-hidden="true"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"
      >
        Learn more
        <svg
          viewBox="0 0 20 20"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10h11M11 5l5 5-5 5" />
        </svg>
      </span>
    </div>
  );
}
