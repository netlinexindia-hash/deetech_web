import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError, notFound } from "../errors.js";
import { logger } from "../logger.js";

/** Terminal 404 handler. Mounted after every route. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(notFound(`No route matches ${req.method} ${req.path}.`));
}

function zodToDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * The single place that turns a thrown value into a response body.
 *
 * Unknown errors are logged in full but reported as a bare 500 — stack traces
 * and driver messages are not sent to clients in any environment.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    const httpError = new HttpError(
      400,
      "validation_failed",
      "The request did not pass validation.",
      zodToDetails(err),
    );
    res.status(httpError.statusCode).json(httpError.toBody());
    return;
  }

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, "Request failed");
    }
    res.status(err.statusCode).json(err.toBody());
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({
    error: { code: "internal_error", message: "Something went wrong." },
  });
}
