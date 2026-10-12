import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteContent, setContentStatus } from "@/app/admin/content-actions";
import { isAdminResource } from "@/lib/admin/registry";
import { ContentForm } from "@/components/admin/ContentForm";
import { AdminPageHeader, Notice, StatusBadge } from "@/components/admin/ui";
import { adminFetch, currentUser } from "@/lib/admin/api";
import { RESOURCE_SPECS } from "@/lib/admin/resources";

interface Props {
  params: Promise<{ resource: string; id: string }>;
  searchParams: Promise<{ saved?: string; status?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resource, id } = await params;
  if (!isAdminResource(resource)) return { title: "Not found" };
  const spec = RESOURCE_SPECS[resource];
  return { title: id === "new" ? `New ${spec.singular}` : `Edit ${spec.singular}` };
}

export default async function AdminEditPage({ params, searchParams }: Props) {
  const { resource, id } = await params;
  if (!isAdminResource(resource)) notFound();

  const spec = RESOURCE_SPECS[resource];
  const query = await searchParams;
  const isNew = id === "new";

  const numericId = isNew ? null : Number.parseInt(id, 10);
  if (!isNew && (Number.isNaN(numericId) || numericId! < 1)) notFound();

  const record = isNew
    ? null
    : await adminFetch<Record<string, unknown>>(
        `/admin/content/${resource}/${numericId}`,
      ).catch(() => null);

  if (!isNew && !record) notFound();

  // Only the product form needs these, and only on that form is the extra
  // request worth making.
  const brandOptions =
    resource === "products"
      ? await adminFetch<{ items: { id: number; name: string }[] }>(
          "/admin/brand-options",
        )
          .then(({ items }) =>
            items.map((brand) => ({ value: String(brand.id), label: brand.name })),
          )
          .catch(() => [])
      : undefined;

  const user = await currentUser();
  const published = record?.status === "published";
  const publicPath = record ? spec.publicPath(record) : null;

  return (
    <>
      <AdminPageHeader
        title={
          isNew
            ? `New ${spec.singular}`
            : String(record?.[spec.titleField] ?? `Edit ${spec.singular}`)
        }
        lead={
          isNew
            ? undefined
            : `Last updated ${new Date(String(record?.updatedAt)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`
        }
        action={
          <Link
            href={`/admin/${resource}`}
            className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-brand-800 underline underline-offset-4"
          >
            Back to {spec.label.toLowerCase()}
          </Link>
        }
      />

      {query.saved ? <Notice tone="success">Saved.</Notice> : null}
      {query.status === "published" ? (
        <Notice tone="success">Published — it is now live on the site.</Notice>
      ) : null}
      {query.status === "draft" ? (
        <Notice tone="success">
          Returned to draft — it is no longer visible on the site.
        </Notice>
      ) : null}

      {record ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-5 py-4 shadow-card">
          <StatusBadge status={String(record.status)} />

          <form
            action={setContentStatus.bind(
              null,
              resource,
              Number(record.id),
              published ? "draft" : "published",
            )}
          >
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
            >
              {published ? "Return to draft" : "Publish"}
            </button>
          </form>

          {publicPath ? (
            <Link
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-800 underline underline-offset-4"
            >
              {published ? "View live page" : "Preview the URL"}
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          ) : null}

          {!published && publicPath ? (
            <span className="text-sm text-muted">
              Drafts return 404 publicly — publish to see the page.
            </span>
          ) : null}

          {/* Deleting is admin-only and not undoable, so the control only
              appears for an admin and asks before submitting. The API
              enforces the role regardless. */}
          {user?.role === "admin" ? (
            <form
              action={deleteContent.bind(null, resource, Number(record.id))}
              className="ml-auto"
            >
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger/5"
              >
                Delete
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <ContentForm
        // Only the serialisable fields — the Zod schema and publicPath stay
        // on the server.
        spec={{ slug: spec.slug, singular: spec.singular, fields: spec.fields }}
        record={record}
        brandOptions={brandOptions}
      />
    </>
  );
}
