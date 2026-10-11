import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AppConfig } from "../config.js";
import { forbidden, unauthorized } from "../errors.js";
import type { AdminRole, AdminUser, AuthRepository } from "../repositories/auth.js";
import { hashWithSecret } from "../services/hash.js";

export const SESSION_COOKIE = "deetech_admin";

declare module "express-serve-static-core" {
  interface Request {
    /** Set by `requireAuth`. Absent on unauthenticated requests. */
    adminUser?: AdminUser;
    adminSessionId?: string;
  }
}

/**
 * Server-side authentication for admin routes.
 *
 * This is the control. Hiding a button in React is not authorization, so
 * every admin route is mounted behind this middleware rather than trusting
 * that the UI will not call it.
 *
 * The cookie carries a random token; what is stored in `admin_sessions` is a
 * keyed hash of that token, so a database read does not yield a usable
 * cookie.
 */
export function requireAuth(
  repository: AuthRepository,
  config: AppConfig,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE];
      if (typeof token !== "string" || token.length === 0) {
        next(unauthorized());
        return;
      }

      if (!config.sessionSecret) {
        // Cannot verify a session without the key. Refuse rather than
        // fall back to something weaker.
        next(unauthorized());
        return;
      }

      const sessionId = hashWithSecret(token, config.sessionSecret);
      const session = await repository.findSession(sessionId);

      if (!session) {
        next(unauthorized("Your session has expired. Please sign in again."));
        return;
      }

      req.adminUser = session.user;
      req.adminSessionId = sessionId;

      // Fire-and-forget: a failed last_seen update must not fail the request.
      void repository.touchSession(sessionId).catch(() => {});

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Role gate. Mount after `requireAuth`.
 *
 * `admin` is treated as a superset of `editor`, so `requireRole("editor")`
 * admits both.
 */
export function requireRole(...allowed: AdminRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.adminUser;
    if (!user) {
      next(unauthorized());
      return;
    }
    if (user.role === "admin" || allowed.includes(user.role)) {
      next();
      return;
    }
    next(forbidden("This action requires a different role."));
  };
}
