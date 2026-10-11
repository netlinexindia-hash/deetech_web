import { z } from "zod";

/**
 * Shared API contract between the Express API (`@deetech/api`) and the
 * Next.js app (`@deetech/web`).
 *
 * These types describe what the **public** API returns. Admin-only fields
 * (for example `password_hash`) never appear here.
 *
 * The data model is specified in `docs/02-sitemap-and-design-system.md`.
 */

/** Publication state. The public API returns `published` records only. */
export type PublicationStatus = "draft" | "published";

/**
 * How a brand relates to DeeTech Group.
 *
 * This is deliberately an enum rather than free text so the legal wording
 * lives in exactly one place (`brandRelationshipLabel`).
 *
 * `subsidiary` asserts a separately incorporated company. Do not select it
 * for a brand unless that is true and documented — the project plan forbids
 * claiming it otherwise. AnPreD is `product_brand`, confirmed by the owner
 * on 2026-10-11.
 */
export type BrandRelationshipType =
  "product_brand" | "division" | "subsidiary" | "partner" | "portfolio_company";

export const BRAND_RELATIONSHIP_LABELS: Record<BrandRelationshipType, string> = {
  product_brand: "A product brand by DeeTech Group",
  division: "A division of DeeTech Group",
  subsidiary: "A subsidiary of DeeTech Group",
  partner: "A DeeTech Group partner",
  portfolio_company: "Part of the DeeTech Group portfolio",
};

export function brandRelationshipLabel(type: BrandRelationshipType): string {
  return BRAND_RELATIONSHIP_LABELS[type];
}

/** Where a product sits in its lifecycle. Separate from publication state. */
export type ProductLifecycle = "available" | "beta" | "coming_soon";

export const PRODUCT_LIFECYCLE_LABELS: Record<ProductLifecycle, string> = {
  available: "Available",
  beta: "Beta",
  coming_soon: "Coming soon",
};

/** Fields every public content type carries for search engines. */
export interface SeoFields {
  /**
   * Page title WITHOUT the site name. The frontend appends " | DeeTech Group"
   * via the Next.js metadata template, so including it here produces a
   * doubled suffix. Falls back to the record's own title when null.
   */
  seoTitle: string | null;
  /** Meta description. Falls back to the record's summary/excerpt when null. */
  seoDescription: string | null;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface Page extends SeoFields, Timestamps {
  id: number;
  title: string;
  slug: string;
  body: string;
  status: PublicationStatus;
  publishedAt: string | null;
}

/** A "why choose us" block, or an item in a service's inclusions list. */
export interface ServicePoint {
  title: string;
  body: string;
}

export interface Service extends SeoFields, Timestamps {
  id: number;
  title: string;
  slug: string;
  /** One-line card description. Must be unique per service. */
  summary: string;
  /**
   * Lead paragraph of the service page.
   *
   * Services use structured fields rather than one free-text Markdown body:
   * every service page on the legacy site shares the same shape, the template
   * is fixed, and discrete fields keep the CMS editor honest about it.
   */
  intro: string;
  /** Three "why choose DeeTech Group for X" blocks. */
  benefits: ServicePoint[];
  /** What the engagement includes. */
  inclusions: ServicePoint[];
  imageUrl: string | null;
  status: PublicationStatus;
  sortOrder: number;
}

export interface Brand extends SeoFields, Timestamps {
  id: number;
  name: string;
  slug: string;
  relationshipType: BrandRelationshipType;
  tagline: string | null;
  description: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  status: PublicationStatus;
  sortOrder: number;
}

export interface Product extends SeoFields, Timestamps {
  id: number;
  brandId: number | null;
  name: string;
  slug: string;
  summary: string;
  description: string;
  websiteUrl: string | null;
  documentationUrl: string | null;
  downloadUrl: string | null;
  lifecycle: ProductLifecycle;
  status: PublicationStatus;
  sortOrder: number;
}

export interface BlogPost extends SeoFields, Timestamps {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  authorName: string;
  category: string | null;
  featuredImage: string | null;
  status: PublicationStatus;
  publishedAt: string | null;
}

export interface MediaItem {
  id: number;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /** Required at upload time. See SEO-4 in the Day 1 audit. */
  altText: string;
  createdAt: string;
}

/**
 * The payload accepted by `POST /api/v1/enquiries`.
 *
 * Defined as a Zod schema, not just a type, so the Next.js server action and
 * the Express route validate against the identical rules. Client-side
 * validation is a convenience; this schema is the control, and it runs on the
 * server on both sides.
 */
export const enquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
  email: z
    .email("Please enter a valid email address.")
    .max(254, "Email must be 254 characters or fewer."),
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(32, "Phone must be 32 characters or fewer.")
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .trim()
    .min(3, "Please tell us what this is about.")
    .max(150, "Subject must be 150 characters or fewer."),
  message: z
    .string()
    .trim()
    .min(20, "Please give us at least a couple of sentences.")
    .max(5000, "Message must be 5000 characters or fewer."),
  /** Path of the page the form was submitted from, for attribution. */
  sourcePage: z.string().max(200).optional(),
  /**
   * Honeypot. Real users never see this field, so anything in it is a bot.
   *
   * Validation is deliberately permissive here. Rejecting a non-empty value
   * as a *validation error* would hand the bot a distinguishable response it
   * could tune against, and would show a real user a "check the highlighted
   * fields" message pointing at a field they cannot see. The caller accepts
   * the submission silently and discards it instead — see `isLikelySpam`.
   */
  website: z.string().max(200).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

/**
 * True when a submission filled the honeypot field.
 *
 * Callers must accept such a submission with a normal success response and
 * then drop it, so the bot cannot tell rejection from acceptance. Used by
 * both the Next.js server action and the Express route.
 */
export function isLikelySpam(input: EnquiryInput): boolean {
  return Boolean(input.website && input.website.trim().length > 0);
}

export type EnquiryStatus = "new" | "read" | "replied" | "spam";

/** Standard envelope for a paginated list response. */
export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * Every non-2xx API response has this shape. `code` is stable and safe to
 * branch on; `message` is for humans and may change.
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    /** Field-level validation problems, keyed by field path. */
    details?: Record<string, string[]>;
  };
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  uptimeSeconds: number;
  checks: {
    database: "ok" | "unavailable" | "not_configured";
  };
}

/** Slugs that may never be used by a CMS record, because routes own them. */
export const RESERVED_SLUGS: readonly string[] = [
  "about",
  "admin",
  "api",
  "blog",
  "brands",
  "contact",
  "products",
  "robots.txt",
  "services",
  "sitemap.xml",
];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.includes(slug);
}
