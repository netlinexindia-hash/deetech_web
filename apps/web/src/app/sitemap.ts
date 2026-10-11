import type { MetadataRoute } from "next";
import { getAllPosts, getBrands, getProducts, getServices } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

/**
 * XML sitemap, generated from published content.
 *
 * The current WordPress site advertises a sitemap in robots.txt that returns
 * 404 (SEO-1 in the Day 1 audit), so it effectively has none. This replaces
 * it, and because it reads through the content layer it can never list a
 * draft or a page that does not exist.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, brands, products, posts] = await Promise.all([
    getServices(),
    getBrands(),
    getProducts(),
    getAllPosts(),
  ]);

  const url = (path: string) => `${SITE_URL}${path}`;

  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "monthly", priority: 1 },
    { url: url("/services"), changeFrequency: "monthly", priority: 0.9 },
    { url: url("/about"), changeFrequency: "yearly", priority: 0.7 },
    { url: url("/contact"), changeFrequency: "yearly", priority: 0.8 },
    { url: url("/blog"), changeFrequency: "weekly", priority: 0.7 },
  ];

  // Listed only once they have something to show. An indexed empty directory
  // is a thin page, and there is no reason to invite a crawler to one.
  if (brands.length > 0) {
    staticPages.push({
      url: url("/brands"),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  if (products.length > 0) {
    staticPages.push({
      url: url("/products"),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return [
    ...staticPages,
    ...services.map((service) => ({
      url: url(`/services/${service.slug}`),
      lastModified: new Date(service.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...brands.map((brand) => ({
      url: url(`/brands/${brand.slug}`),
      lastModified: new Date(brand.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: url(`/products/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...posts.map((post) => ({
      url: url(`/blog/${post.slug}`),
      lastModified: new Date(post.updatedAt),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
