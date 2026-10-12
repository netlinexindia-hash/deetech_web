import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentUser } from "@/lib/admin/api";

/**
 * The session gate for every admin page except the login form.
 *
 * This is a convenience, not the control: every admin API route is
 * independently protected by `requireAuth`, so bypassing this layout gains
 * an attacker nothing but an empty page.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");

  return <AdminShell user={user}>{children}</AdminShell>;
}
