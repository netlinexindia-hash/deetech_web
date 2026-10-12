import { z } from "zod";
import { RESERVED_SLUGS, SLUG_PATTERN } from "./index.js";

/**
 * Write schemas for the admin CMS.
 *
 * Shared on purpose: the Express routes parse request bodies with these, and
 * the Next.js server actions parse form submissions with the same objects.
 * One definition means the form and the endpoint cannot drift apart, and the
 * endpoint keeps working as a control even if the form is bypassed entirely.
 */

const trimmed = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer.`);

/** A slug the CMS may assign: well-formed, and not one a route already owns. */
export const slugField = z
  .string()
  .trim()
  .min(1, "A slug is required.")
  .max(200)
  .regex(
    SLUG_PATTERN,
    "Use lowercase letters, numbers and single hyphens — for example my-new-page.",
  )
  .refine((value) => !RESERVED_SLUGS.includes(value), {
    message: `That slug is reserved by a route. Reserved: ${RESERVED_SLUGS.join(", ")}.`,
  });

export const statusField = z.enum(["draft", "published"]);

/**
 * Optional URL. "" from a form field means "not set" and normalises to null.
 *
 * `null` is accepted as INPUT as well as produced as output, which matters:
 * the Next.js server action validates a submission and then sends the
 * transformed result to the API, which validates it again. If these schemas
 * were not idempotent — if they rejected their own output — every save with
 * an empty optional field would pass in the browser and fail at the API.
 * They are, and there is a test for it.
 */
const optionalUrl = (message: string) =>
  z
    .union([z.literal(""), z.null(), z.url({ protocol: /^https?$/, error: message })])
    .optional()
    .transform((value) => (value ? value : null));

/** Optional free text that normalises "" and null alike to null. */
const optionalText = (max: number) =>
  z
    .union([trimmed(max), z.null()])
    .optional()
    .transform((value) => (value ? value : null));

/**
 * SEO fields every content type carries.
 *
 * The caps here are defensive bounds, NOT the recommended lengths. A search
 * engine truncates a long description; it does not reject the page. Making
 * ~155 characters a hard validation error would block an editor from saving
 * a 160-character description that is perfectly fine — and it did exactly
 * that to the seeded copy, which was 182. The recommended lengths live in
 * the form hints, where they belong.
 */
const seoFields = {
  seoTitle: optionalText(150),
  seoDescription: optionalText(320),
};

export const adminPageSchema = z.object({
  title: trimmed(200).min(2, "A title is required."),
  slug: slugField,
  body: trimmed(100_000),
  status: statusField,
  ...seoFields,
});
export type AdminPageInput = z.infer<typeof adminPageSchema>;

export const servicePointSchema = z.object({
  title: trimmed(120).min(2, "Each point needs a title."),
  body: trimmed(2_000).min(2, "Each point needs a description."),
});

export const adminServiceSchema = z.object({
  title: trimmed(200).min(2, "A title is required."),
  slug: slugField,
  // The legacy site shipped one identical sentence on all six service cards
  // (CQ-3). The database has a unique index on this column; the minimum here
  // is just to stop a one-word placeholder.
  summary: trimmed(400).min(20, "A summary of at least 20 characters is required."),
  intro: trimmed(4_000),
  benefits: z.array(servicePointSchema).max(12),
  inclusions: z.array(servicePointSchema).max(24),
  imageUrl: optionalUrl("Enter a valid image URL."),
  status: statusField,
  sortOrder: z.coerce.number().int().min(0).max(9_999),
  ...seoFields,
});
export type AdminServiceInput = z.infer<typeof adminServiceSchema>;

export const adminBrandSchema = z.object({
  name: trimmed(200).min(2, "A name is required."),
  slug: slugField,
  /**
   * A factual claim about company structure. Constrained to the five allowed
   * values so the displayed wording is always derived from the enum, never
   * typed by hand.
   */
  relationshipType: z.enum([
    "product_brand",
    "division",
    "subsidiary",
    "partner",
    "portfolio_company",
  ]),
  tagline: optionalText(200),
  description: trimmed(20_000),
  logoUrl: optionalText(500),
  websiteUrl: optionalUrl("Enter a valid website URL, including https://."),
  status: statusField,
  sortOrder: z.coerce.number().int().min(0).max(9_999),
  ...seoFields,
});
export type AdminBrandInput = z.infer<typeof adminBrandSchema>;

export const adminProductSchema = z.object({
  /** Empty means the product belongs to the group rather than to a brand. */
  brandId: z
    .union([z.literal(""), z.null(), z.coerce.number().int().positive()])
    .optional()
    .transform((value) =>
      value === "" || value === null || value === undefined ? null : value,
    ),
  name: trimmed(200).min(2, "A name is required."),
  slug: slugField,
  summary: trimmed(400).min(20, "A summary of at least 20 characters is required."),
  description: trimmed(20_000),
  websiteUrl: optionalUrl("Enter a valid website URL, including https://."),
  documentationUrl: optionalUrl("Enter a valid documentation URL."),
  downloadUrl: optionalUrl("Enter a valid download URL."),
  lifecycle: z.enum(["available", "beta", "coming_soon"]),
  status: statusField,
  sortOrder: z.coerce.number().int().min(0).max(9_999),
  ...seoFields,
});
export type AdminProductInput = z.infer<typeof adminProductSchema>;

export const adminBlogPostSchema = z.object({
  title: trimmed(200).min(2, "A title is required."),
  slug: slugField,
  excerpt: trimmed(500),
  body: trimmed(200_000),
  authorName: trimmed(120).min(2, "An author name is required."),
  category: optionalText(80),
  featuredImage: optionalText(500),
  status: statusField,
  /**
   * ISO date-time, or empty.
   *
   * The database refuses a published row with no publication date, so the
   * API fills this with "now" when an editor publishes without choosing one —
   * see `resolvePublishedAt`. Rejecting the save instead would be a worse
   * experience for the common case of "publish this now".
   */
  publishedAt: z
    .union([
      z.literal(""),
      z.null(),
      z.iso.datetime({ offset: true, local: true }),
      z.iso.datetime(),
    ])
    .optional()
    .transform((value) => (value ? value : null)),
  ...seoFields,
});
export type AdminBlogPostInput = z.infer<typeof adminBlogPostSchema>;

/**
 * Decides the publication timestamp for a save.
 *
 * Publishing with no date set stamps now. Returning to draft keeps whatever
 * date was there, so unpublishing and republishing does not silently move an
 * article to the top of the blog.
 */
export function resolvePublishedAt(
  status: "draft" | "published",
  requested: string | null,
  existing: string | null,
): string | null {
  if (requested) return requested;
  if (existing) return existing;
  return status === "published" ? new Date().toISOString() : null;
}

export const adminMediaSchema = z.object({
  /**
   * Required, with no default. Every one of the 53 media items on the legacy
   * site has empty alt text (SEO-4); the column is NOT NULL and this is the
   * matching rule at the edge, so an upload cannot skip it.
   */
  altText: z
    .string({ error: "Describe the image. This is what a screen reader reads out." })
    .trim()
    .min(3, "Describe the image. This is what a screen reader reads out.")
    .max(300, "Alt text must be 300 characters or fewer."),
});
export type AdminMediaInput = z.infer<typeof adminMediaSchema>;

export const adminEnquiryStatusSchema = z.object({
  status: z.enum(["new", "read", "replied", "spam"]),
});

/** Query parameters accepted by the admin list endpoints. */
export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["draft", "published", "all"]).default("all"),
  q: z.string().trim().max(200).optional(),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export interface DashboardCounts {
  services: { published: number; draft: number };
  brands: { published: number; draft: number };
  products: { published: number; draft: number };
  pages: { published: number; draft: number };
  blogPosts: { published: number; draft: number };
  media: number;
  enquiries: { new: number; total: number };
}
