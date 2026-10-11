import type {
  BlogPost,
  Brand,
  Paginated,
  Product,
  Service,
} from "@deetech/shared-types";
import { services as serviceFixtures } from "./fixtures/services";
import {
  brands as brandFixtures,
  products as productFixtures,
} from "./fixtures/brands";
import { posts as postFixtures } from "./fixtures/posts";

/**
 * The content layer. Every page reads through this module and nothing else.
 *
 * Right now it serves checked-in fixtures. In Week 3 (Day 13) the bodies of
 * these functions are replaced with `fetch` calls to the Express API — the
 * signatures, the return types and the published-only filtering stay exactly
 * as they are, so no page component has to change.
 *
 * Two rules that hold in both implementations:
 *   1. Only `published` records are ever returned. Draft content must not
 *      leak through a public route.
 *   2. Everything is async, even though the fixtures are synchronous, so
 *      swapping in a network call later is not a breaking change.
 */

/** Deliberately not exported — callers must go through the helpers below. */
function published<T extends { status: string }>(items: T[]): T[] {
  return items.filter((item) => item.status === "published");
}

function bySortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export async function getServices(): Promise<Service[]> {
  return bySortOrder(published(serviceFixtures));
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const match = published(serviceFixtures).find((item) => item.slug === slug);
  return match ?? null;
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function getBrands(): Promise<Brand[]> {
  return bySortOrder(published(brandFixtures));
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const match = published(brandFixtures).find((item) => item.slug === slug);
  return match ?? null;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  return bySortOrder(published(productFixtures));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const match = published(productFixtures).find((item) => item.slug === slug);
  return match ?? null;
}

export async function getProductsByBrand(brandId: number): Promise<Product[]> {
  return bySortOrder(published(productFixtures)).filter(
    (item) => item.brandId === brandId,
  );
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export const POSTS_PER_PAGE = 9;

function publishedPosts(): BlogPost[] {
  return published(postFixtures)
    .filter((post) => post.publishedAt !== null)
    .sort((a, b) => (a.publishedAt! < b.publishedAt! ? 1 : -1));
}

export async function getPosts(page = 1): Promise<Paginated<BlogPost>> {
  const all = publishedPosts();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * POSTS_PER_PAGE;

  return {
    items: all.slice(start, start + POSTS_PER_PAGE),
    page: safePage,
    perPage: POSTS_PER_PAGE,
    total,
    totalPages,
  };
}

export async function getAllPosts(): Promise<BlogPost[]> {
  return publishedPosts();
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const match = publishedPosts().find((post) => post.slug === slug);
  return match ?? null;
}
