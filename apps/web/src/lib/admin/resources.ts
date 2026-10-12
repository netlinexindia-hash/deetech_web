import {
  adminBlogPostSchema,
  adminBrandSchema,
  adminPageSchema,
  adminProductSchema,
  adminServiceSchema,
} from "@deetech/shared-types/admin";
import {
  BRAND_RELATIONSHIP_LABELS,
  PRODUCT_LIFECYCLE_LABELS,
} from "@deetech/shared-types";
import type { AdminResourceSlug } from "@/lib/admin/registry";

/**
 * Field definitions for the CMS forms.
 *
 * Five content types with near-identical CRUD would otherwise be five
 * near-identical sets of pages. This registry describes each type's fields
 * once; the list and edit pages render from it.
 *
 * It describes **presentation only**. Validation lives in the shared Zod
 * schemas, which the server action and the API both enforce — nothing here
 * is relied on as a control.
 */

export type FieldKind =
  | "text"
  | "slug"
  | "textarea"
  | "markdown"
  | "number"
  | "select"
  | "status"
  | "datetime"
  | "media"
  | "points";

export interface FieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  /** Marked in the UI. The schema is what actually enforces it. */
  required?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
  /** Grouping, so a long form reads as sections rather than a wall. */
  section?: string;
}

export interface ResourceSpec {
  slug: AdminResourceSlug;
  label: string;
  singular: string;
  /** Column used as the row title in the list. */
  titleField: string;
  /** Extra columns shown in the list. */
  listColumns: { name: string; label: string }[];
  /** Public URL for a published record, for the "View" link. */
  publicPath: (row: Record<string, unknown>) => string | null;
  schema:
    | typeof adminPageSchema
    | typeof adminServiceSchema
    | typeof adminBrandSchema
    | typeof adminProductSchema
    | typeof adminBlogPostSchema;
  fields: FieldSpec[];
}

const SEO_FIELDS: FieldSpec[] = [
  {
    name: "seoTitle",
    label: "SEO title",
    kind: "text",
    section: "Search engines",
    hint: "Leave empty to use the title. The site name is appended automatically — do not include it. Google shows about 60 characters; longer is allowed and simply gets truncated.",
  },
  {
    name: "seoDescription",
    label: "Meta description",
    kind: "textarea",
    rows: 3,
    section: "Search engines",
    hint: "The snippet under the link in search results. Google shows about 155 characters; longer is allowed and simply gets truncated. Every page on the old site was missing this entirely.",
  },
];

const STATUS_FIELD: FieldSpec = {
  name: "status",
  label: "Status",
  kind: "status",
  section: "Publishing",
  hint: "Drafts are invisible on the public site and excluded from the sitemap.",
};

const SORT_FIELD: FieldSpec = {
  name: "sortOrder",
  label: "Sort order",
  kind: "number",
  section: "Publishing",
  hint: "Lower numbers appear first.",
};

const enumOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const RESOURCE_SPECS: Record<AdminResourceSlug, ResourceSpec> = {
  pages: {
    slug: "pages",
    label: "Pages",
    singular: "page",
    titleField: "title",
    listColumns: [{ name: "slug", label: "URL" }],
    publicPath: (row) => `/${row.slug as string}`,
    schema: adminPageSchema,
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      {
        name: "slug",
        label: "URL slug",
        kind: "slug",
        required: true,
        hint: "The address of the page, e.g. privacy-policy. Changing it on a published page breaks existing links.",
      },
      { name: "body", label: "Body", kind: "markdown", rows: 18 },
      STATUS_FIELD,
      ...SEO_FIELDS,
    ],
  },

  services: {
    slug: "services",
    label: "Services",
    singular: "service",
    titleField: "title",
    listColumns: [
      { name: "slug", label: "URL" },
      { name: "sortOrder", label: "Order" },
    ],
    publicPath: (row) => `/services/${row.slug as string}`,
    schema: adminServiceSchema,
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "slug", label: "URL slug", kind: "slug", required: true },
      {
        name: "summary",
        label: "Card summary",
        kind: "textarea",
        rows: 3,
        required: true,
        hint: "One sentence, shown on cards and the services index. Must be different from every other service — the old site used the same line on all six.",
      },
      {
        name: "intro",
        label: "Introduction",
        kind: "textarea",
        rows: 5,
        hint: "The opening paragraph of the service page.",
      },
      {
        name: "benefits",
        label: "Why choose us",
        kind: "points",
        hint: "Three blocks work best. Each needs a short title and a sentence or two.",
      },
      {
        name: "inclusions",
        label: "What is included",
        kind: "points",
        hint: "The deliverables, as a list.",
      },
      { name: "imageUrl", label: "Image URL", kind: "media", section: "Publishing" },
      STATUS_FIELD,
      SORT_FIELD,
      ...SEO_FIELDS,
    ],
  },

  brands: {
    slug: "brands",
    label: "Brands",
    singular: "brand",
    titleField: "name",
    listColumns: [
      { name: "slug", label: "URL" },
      { name: "relationshipType", label: "Relationship" },
    ],
    publicPath: (row) => `/brands/${row.slug as string}`,
    schema: adminBrandSchema,
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "slug", label: "URL slug", kind: "slug", required: true },
      {
        name: "relationshipType",
        label: "Relationship to DeeTech Group",
        kind: "select",
        required: true,
        options: enumOptions(BRAND_RELATIONSHIP_LABELS),
        hint: 'This is a factual claim about company structure and appears on the public page. Only choose "A subsidiary of DeeTech Group" if the brand is a separately incorporated company.',
      },
      { name: "tagline", label: "Tagline", kind: "text" },
      { name: "description", label: "Description", kind: "markdown", rows: 12 },
      { name: "logoUrl", label: "Logo", kind: "media", section: "Publishing" },
      {
        name: "websiteUrl",
        label: "Website",
        kind: "text",
        section: "Publishing",
        hint: "Include https://.",
      },
      STATUS_FIELD,
      SORT_FIELD,
      ...SEO_FIELDS,
    ],
  },

  products: {
    slug: "products",
    label: "Products",
    singular: "product",
    titleField: "name",
    listColumns: [
      { name: "slug", label: "URL" },
      { name: "lifecycle", label: "Lifecycle" },
    ],
    publicPath: (row) => `/products/${row.slug as string}`,
    schema: adminProductSchema,
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "slug", label: "URL slug", kind: "slug", required: true },
      {
        name: "brandId",
        label: "Brand",
        kind: "select",
        // Options are loaded from the API at render time.
        options: [],
        hint: "Leave empty if the product belongs to the group rather than to a brand.",
      },
      {
        name: "summary",
        label: "Card summary",
        kind: "textarea",
        rows: 3,
        required: true,
      },
      { name: "description", label: "Description", kind: "markdown", rows: 14 },
      {
        name: "lifecycle",
        label: "Lifecycle",
        kind: "select",
        required: true,
        options: enumOptions(PRODUCT_LIFECYCLE_LABELS),
        hint: "Separate from publishing: a product can be published and still be coming soon.",
      },
      { name: "websiteUrl", label: "Website", kind: "text", section: "Links" },
      {
        name: "documentationUrl",
        label: "Documentation",
        kind: "text",
        section: "Links",
      },
      { name: "downloadUrl", label: "Download", kind: "text", section: "Links" },
      STATUS_FIELD,
      SORT_FIELD,
      ...SEO_FIELDS,
    ],
  },

  blog: {
    slug: "blog",
    label: "Blog",
    singular: "article",
    titleField: "title",
    listColumns: [
      { name: "slug", label: "URL" },
      { name: "publishedAt", label: "Published" },
    ],
    publicPath: (row) => `/blog/${row.slug as string}`,
    schema: adminBlogPostSchema,
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "slug", label: "URL slug", kind: "slug", required: true },
      {
        name: "excerpt",
        label: "Excerpt",
        kind: "textarea",
        rows: 3,
        hint: "Shown on the blog index and used as the meta description if none is set.",
      },
      { name: "body", label: "Article", kind: "markdown", rows: 24 },
      {
        name: "authorName",
        label: "Author",
        kind: "text",
        required: true,
        section: "Publishing",
      },
      { name: "category", label: "Category", kind: "text", section: "Publishing" },
      {
        name: "featuredImage",
        label: "Featured image",
        kind: "media",
        section: "Publishing",
      },
      {
        name: "publishedAt",
        label: "Publication date",
        kind: "datetime",
        section: "Publishing",
        hint: "Leave empty to stamp now when you publish. Articles are ordered newest first.",
      },
      STATUS_FIELD,
      ...SEO_FIELDS,
    ],
  },
};

/** Field sections in the order they should appear. */
export function groupFields(fields: FieldSpec[]): [string, FieldSpec[]][] {
  const groups = new Map<string, FieldSpec[]>();
  for (const field of fields) {
    const key = field.section ?? "Content";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(field);
  }
  return [...groups.entries()];
}
