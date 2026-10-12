import type { Metadata } from "next";
import Link from "next/link";
import type { Paginated } from "@deetech/shared-types";
import { AdminButton, AdminPageHeader, EmptyRow } from "@/components/admin/ui";
import { EnquiryStatusBadge } from "@/components/admin/EnquiryStatusBadge";
import { adminFetch } from "@/lib/admin/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Enquiries" };

interface EnquiryRecord {
  id: number;
  name: string;
  email: string;
  company: string | null;
  subject: string;
  status: "new" | "read" | "replied" | "spam";
  createdAt: string;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "spam", label: "Spam" },
];

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const query = await searchParams;
  const page = Number.parseInt(query.page ?? "1", 10) || 1;
  const status = FILTERS.some((f) => f.value === query.status) ? query.status! : "all";

  const data = await adminFetch<Paginated<EnquiryRecord>>(
    `/admin/enquiries?page=${page}&perPage=25&status=${status}`,
  );

  return (
    <>
      <AdminPageHeader
        title="Enquiries"
        lead="Everything submitted through the contact form. Content is read-only — only the status can change."
      />

      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-white p-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/enquiries?status=${filter.value}`}
            aria-current={status === filter.value ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded px-3 text-sm font-medium ${
              status === filter.value
                ? "bg-brand-700 text-white"
                : "text-navy-800 hover:bg-brand-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <EmptyRow message="No enquiries match that filter." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <table className="w-full text-left text-[0.9375rem]">
            <caption className="sr-only">
              Enquiries, page {data.page} of {data.totalPages}
            </caption>
            <thead className="border-b border-border bg-surface-subtle">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold text-navy-900">
                  From
                </th>
                <th
                  scope="col"
                  className="hidden px-5 py-3 font-semibold text-navy-900 md:table-cell"
                >
                  Subject
                </th>
                <th
                  scope="col"
                  className="hidden px-5 py-3 font-semibold text-navy-900 sm:table-cell"
                >
                  Received
                </th>
                <th scope="col" className="px-5 py-3 font-semibold text-navy-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  className="border-b border-border last:border-0 hover:bg-surface-subtle"
                >
                  <th scope="row" className="px-5 py-3 font-medium">
                    <Link
                      href={`/admin/enquiries/${enquiry.id}`}
                      className="text-brand-800 underline underline-offset-4"
                    >
                      {enquiry.name}
                    </Link>
                    <span className="block text-xs font-normal text-muted">
                      {enquiry.company ?? enquiry.email}
                    </span>
                  </th>
                  <td className="hidden px-5 py-3 text-body md:table-cell">
                    {enquiry.subject}
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">
                    <time dateTime={enquiry.createdAt}>
                      {formatDate(enquiry.createdAt)}
                    </time>
                  </td>
                  <td className="px-5 py-3">
                    <EnquiryStatusBadge status={enquiry.status} />
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
              href={`/admin/enquiries?page=${data.page - 1}&status=${status}`}
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
              href={`/admin/enquiries?page=${data.page + 1}&status=${status}`}
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
