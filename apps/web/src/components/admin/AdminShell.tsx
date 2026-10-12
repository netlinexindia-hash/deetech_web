import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import type { AdminUser } from "@/lib/admin/api";

/**
 * The admin chrome: sidebar, header, content column.
 *
 * Visually distinct from the public site on purpose — a darker, denser
 * shell makes it obvious at a glance which one you are looking at, which
 * matters when the public site is open in the next tab.
 */
export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <AdminNav role={user.role} />

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-brand-800"
              >
                View the website
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4" />
                </svg>
                <span className="sr-only">(opens in a new tab)</span>
              </Link>

              <div className="flex items-center gap-4">
                <span className="hidden text-sm text-muted sm:inline">
                  {user.name}
                  <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs font-semibold text-navy-800">
                    {user.role}
                  </span>
                </span>

                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center rounded-lg border border-navy-200 px-3.5 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>

          <main id="admin-main" className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
