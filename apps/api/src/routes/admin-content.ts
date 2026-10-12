import { Router } from "express";
import { z } from "zod";
import {
  adminBlogPostSchema,
  adminBrandSchema,
  adminListQuerySchema,
  adminPageSchema,
  adminProductSchema,
  adminServiceSchema,
  resolvePublishedAt,
  statusField,
} from "@deetech/shared-types/admin";
import type { AppConfig } from "../config.js";
import { badRequest, notFound } from "../errors.js";
import { logger } from "../logger.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import {
  AdminContentRepository,
  DuplicateSummaryError,
  ForeignKeyError,
  isResourceName,
  UniqueSlugError,
  type AdminInput,
  type ResourceName,
} from "../repositories/admin-content.js";
import type { AuthRepository } from "../repositories/auth.js";

/**
 * Admin content endpoints.
 *
 * Every route here is mounted behind `requireAuth`. That is the control —
 * the admin UI hiding a button is a convenience, and anything can POST to
 * these paths directly.
 *
 * Deletes additionally require the `admin` role: an editor can draft,
 * publish and unpublish, but removing a record is not reversible from the UI.
 */

const idParam = z.object({ id: z.coerce.number().int().positive() });

/**
 * Express 5 types a route param as `string | string[]`, so params are parsed
 * rather than asserted. An unknown content type is a 404, not a 500.
 */
const resourceParam = z.object({ resource: z.string().min(1).max(40) });

const SCHEMAS = {
  pages: adminPageSchema,
  services: adminServiceSchema,
  brands: adminBrandSchema,
  products: adminProductSchema,
  blog: adminBlogPostSchema,
} as const;

/** Turns a repository conflict into the right status code and message. */
function toHttp(error: unknown): never {
  if (error instanceof UniqueSlugError) {
    throw badRequest(error.message, { slug: [error.message] });
  }
  if (error instanceof DuplicateSummaryError) {
    throw badRequest(error.message, { summary: [error.message] });
  }
  if (error instanceof ForeignKeyError) {
    throw badRequest(error.message, { brandId: [error.message] });
  }
  throw error;
}

export function adminContentRouter(
  repository: AdminContentRepository,
  auth: AuthRepository,
  config: AppConfig,
): Router {
  const router = Router();

  // Applies to every route defined below, including ones added later.
  router.use("/admin", requireAuth(auth, config));

  // Admin responses must never be cached by a proxy — they contain drafts.
  router.use("/admin", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get(
    "/admin/dashboard",
    asyncHandler(async (_req, res) => {
      res.json(await repository.dashboardCounts());
    }),
  );

  router.get(
    "/admin/brand-options",
    asyncHandler(async (_req, res) => {
      res.json({ items: await repository.brandOptions() });
    }),
  );

  /** Resolves `:resource` once, so each handler below can trust it. */
  function resource(params: unknown): ResourceName {
    const { resource: value } = resourceParam.parse(params);
    if (!isResourceName(value)) {
      throw notFound(`Unknown content type "${value}".`);
    }
    return value;
  }

  router.get(
    "/admin/content/:resource",
    asyncHandler(async (req, res) => {
      const name = resource(req.params);
      const query = adminListQuerySchema.parse(req.query);
      res.json(await repository.list(name, query));
    }),
  );

  router.get(
    "/admin/content/:resource/:id",
    asyncHandler(async (req, res) => {
      const name = resource(req.params);
      const { id } = idParam.parse(req.params);
      const row = await repository.findById(name, id);
      if (!row) throw notFound("No record with that id.");
      res.json(row);
    }),
  );

  router.post(
    "/admin/content/:resource",
    asyncHandler(async (req, res) => {
      const name = resource(req.params);
      const input = SCHEMAS[name].parse(req.body) as AdminInput;

      const prepared = name === "blog" ? withPublishedAt(input as never, null) : input;

      try {
        const row = await repository.create(name, prepared);
        logger.info(
          { resource: name, id: row.id, userId: req.adminUser?.id },
          "Content created",
        );
        res.status(201).json(row);
      } catch (error) {
        toHttp(error);
      }
    }),
  );

  router.patch(
    "/admin/content/:resource/:id",
    asyncHandler(async (req, res) => {
      const name = resource(req.params);
      const { id } = idParam.parse(req.params);
      const input = SCHEMAS[name].parse(req.body) as AdminInput;

      const existing = await repository.findById(name, id);
      if (!existing) throw notFound("No record with that id.");

      const prepared =
        name === "blog"
          ? withPublishedAt(
              input as never,
              (existing.publishedAt as string | null) ?? null,
            )
          : input;

      try {
        const row = await repository.update(name, id, prepared);
        if (!row) throw notFound("No record with that id.");
        logger.info(
          { resource: name, id, userId: req.adminUser?.id },
          "Content updated",
        );
        res.json(row);
      } catch (error) {
        toHttp(error);
      }
    }),
  );

  router.post(
    "/admin/content/:resource/:id/status",
    asyncHandler(async (req, res) => {
      const name = resource(req.params);
      const { id } = idParam.parse(req.params);
      const { status } = z.object({ status: statusField }).parse(req.body);

      const row = await repository.setStatus(name, id, status);
      if (!row) throw notFound("No record with that id.");

      logger.info(
        { resource: name, id, status, userId: req.adminUser?.id },
        "Publication status changed",
      );
      res.json(row);
    }),
  );

  router.delete(
    "/admin/content/:resource/:id",
    // Deleting is not undoable from the UI, so it is admin-only.
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const name = resource(req.params);
      const { id } = idParam.parse(req.params);

      try {
        const removed = await repository.remove(name, id);
        if (!removed) throw notFound("No record with that id.");
        logger.warn(
          { resource: name, id, userId: req.adminUser?.id },
          "Content deleted",
        );
        res.json({ ok: true });
      } catch (error) {
        toHttp(error);
      }
    }),
  );

  return router;
}

/** Applies the publish-date rule from the shared module. */
function withPublishedAt(
  input: { status: "draft" | "published"; publishedAt: string | null },
  existing: string | null,
): AdminInput {
  return {
    ...input,
    publishedAt: resolvePublishedAt(input.status, input.publishedAt, existing),
  } as AdminInput;
}
