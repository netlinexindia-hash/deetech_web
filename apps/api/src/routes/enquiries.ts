import { Router } from "express";
import { enquirySchema, isLikelySpam } from "@deetech/shared-types";
import type { AppConfig } from "../config.js";
import { tooManyRequests } from "../errors.js";
import { logger } from "../logger.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { clientIpHash, clientUserAgent } from "../middleware/client.js";
import type { EnquiryRepository } from "../repositories/enquiries.js";
import type { Mailer } from "../services/mailer.js";

/**
 * `POST /api/v1/enquiries` — the public contact form.
 *
 * Order of operations matters here:
 *   1. Validate against the schema shared with the web app.
 *   2. Honeypot: store as spam, respond exactly as for a real submission.
 *   3. Per-source throttle, behind nginx's own rate limit.
 *   4. Persist. This is the step that must not be lost.
 *   5. Notify by email — best effort. A failed notification does not fail
 *      the request, because the enquiry is already saved and the visitor
 *      being told "that didn't work" would make them submit again.
 */
export function enquiryRouter(
  repository: EnquiryRepository,
  mailer: Mailer,
  config: AppConfig,
): Router {
  const router = Router();

  router.post(
    "/enquiries",
    asyncHandler(async (req, res) => {
      // Throws a ZodError, which the error handler turns into a 400 with
      // field-level details.
      const input = enquirySchema.parse(req.body);

      const context = {
        ipHash: clientIpHash(req, config.sessionSecret),
        userAgent: clientUserAgent(req),
      };

      if (isLikelySpam(input)) {
        // Stored rather than dropped, so a false positive can be found and
        // answered. The response is identical to the success case, so a bot
        // cannot tell it was caught.
        await repository.create(input, context, "spam");
        logger.info("Enquiry rejected by honeypot");
        res.status(201).json({ ok: true });
        return;
      }

      if (context.ipHash) {
        const recent = await repository.countRecentFrom(
          context.ipHash,
          config.enquiry.windowMinutes,
        );
        if (recent >= config.enquiry.maxPerWindow) {
          logger.warn({ recent }, "Enquiry throttled");
          throw tooManyRequests(
            "That is a few too many enquiries in a short time. Please wait a little and try again, or email us directly.",
          );
        }
      }

      const stored = await repository.create(input, context);

      // Not awaited into the response path beyond this point — but it IS
      // awaited, so a serverless-style environment cannot kill the process
      // before the mail is handed off. The mailer swallows its own errors.
      const notified = await mailer.sendEnquiryNotification(input, stored.id);

      logger.info({ enquiryId: stored.id, notified }, "Enquiry received");

      // No echo of the submitted content, and no internal id beyond what the
      // caller needs.
      res.status(201).json({ ok: true, id: stored.id });
    }),
  );

  return router;
}
