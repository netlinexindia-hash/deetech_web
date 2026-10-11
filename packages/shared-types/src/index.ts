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
 * lives in exactly one place (`brandRelationshipLabel`). Do not select
 * `subsidiary` unless the ownership structure supports it in writing.
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
  seoTitle: string | null;
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

export interface Service extends SeoFields, Timestamps {
  id: number;
  title: string;
  slug: string;
  /** One-line card description. Must be unique per service. */
  summary: string;
  /** Markdown body. */
  description: string;
  imageUrl: string | null;
  icon: string | null;
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

/** The payload accepted by `POST /api/v1/enquiries`. */
export interface EnquiryInput {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject: string;
  message: string;
  /** Path of the page the form was submitted from, for attribution. */
  sourcePage?: string;
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
