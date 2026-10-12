import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { EnquiryStatus } from "@deetech/shared-types";
import { setEnquiryStatus } from "@/app/admin/enquiry-actions";
import { EnquiryStatusBadge } from "@/components/admin/EnquiryStatusBadge";
import { AdminCard, AdminPageHeader, Notice } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin/api";

export const metadata: Metadata = { title: "Enquiry" };

interface EnquiryRecord {
  id: number;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  subject: string;
  message: string;
  sourcePage: string | null;
  status: EnquiryStatus;
  createdAt: string;
}

const NEXT_STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: "read", label: "Mark as read" },
  { value: "replied", label: "Mark as replied" },
  { value: "spam", label: "Mark as spam" },
  { value: "new", label: "Mark as new" },
];

export default async function AdminEnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId) || numericId < 1) notFound();

  const query = await searchParams;
  const enquiry = await adminFetch<EnquiryRecord>(
    `/admin/enquiries/${numericId}`,
  ).catch(() => null);

  if (!enquiry) notFound();

  const received = new Date(enquiry.createdAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <>
      <AdminPageHeader
        title={enquiry.subject}
        lead={`From ${enquiry.name} · ${received}`}
        action={
          <Link
            href="/admin/enquiries"
            className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-brand-800 underline underline-offset-4"
          >
            Back to the inbox
          </Link>
        }
      />

      {query.updated ? <Notice tone="success">Status updated.</Notice> : null}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-5 py-4 shadow-card">
        <EnquiryStatusBadge status={enquiry.status} />
        {NEXT_STATUSES.filter((option) => option.value !== enquiry.status).map(
          (option) => (
            <form
              key={option.value}
              action={setEnquiryStatus.bind(null, enquiry.id, option.value)}
            >
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
              >
                {option.label}
              </button>
            </form>
          ),
        )}

        <a
          href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: ${enquiry.subject}`)}`}
          className="ml-auto inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Reply by email
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <AdminCard>
          <h2 className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
            Message
          </h2>
          {/* Rendered as plain text, never as markup. This is untrusted
              input from a public form — the only safe way to show it. */}
          <p className="mt-4 whitespace-pre-wrap text-body">{enquiry.message}</p>
        </AdminCard>

        <AdminCard>
          <h2 className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
            Contact
          </h2>
          <dl className="mt-4 space-y-4 text-[0.9375rem]">
            <div>
              <dt className="font-semibold text-navy-900">Name</dt>
              <dd className="mt-0.5 text-body">{enquiry.name}</dd>
            </div>
            <div>
              <dt className="font-semibold text-navy-900">Email</dt>
              <dd className="mt-0.5">
                <a
                  href={`mailto:${enquiry.email}`}
                  className="break-all text-brand-800 underline underline-offset-4"
                >
                  {enquiry.email}
                </a>
              </dd>
            </div>
            {enquiry.company ? (
              <div>
                <dt className="font-semibold text-navy-900">Company</dt>
                <dd className="mt-0.5 text-body">{enquiry.company}</dd>
              </div>
            ) : null}
            {enquiry.phone ? (
              <div>
                <dt className="font-semibold text-navy-900">Phone</dt>
                <dd className="mt-0.5">
                  <a
                    href={`tel:${enquiry.phone.replace(/[^+\d]/g, "")}`}
                    className="text-brand-800 underline underline-offset-4"
                  >
                    {enquiry.phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {enquiry.sourcePage ? (
              <div>
                <dt className="font-semibold text-navy-900">Submitted from</dt>
                <dd className="mt-0.5 font-mono text-sm text-body">
                  {enquiry.sourcePage}
                </dd>
              </div>
            ) : null}
          </dl>
        </AdminCard>
      </div>
    </>
  );
}
