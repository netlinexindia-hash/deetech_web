import { PRODUCT_LIFECYCLE_LABELS, type ProductLifecycle } from "@deetech/shared-types";

/**
 * Where a product sits in its lifecycle.
 *
 * Each state has a distinct label as well as a distinct colour, so the
 * meaning survives for anyone who cannot distinguish the colours — colour is
 * never the only carrier of meaning (design system rule 5).
 *
 * The badge is a solid fill with white text rather than a translucent tint.
 * A tint takes its contrast from whatever is behind it, and this badge
 * appears both on white cards and on the navy page header — the tinted
 * version measured 2.4:1 on navy. A solid fill is legible on any surface.
 */
const styles: Record<ProductLifecycle, string> = {
  // White on each of these is at least 4.5:1.
  available: "bg-accent-700", // #C21A79 — 5.65:1
  beta: "bg-brand-700", // #007DB3 — 4.58:1
  coming_soon: "bg-navy-700", // #2B3972 — well above
};

export function LifecycleBadge({ lifecycle }: { lifecycle: ProductLifecycle }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white ${styles[lifecycle]}`}
    >
      {PRODUCT_LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}
