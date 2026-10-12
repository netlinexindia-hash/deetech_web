import type { Metadata } from "next";
import type { MediaItem, Paginated } from "@deetech/shared-types";
import { deleteMedia } from "@/app/admin/media-actions";
import { CopyableUrl } from "@/components/admin/CopyableUrl";
import { MediaUploadForm } from "@/components/admin/MediaUploadForm";
import { AdminPageHeader, EmptyRow, Notice } from "@/components/admin/ui";
import { adminFetch, currentUser } from "@/lib/admin/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Media" };

interface Props {
  searchParams: Promise<{
    page?: string;
    uploaded?: string;
    deleted?: string;
    error?: string;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export default async function AdminMediaPage({ searchParams }: Props) {
  const query = await searchParams;
  const page = Number.parseInt(query.page ?? "1", 10) || 1;

  const [data, limits, user] = await Promise.all([
    adminFetch<Paginated<MediaItem>>(`/admin/media?page=${page}&perPage=24`),
    adminFetch<{ mimeTypes: string[]; maxBytes: number }>("/admin/media/allowed-types"),
    currentUser(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Media"
        lead={`${data.total} ${data.total === 1 ? "file" : "files"}. Every upload needs alt text — screen readers read it out, and search engines use it.`}
      />

      {query.uploaded ? <Notice tone="success">Uploaded.</Notice> : null}
      {query.deleted ? (
        <Notice tone="success">
          Removed from the library. The file itself is kept, in case published content
          still points at it.
        </Notice>
      ) : null}
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}

      <div className="mb-8 rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="text-h3">Upload a file</h2>
        <p className="mt-2 text-sm text-muted">
          Accepted: {limits.mimeTypes.join(", ")}. Up to {formatBytes(limits.maxBytes)}.
        </p>
        <div className="mt-5">
          <MediaUploadForm accept={limits.mimeTypes.join(",")} />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyRow message="No files yet." />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-card"
            >
              <div className="flex aspect-video items-center justify-center bg-surface-subtle">
                {item.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.altText}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-sm font-semibold text-muted">
                    {item.mimeType}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <p
                  className="truncate text-sm font-semibold text-navy-900"
                  title={item.fileName}
                >
                  {item.fileName}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatBytes(item.sizeBytes)}
                  {item.width && item.height
                    ? ` · ${item.width}×${item.height}`
                    : ""} · {formatDate(item.createdAt)}
                </p>
                <p className="mt-2 flex-1 text-sm text-body">{item.altText}</p>

                <CopyableUrl url={item.url} />

                {user?.role === "admin" ? (
                  <form action={deleteMedia.bind(null, item.id)} className="mt-3">
                    <button
                      type="submit"
                      className="inline-flex min-h-9 items-center rounded-lg border border-danger px-3 text-xs font-semibold text-danger hover:bg-danger/5"
                    >
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
