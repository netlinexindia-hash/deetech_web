"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import type { MediaItem, Paginated } from "@deetech/shared-types";
import { fetchMediaPage } from "@/app/admin/media-browse-action";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

/** Inline preview shown beside the current field value. */
function CurrentPreview({ url, onClear }: { url: string; onClear: () => void }) {
  const isImage = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url);
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-16 w-16 shrink-0 rounded object-contain" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border bg-white font-mono text-xs text-muted">
          file
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy-900">{url}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-danger hover:text-danger"
      >
        Clear
      </button>
    </div>
  );
}

/** A single media card inside the picker dialog. */
function PickerCard({
  item,
  onSelect,
}: {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}) {
  const isImage = item.mimeType.startsWith("image/");
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white text-left transition-all hover:border-brand-700 hover:shadow-card-hover focus-visible:border-brand-700"
    >
      <div className="flex aspect-video items-center justify-center bg-surface-subtle">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.altText}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-xs font-semibold text-muted">{item.mimeType}</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-xs font-semibold text-navy-900 group-hover:text-brand-800">
          {item.fileName}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {formatBytes(item.sizeBytes)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
        </p>
      </div>
    </button>
  );
}

/** Pagination strip shown at the bottom of the dialog. */
function PickerPagination({
  total,
  page,
  perPage,
  onPage,
}: {
  total: number;
  page: number;
  perPage: number;
  onPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="inline-flex min-h-9 items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40"
      >
        ← Previous
      </button>
      <span className="text-sm text-muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="inline-flex min-h-9 items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface MediaPickerFieldProps {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Initial value, e.g. from the record being edited. */
  initialValue?: string;
  errors?: string[];
}

/**
 * A form field for `kind: "media"`.
 *
 * Renders a hidden <input> so the value is included in any parent <form>
 * submission unchanged. Provides:
 *   - Current selection preview (image thumbnail or filename)
 *   - "Choose from library" button → opens a <dialog> with the media library
 *   - Clear button to unset the value
 *
 * The browser never talks to the API directly. `fetchMediaPage` is a server
 * action that forwards the request with the session cookie server-side.
 */
export function MediaPickerField({
  name,
  label,
  hint,
  required,
  initialValue,
  errors,
}: MediaPickerFieldProps) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [dialogData, setDialogData] = useState<Paginated<MediaItem> | null>(null);
  const [dialogPage, setDialogPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);
  const PER_PAGE = 24;

  const loadPage = useCallback((page: number) => {
    setLoadError(null);
    startTransition(async () => {
      try {
        const data = await fetchMediaPage(page, PER_PAGE);
        setDialogData(data);
        setDialogPage(page);
      } catch {
        setLoadError("Could not load the media library. Please try again.");
      }
    });
  }, []);

  const openDialog = () => {
    dialogRef.current?.showModal();
    if (!dialogData) loadPage(1);
  };

  const closeDialog = () => dialogRef.current?.close();

  const handleSelect = (item: MediaItem) => {
    setValue(item.url);
    closeDialog();
  };

  return (
    <div>
      {/* Label */}
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>

      {/* Hidden input — this is what the parent form submits */}
      <input
        id={id}
        type="hidden"
        name={name}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") ||
          undefined
        }
      />

      {/* Current selection or empty placeholder */}
      {value ? (
        <CurrentPreview url={value} onClear={() => setValue("")} />
      ) : (
        <div className="mt-1.5 rounded-lg border border-dashed border-navy-200 bg-surface-subtle px-4 py-3 text-sm text-muted">
          No file selected.
        </div>
      )}

      {/* Open picker button */}
      <button
        type="button"
        onClick={openDialog}
        className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-navy-200 bg-white px-3.5 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
      >
        <svg
          aria-hidden="true"
          className="size-4 text-navy-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5V19a1 1 0 001 1h16a1 1 0 001-1v-2.5M16 7l-4-4-4 4M12 3v13"
          />
        </svg>
        Choose from library
      </button>

      {hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {invalid ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger">
          {errors?.join(" ")}
        </p>
      ) : null}

      {/* ── Media library dialog ── */}
      {/* 
        Native <dialog> gives us free focus-trap, Escape-to-close, and
        ::backdrop, without importing a dependency.
      */}
      <dialog
        ref={dialogRef}
        aria-label="Choose a file from the media library"
        onClick={(e) => {
          // Close when the backdrop (the dialog element itself, not its children) is clicked
          if (e.target === dialogRef.current) closeDialog();
        }}
        className="m-auto max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-white p-0 shadow-overlay backdrop:bg-navy-950/40 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        {/* Dialog header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-h3">Media library</h2>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-navy-200 text-navy-700 hover:border-danger hover:text-danger"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Dialog body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isPending ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted">
              Loading…
            </div>
          ) : loadError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-4">
              <p className="text-sm font-medium text-danger">{loadError}</p>
              <button
                type="button"
                onClick={() => loadPage(dialogPage)}
                className="inline-flex min-h-9 items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-800 hover:bg-brand-50"
              >
                Retry
              </button>
            </div>
          ) : !dialogData || dialogData.items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <p className="text-body">No files uploaded yet.</p>
              <p className="text-sm text-muted">
                Upload files on the{" "}
                <a
                  href="/admin/media"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-800 underline underline-offset-2"
                >
                  Media page
                </a>{" "}
                and come back.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {dialogData.items.map((item) => (
                <PickerCard key={item.id} item={item} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {dialogData && !isPending && !loadError ? (
          <PickerPagination
            total={dialogData.total}
            page={dialogPage}
            perPage={PER_PAGE}
            onPage={loadPage}
          />
        ) : null}
      </dialog>
    </div>
  );
}
