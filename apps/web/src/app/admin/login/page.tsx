import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { currentUser } from "@/lib/admin/api";

export const metadata: Metadata = {
  title: "Sign in",
  // Never index an admin surface, and never leak a referrer from it.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLoginPage() {
  // Already signed in — no reason to show the form again.
  if (await currentUser()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-h2 text-white">DeeTech Group</h1>
          <p className="mt-2 text-navy-300">Content management</p>
        </div>

        <div className="rounded-xl bg-white p-7 shadow-overlay">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-navy-400">
          <Link href="/" className="underline underline-offset-4 hover:text-white">
            Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
