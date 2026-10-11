import type {
  BlogPost,
  Brand,
  Page,
  Paginated,
  Product,
  Service,
} from "@deetech/shared-types";

/**
 * The content layer. Every page reads through this module and nothing else.
 *
 * As of Week 3 Day 13 these functions call the Express API. The signatures
 * and return types are unchanged from the Week 2 fixture implementation, so
 * no page component had to change — which was the point of introducing the
 * seam in the first place.
 *
 * Two rules still hold:
 *   1. Only `published` records are returned. That is now enforced in SQL,
 *      in the repository, so a forgetful caller cannot leak a draft.
 *   2. Everything is async.
 *
 * Failure policy: a list request that cannot reach the API returns an empty
 * list, and a detail request returns null, which the page renders as a 404 or
 * an empty state. The alternative — letting the error propagate — would turn
 * a brief API restart into a 500 on every page of the site. Every failure is
 * logged server-side.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

/** How long Next.js may serve a cached response before revalidating. */
const REVALIDATE_SECONDS = 300;

interface FetchOptions {
  /** Paths that must not be cached across requests. */
  revalidate?: number | false;
}

async function apiGet<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  const url = `${API_BASE_URL}${API_PREFIX}${path}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: options.revalidate ?? REVALIDATE_SECONDS },
      // Do not leave a page build hanging on an unresponsive API.
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      console.error(
        `[content] ${response.status} from ${path} — serving empty content`,
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(
      `[content] could not reach ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

interface ListResponse<T> {
  items: T[];
}

async function apiList<T>(path: string): Promise<T[]> {
  const body = await apiGet<ListResponse<T>>(path);
  return body?.items ?? [];
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export async function getServices(): Promise<Service[]> {
  return apiList<Service>("/services");
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  return apiGet<Service>(`/services/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function getBrands(): Promise<Brand[]> {
  return apiList<Brand>("/brands");
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  return apiGet<Brand>(`/brands/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  return apiList<Product>("/products");
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return apiGet<Product>(`/products/${encodeURIComponent(slug)}`);
}

export async function getProductsByBrand(brandId: number): Promise<Product[]> {
  return apiList<Product>(`/products?brandId=${brandId}`);
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function getPageBySlug(slug: string): Promise<Page | null> {
  return apiGet<Page>(`/pages/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export const POSTS_PER_PAGE = 9;

const EMPTY_PAGE: Paginated<BlogPost> = {
  items: [],
  page: 1,
  perPage: POSTS_PER_PAGE,
  total: 0,
  totalPages: 1,
};

export async function getPosts(page = 1): Promise<Paginated<BlogPost>> {
  const body = await apiGet<Paginated<BlogPost>>(
    `/blog?page=${page}&perPage=${POSTS_PER_PAGE}`,
  );
  return body ?? EMPTY_PAGE;
}

export async function getAllPosts(): Promise<BlogPost[]> {
  return apiList<BlogPost>("/blog/all");
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  return apiGet<BlogPost>(`/blog/${encodeURIComponent(slug)}`);
}
