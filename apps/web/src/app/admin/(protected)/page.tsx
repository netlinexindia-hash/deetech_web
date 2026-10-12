import type { Metadata } from "next";
import Link from "next/link";
import type { DashboardCounts } from "@deetech/shared-types/admin";
import { ADMIN_RESOURCES } from "@/lib/admin/registry";
import { AdminCard, AdminPageHeader, Notice } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin/api";

export const metadata: Metadata = { title: "Dashboard" };

const RESOURCE_KEYS = {
  pages: "pages",
  services: "services",
  brands: "brands",
  products: "products",
  blog: "blogPosts",
} as const satisfies Record<string, keyof DashboardCounts>;

export default async function AdminDashboard() {
  let counts: DashboardCounts | null = null;
  let error: string | null = null;

  try {
    counts = await adminFetch<DashboardCounts>("/admin/dashboard");
  } catch (caught) {
    // A dashboard that cannot reach the API should say so, not 500. Every
    // other admin page still works, so the nav stays usable.
    error = caught instanceof Error ? caught.message : "Could not load the dashboard.";
  }

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        lead="What is published, what is still a draft, and what needs a reply."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {counts ? (
        <>
          {counts.enquiries.new > 0 ? (
            <Link
              href="/admin/enquiries?status=new"
              className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-accent-600 bg-accent-600/5 px-5 py-4 transition-colors hover:bg-accent-600/10"
            >
              <span className="font-semibold text-accent-800">
                {counts.enquiries.new} new{" "}
                {counts.enquiries.new === 1 ? "enquiry" : "enquiries"} waiting
              </span>
              <span aria-hidden="true" className="font-semibold text-accent-800">
                &rarr;
              </span>
            </Link>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ADMIN_RESOURCES.map((resource) => {
              const key = RESOURCE_KEYS[resource.slug];
              const stat = counts[key] as { published: number; draft: number };
              return (
                <AdminCard key={resource.slug}>
                  <h2 className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
                    {resource.label}
                  </h2>
                  <p className="mt-3 text-h2 font-bold text-navy-900">
                    {stat.published}
                    <span className="ml-2 text-base font-medium text-muted">
                      published
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {stat.draft} {stat.draft === 1 ? "draft" : "drafts"}
                  </p>
                  <Link
                    href={`/admin/${resource.slug}`}
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4"
                  >
                    Manage {resource.label.toLowerCase()}
                  </Link>
                </AdminCard>
              );
            })}

            <AdminCard>
              <h2 className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
                Media
              </h2>
              <p className="mt-3 text-h2 font-bold text-navy-900">
                {counts.media}
                <span className="ml-2 text-base font-medium text-muted">files</span>
              </p>
              <p className="mt-1 text-sm text-muted">Images and documents</p>
              <Link
                href="/admin/media"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4"
              >
                Manage media
              </Link>
            </AdminCard>

            <AdminCard>
              <h2 className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
                Enquiries
              </h2>
              <p className="mt-3 text-h2 font-bold text-navy-900">
                {counts.enquiries.total}
                <span className="ml-2 text-base font-medium text-muted">total</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {counts.enquiries.new} awaiting a reply
              </p>
              <Link
                href="/admin/enquiries"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4"
              >
                Open the inbox
              </Link>
            </AdminCard>
          </div>
        </>
      ) : null}
    </>
  );
}
