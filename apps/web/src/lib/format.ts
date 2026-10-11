/**
 * Dates are rendered with an explicit locale and time zone rather than the
 * runtime defaults. Without that, the server and the browser can format the
 * same timestamp differently and React reports a hydration mismatch — and the
 * container's clock is UTC while the audience is in IST.
 */
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
