import { PRODUCT_LIFECYCLE_LABELS, type ProductLifecycle } from "@deetech/shared-types";

/**
 * Where a product sits in its lifecycle.
 *
 * Each state has a distinct label as well as a distinct colour, so the
 * meaning survives for anyone who cannot distinguish the colours — colour is
 * never the only carrier of meaning (design system rule 5).
 */
const styles: Record<ProductLifecycle, string> = {
  available: "border-accent-600/25 bg-accent-600/8 text-accent-800",
  beta: "border-brand-700/25 bg-brand-700/8 text-brand-900",
  coming_soon: "border-navy-300 bg-navy-50 text-navy-700",
};

export function LifecycleBadge({ lifecycle }: { lifecycle: ProductLifecycle }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[lifecycle]}`}
    >
      {PRODUCT_LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}
