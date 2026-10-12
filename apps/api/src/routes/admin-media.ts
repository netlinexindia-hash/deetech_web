import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { adminMediaSchema } from "@deetech/shared-types/admin";
import type { AppConfig } from "../config.js";
import { badRequest, notFound } from "../errors.js";
import { logger } from "../logger.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import type { AuthRepository } from "../repositories/auth.js";
import type { MediaRepository } from "../repositories/media.js";
import {
  acceptUpload,
  ALLOWED_MIME_TYPES,
  UploadRejected,
} from "../services/upload.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});

export function adminMediaRouter(
  repository: MediaRepository,
  auth: AuthRepository,
  config: AppConfig,
): Router {
  const router = Router();

  /**
   * Buffered in memory rather than streamed to disk, so a file is only
   * written after its type and magic bytes have been verified — nothing
   * untrusted ever lands in the media directory, even briefly.
   *
   * The limit is enforced here as well as in `acceptUpload`: multer aborts
   * the stream at the limit, so an oversized upload does not have to be
   * read in full before being rejected.
   */
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.media.maxUploadBytes, files: 1, fields: 4 },
  }).single("file");

  router.use("/admin/media", requireAuth(auth, config));
  router.use("/admin/media", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get(
    "/admin/media",
    asyncHandler(async (req, res) => {
      const { page, perPage } = listQuery.parse(req.query);
      res.json(await repository.list(page, perPage));
    }),
  );

  router.post(
    "/admin/media",
    (req, res, next) => {
      upload(req, res, (error: unknown) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
          const mb = (config.media.maxUploadBytes / 1_048_576).toFixed(1);
          return next(
            badRequest(
              error.code === "LIMIT_FILE_SIZE"
                ? `That file is larger than the ${mb} MB limit.`
                : "That upload could not be read.",
              { file: [error.message] },
            ),
          );
        }
        return next(error);
      });
    },
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file) {
        throw badRequest("Choose a file to upload.", { file: ["No file received."] });
      }

      // Alt text is required before anything is written. Every one of the 53
      // media items on the legacy site has none (SEO-4); the column is NOT
      // NULL and this is the matching rule at the edge.
      const { altText } = adminMediaSchema.parse(req.body);

      let accepted;
      try {
        accepted = await acceptUpload({
          buffer: file.buffer,
          originalName: file.originalname,
          declaredMimeType: file.mimetype,
          maxBytes: config.media.maxUploadBytes,
          storageRoot: config.media.storagePath,
        });
      } catch (error) {
        if (error instanceof UploadRejected) {
          throw badRequest(error.message, { file: [error.message] });
        }
        throw error;
      }

      const item = await repository.create({
        ...accepted,
        altText,
        uploadedBy: req.adminUser?.id ?? null,
      });

      logger.info(
        { mediaId: item.id, bytes: item.sizeBytes, userId: req.adminUser?.id },
        "Media uploaded",
      );
      res.status(201).json(item);
    }),
  );

  router.patch(
    "/admin/media/:id",
    asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const { altText } = adminMediaSchema.parse(req.body);
      const item = await repository.updateAltText(id, altText);
      if (!item) throw notFound("No media item with that id.");
      res.json(item);
    }),
  );

  router.delete(
    "/admin/media/:id",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const removed = await repository.remove(id);
      if (!removed) throw notFound("No media item with that id.");

      // The database row is removed; the file is left on disk deliberately.
      // Content may still reference the URL, and an orphaned file is a
      // cheaper problem than a broken image on a published page. A sweep of
      // unreferenced files is a separate, auditable job.
      logger.warn(
        { mediaId: id, storagePath: removed.url, userId: req.adminUser?.id },
        "Media record deleted; file retained on disk",
      );
      res.json({ ok: true });
    }),
  );

  router.get(
    "/admin/media/allowed-types",
    asyncHandler(async (_req, res) => {
      res.json({
        mimeTypes: ALLOWED_MIME_TYPES,
        maxBytes: config.media.maxUploadBytes,
      });
    }),
  );

  return router;
}
