import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Paginated } from "@deetech/shared-types";
import { isAdminResource } from "@/lib/admin/registry";
import {
  AdminButton,
  AdminPageHeader,
  EmptyRow,
  Notice,
  StatusBadge,
} from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin/api";
import { RESOURCE_SPECS } from "@/lib/admin/resources";
import { formatDate } from "@/lib/format";

interface Props {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    deleted?: string;
    error?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resource } = await params;
  if (!isAdminResource(resource)) return { title: "Not found" };
  return { title: RESOURCE_SPECS[resource].label };
}

type Row = Record<string, unknown>;

export default async function AdminListPage({ params, searchParams }: Props) {
  const { resource } = await params;
  if (!isAdminResource(resource)) notFound();

  const spec = RESOURCE_SPECS[resource];
  const query = await searchParams;

  const page = Number.parseInt(query.page ?? "1", 10) || 1;
  const status = ["draft", "published", "all"].includes(query.status ?? "")
    ? query.status!
    : "all";
  const search = query.q?.trim() ?? "";

  const params_ = new URLSearchParams({ page: String(page), status, perPage: "25" });
  if (search) params_.set("q", search);

  const data = await adminFetch<Paginated<Row>>(
    `/admin/content/${resource}?${params_.toString()}`,
  );

  const filterHref = (value: string) =>
    `/admin/${resource}?status=${value}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <>
      <AdminPageHeader
        title={spec.label}
        lead={`${data.total} ${data.total === 1 ? spec.singular : `${spec.singular}s`} in total.`}
        action={
          <AdminButton href={`/admin/${resource}/new`}>New {spec.singular}</AdminButton>
        }
      />

      {query.deleted ? <Notice tone="success">Deleted.</Notice> : null}
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
          {[
            { value: "all", label: "All" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Drafts" },
          ].map((option) => (
            <Link
              key={option.value}
              href={filterHref(option.value)}
              aria-current={status === option.value ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded px-3 text-sm font-medium ${
                status === option.value
                  ? "bg-brand-700 text-white"
                  : "text-navy-800 hover:bg-brand-50"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <form action={`/admin/${resource}`} className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <label htmlFor="q" className="sr-only">
            Search {spec.label.toLowerCase()}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search by title or slug"
            className="min-h-11 rounded-lg border border-navy-200 px-3.5 text-[0.9375rem]"
          />
          <AdminButton type="submit" tone="secondary">
            Search
          </AdminButton>
        </form>
      </div>

      {data.items.length === 0 ? (
        <EmptyRow
          message={
            search || status !== "all"
              ? "Nothing matches that filter."
              : `No ${spec.singular}s yet.`
          }
          action={
            <AdminButton href={`/admin/${resource}/new`}>
              Create the first one
            </AdminButton>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <table className="w-full text-left text-[0.9375rem]">
            <caption className="sr-only">
              {spec.label}, page {data.page} of {data.totalPages}
            </caption>
            <thead className="border-b border-border bg-surface-subtle">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold text-navy-900">
                  Title
                </th>
                {spec.listColumns.map((column) => (
                  <th
                    key={column.name}
                    scope="col"
                    className="hidden px-5 py-3 font-semibold text-navy-900 md:table-cell"
                  >
                    {column.label}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3 font-semibold text-navy-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-border last:border-0 hover:bg-surface-subtle"
                >
                  <th scope="row" className="px-5 py-3 font-medium">
                    <Link
                      href={`/admin/${resource}/${row.id}`}
                      className="text-brand-800 underline underline-offset-4"
                    >
                      {String(row[spec.titleField] ?? "(untitled)")}
                    </Link>
                  </th>
                  {spec.listColumns.map((column) => (
                    <td
                      key={column.name}
                      className="hidden px-5 py-3 text-muted md:table-cell"
                    >
                      {formatCell(row[column.name])}
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <StatusBadge status={String(row.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between gap-4"
        >
          {data.page > 1 ? (
            <AdminButton
              tone="secondary"
              href={`/admin/${resource}?page=${data.page - 1}&status=${status}`}
            >
              Previous
            </AdminButton>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted">
            Page {data.page} of {data.totalPages}
          </p>
          {data.page < data.totalPages ? (
            <AdminButton
              tone="secondary"
              href={`/admin/${resource}?page=${data.page + 1}&status=${status}`}
            >
              Next
            </AdminButton>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDate(value);
  }
  return String(value);
}
