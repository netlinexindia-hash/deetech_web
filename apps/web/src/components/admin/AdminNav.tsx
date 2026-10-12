"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_RESOURCES } from "@/lib/admin/registry";
import { cn } from "@/lib/cn";

export function AdminNav({ role }: { role: "admin" | "editor" }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    cn(
      "flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] font-medium transition-colors",
      isActive(href)
        ? "bg-white/10 text-white"
        : "text-navy-200 hover:bg-white/5 hover:text-white",
    );

  return (
    <nav
      aria-label="Admin"
      className="bg-navy-950 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto"
    >
      <div className="px-4 py-5">
        <Link
          href="/admin"
          className="flex min-h-11 items-center gap-2.5 px-3 text-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/deetech-mark.png"
            alt=""
            className="h-8 w-auto"
            width={555}
            height={533}
          />
          <span className="font-bold">DeeTech Admin</span>
        </Link>

        <ul className="mt-6 space-y-1">
          <li>
            <Link href="/admin" className={linkClass("/admin")}>
              Dashboard
            </Link>
          </li>
        </ul>

        <p className="mt-7 px-3 text-xs font-semibold tracking-[0.14em] text-navy-300 uppercase">
          Content
        </p>
        <ul className="mt-2 space-y-1">
          {ADMIN_RESOURCES.map((resource) => (
            <li key={resource.slug}>
              <Link
                href={`/admin/${resource.slug}`}
                className={linkClass(`/admin/${resource.slug}`)}
              >
                {resource.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-7 px-3 text-xs font-semibold tracking-[0.14em] text-navy-300 uppercase">
          Library
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link href="/admin/media" className={linkClass("/admin/media")}>
              Media
            </Link>
          </li>
          <li>
            <Link href="/admin/enquiries" className={linkClass("/admin/enquiries")}>
              Enquiries
            </Link>
          </li>
        </ul>

        {role === "admin" ? (
          <p className="mt-7 px-3 text-xs text-navy-300">
            You are an administrator, so you can also delete records.
          </p>
        ) : null}
      </div>
    </nav>
  );
}
