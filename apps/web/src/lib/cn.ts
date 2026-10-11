/**
 * Minimal class-name joiner. Deliberately not `clsx` + `tailwind-merge`:
 * the component set is small and every variant is authored so that classes
 * do not conflict, so two extra runtime dependencies would not earn their place.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
