import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | DeeTech Admin" },
  // Belt and braces with the Disallow in robots.txt: a disallowed path can
  // still be indexed if something links to it, but a noindex cannot.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Nothing under /admin is static. Without this Next would try to prerender
 * these at build time, when there is no session — and a prerendered admin
 * page is a cached admin page.
 */
export const dynamic = "force-dynamic";

/**
 * Deliberately does no auth check, because /admin/login is also a child of
 * this route and must be reachable signed out. The session gate lives in
 * the (protected) route group's layout, which wraps everything else.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
