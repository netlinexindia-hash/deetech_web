import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Section";

export interface Crumb {
  label: string;
  href: string;
}

/**
 * Breadcrumbs. `items` lists only the ancestors — the current page is added
 * as plain text with `aria-current`, because a link to the page you are on is
 * noise for a screen-reader user.
 */
export function Breadcrumbs({
  items,
  current,
  tone = "dark",
}: {
  items: Crumb[];
  current: string;
  tone?: "light" | "dark";
}) {
  const linkClass =
    tone === "dark"
      ? "text-navy-300 hover:text-white"
      : "text-muted hover:text-navy-900";
  const currentClass = tone === "dark" ? "text-white" : "text-navy-900";

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-2">
            <Link href={item.href} className={linkClass}>
              {item.label}
            </Link>
            <span aria-hidden="true" className={linkClass}>
              /
            </span>
          </li>
        ))}
        <li>
          <span aria-current="page" className={`font-medium ${currentClass}`}>
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}

/**
 * The navy band at the top of every interior page. Keeps the h1, the lead
 * paragraph and the breadcrumb trail consistent across sections.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  breadcrumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  breadcrumbs?: { items: Crumb[]; current: string };
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(48rem 24rem at 10% -20%, rgb(1 181 240 / 0.26), transparent 62%), radial-gradient(32rem 18rem at 92% 0%, rgb(237 60 150 / 0.16), transparent 62%)",
        }}
      />
      <Container className="relative py-12 md:py-16 lg:py-20">
        {breadcrumbs ? (
          <div className="mb-6">
            <Breadcrumbs {...breadcrumbs} />
          </div>
        ) : null}

        {eyebrow ? (
          <p className="mb-3 text-sm font-semibold tracking-[0.14em] text-brand-200 uppercase">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="max-w-3xl text-h1 text-white">{title}</h1>

        {lead ? <p className="mt-5 max-w-2xl text-lead text-navy-200">{lead}</p> : null}

        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </section>
  );
}
