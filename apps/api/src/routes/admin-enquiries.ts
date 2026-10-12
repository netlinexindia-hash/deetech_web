import { Router } from "express";
import { z } from "zod";
import { adminEnquiryStatusSchema } from "@deetech/shared-types/admin";
import type { AppConfig } from "../config.js";
import { notFound } from "../errors.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import type { AuthRepository } from "../repositories/auth.js";
import type { EnquiryRepository } from "../repositories/enquiries.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["new", "read", "replied", "spam", "all"]).default("all"),
});

/**
 * The enquiry inbox.
 *
 * Read-and-triage only: an enquiry is a record of something a person sent,
 * so its content is never editable. Only `status` can change.
 */
export function adminEnquiryRouter(
  repository: EnquiryRepository,
  auth: AuthRepository,
  config: AppConfig,
): Router {
  const router = Router();

  router.use("/admin/enquiries", requireAuth(auth, config));
  router.use("/admin/enquiries", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get(
    "/admin/enquiries",
    asyncHandler(async (req, res) => {
      const { page, perPage, status } = listQuery.parse(req.query);
      res.json(await repository.list(page, perPage, status));
    }),
  );

  router.get(
    "/admin/enquiries/:id",
    asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const enquiry = await repository.findById(id);
      if (!enquiry) throw notFound("No enquiry with that id.");
      res.json(enquiry);
    }),
  );

  router.patch(
    "/admin/enquiries/:id",
    asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const { status } = adminEnquiryStatusSchema.parse(req.body);
      const enquiry = await repository.setStatus(id, status);
      if (!enquiry) throw notFound("No enquiry with that id.");
      res.json(enquiry);
    }),
  );

  router.delete(
    "/admin/enquiries/:id",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const removed = await repository.remove(id);
      if (!removed) throw notFound("No enquiry with that id.");
      res.json({ ok: true });
    }),
  );

  return router;
}
