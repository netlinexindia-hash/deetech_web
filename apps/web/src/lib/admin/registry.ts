/**
 * The resources the CMS manages.
 *
 * A plain module, deliberately NOT marked "use client": a server component
 * importing a non-component value from a client module receives a client
 * reference proxy rather than the value itself, so `ADMIN_RESOURCES.map`
 * would fail at runtime. The nav imports this; so does everything else.
 *
 * `slug` matches the API's `:resource` segment, so one registry drives the
 * navigation, the routes and the API calls.
 */
export const ADMIN_RESOURCES = [
  { slug: "pages", label: "Pages", singular: "page" },
  { slug: "services", label: "Services", singular: "service" },
  { slug: "brands", label: "Brands", singular: "brand" },
  { slug: "products", label: "Products", singular: "product" },
  { slug: "blog", label: "Blog", singular: "article" },
] as const;

export type AdminResourceSlug = (typeof ADMIN_RESOURCES)[number]["slug"];

export function isAdminResource(value: string): value is AdminResourceSlug {
  return ADMIN_RESOURCES.some((resource) => resource.slug === value);
}
