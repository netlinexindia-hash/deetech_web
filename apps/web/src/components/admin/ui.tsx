import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function AdminPageHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-h2">{title}</h1>
        {lead ? <p className="mt-2 max-w-2xl text-body">{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Draft / published. Distinct wording as well as distinct colour, and a
 * solid fill so it is legible wherever it is placed.
 */
export function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        published ? "bg-accent-700 text-white" : "bg-navy-100 text-navy-800",
      )}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

type ButtonTone = "primary" | "secondary" | "danger";

const toneClass: Record<ButtonTone, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary:
    "border border-navy-200 bg-white text-navy-800 hover:border-brand-400 hover:bg-brand-50",
  danger: "border border-danger bg-white text-danger hover:bg-danger/5",
};

export function AdminButton({
  href,
  tone = "primary",
  type = "button",
  className,
  children,
  ...rest
}: {
  href?: string;
  tone?: ButtonTone;
  type?: "button" | "submit";
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[0.9375rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
    toneClass[tone],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

export function AdminCard({
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

export function EmptyRow({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
      <p className="text-body">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Shown when an action succeeded or failed, above the content it concerns. */
export function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-6 rounded-lg border px-4 py-3 text-[0.9375rem] font-medium",
        tone === "error"
          ? "border-danger bg-danger/5 text-danger"
          : "border-accent-600 bg-accent-600/5 text-accent-800",
      )}
    >
      {children}
    </p>
  );
}
