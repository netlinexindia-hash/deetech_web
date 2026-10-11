import type { ApiError } from "@deetech/shared-types";

/**
 * An error that is safe to show a client. Anything thrown that is *not* an
 * HttpError is treated as a bug and reported as a generic 500, so internal
 * details never leak through the response body.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, string[]> | undefined;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const badRequest = (message: string, details?: Record<string, string[]>) =>
  new HttpError(400, "bad_request", message, details);

export const unauthorized = (message = "Authentication is required.") =>
  new HttpError(401, "unauthorized", message);

export const forbidden = (message = "You do not have access to this resource.") =>
  new HttpError(403, "forbidden", message);

export const notFound = (message = "Resource not found.") =>
  new HttpError(404, "not_found", message);

export const tooManyRequests = (message = "Too many requests. Try again later.") =>
  new HttpError(429, "too_many_requests", message);

export const internalError = (message = "Something went wrong.") =>
  new HttpError(500, "internal_error", message);
