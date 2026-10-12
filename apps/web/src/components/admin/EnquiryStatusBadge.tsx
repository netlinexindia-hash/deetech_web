import type { EnquiryStatus } from "@deetech/shared-types";

/** Solid fills with white text, so each is legible and distinguishable. */
const STYLES: Record<EnquiryStatus, { className: string; label: string }> = {
  new: { className: "bg-accent-700 text-white", label: "New" },
  read: { className: "bg-brand-700 text-white", label: "Read" },
  replied: { className: "bg-navy-700 text-white", label: "Replied" },
  spam: { className: "bg-navy-200 text-navy-800", label: "Spam" },
};

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}
