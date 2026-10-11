import { Router } from "express";
import { z } from "zod";
import { SLUG_PATTERN } from "@deetech/shared-types";
import { notFound } from "../errors.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { ContentRepository } from "../repositories/content.js";

/**
 * Public, read-only content endpoints.
 *
 * Nothing here is authenticated, and nothing here returns a draft — the
 * repository enforces that. Responses are cacheable: nginx and any CDN in
 * front of it can serve them, and the CMS write path will purge on publish.
 */

const slugParam = z.object({
  // Validated before it reaches a query. The query is parameterised anyway,
  // but a malformed slug should be a 400 and never touch the database.
  slug: z.string().min(1).max(200).regex(SLUG_PATTERN, "Invalid slug."),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(9),
});

const brandFilter = z.object({
  brandId: z.coerce.number().int().positive().optional(),
});

/** Public content changes rarely; let caches do the work. */
const CACHE_CONTROL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export function contentRouter(repository: ContentRepository): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", CACHE_CONTROL);
    next();
  });

  // --- services ------------------------------------------------------------

  router.get(
    "/services",
    asyncHandler(async (_req, res) => {
      res.json({ items: await repository.listServices() });
    }),
  );

  router.get(
    "/services/:slug",
    asyncHandler(async (req, res) => {
      const { slug } = slugParam.parse(req.params);
      const service = await repository.findServiceBySlug(slug);
      if (!service) throw notFound("No published service with that slug.");
      res.json(service);
    }),
  );

  // --- brands --------------------------------------------------------------

  router.get(
    "/brands",
    asyncHandler(async (_req, res) => {
      res.json({ items: await repository.listBrands() });
    }),
  );

  router.get(
    "/brands/:slug",
    asyncHandler(async (req, res) => {
      const { slug } = slugParam.parse(req.params);
      const brand = await repository.findBrandBySlug(slug);
      if (!brand) throw notFound("No published brand with that slug.");
      res.json(brand);
    }),
  );

  // --- products ------------------------------------------------------------

  router.get(
    "/products",
    asyncHandler(async (req, res) => {
      const { brandId } = brandFilter.parse(req.query);
      res.json({ items: await repository.listProducts(brandId) });
    }),
  );

  router.get(
    "/products/:slug",
    asyncHandler(async (req, res) => {
      const { slug } = slugParam.parse(req.params);
      const product = await repository.findProductBySlug(slug);
      if (!product) throw notFound("No published product with that slug.");
      res.json(product);
    }),
  );

  // --- blog ----------------------------------------------------------------

  router.get(
    "/blog",
    asyncHandler(async (req, res) => {
      const { page, perPage } = listQuery.parse(req.query);
      res.json(await repository.listPosts(page, perPage));
    }),
  );

  // Every published post, unpaginated — for the sitemap and the RSS feed.
  router.get(
    "/blog/all",
    asyncHandler(async (_req, res) => {
      res.json({ items: await repository.listAllPosts() });
    }),
  );

  router.get(
    "/blog/:slug",
    asyncHandler(async (req, res) => {
      const { slug } = slugParam.parse(req.params);
      const post = await repository.findPostBySlug(slug);
      if (!post) throw notFound("No published article with that slug.");
      res.json(post);
    }),
  );

  // --- generic CMS pages ---------------------------------------------------
  //
  // Mounted last so it cannot shadow any of the routes above.

  router.get(
    "/pages/:slug",
    asyncHandler(async (req, res) => {
      const { slug } = slugParam.parse(req.params);
      const page = await repository.findPageBySlug(slug);
      if (!page) throw notFound("No published page with that slug.");
      res.json(page);
    }),
  );

  return router;
}
