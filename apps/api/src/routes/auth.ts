import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { tooManyRequests, unauthorized } from "../errors.js";
import { logger } from "../logger.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { clientIpHash, clientUserAgent } from "../middleware/client.js";
import { requireAuth, SESSION_COOKIE } from "../middleware/require-auth.js";
import type { AuthRepository } from "../repositories/auth.js";
import { generateToken, hashWithSecret } from "../services/hash.js";
import { DUMMY_HASH, verifyPassword } from "../services/password.js";

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  // No complexity rules on *login* — only on password change. Rejecting a
  // login for a weak password tells an attacker about the stored value.
  password: z.string().min(1, "Enter your password.").max(200),
});

/** Failed attempts allowed per email-or-IP before the account is throttled. */
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MINUTES = 15;

export function authRouter(repository: AuthRepository, config: AppConfig): Router {
  const router = Router();

  router.post(
    "/admin/login",
    asyncHandler(async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const emailLower = email.toLowerCase();
      const ipHash = clientIpHash(req, config.sessionSecret);

      const failures = await repository.countRecentFailures(
        emailLower,
        ipHash,
        FAILURE_WINDOW_MINUTES,
      );
      if (failures >= MAX_FAILURES) {
        logger.warn({ failures }, "Login throttled");
        throw tooManyRequests(
          "Too many failed sign-in attempts. Please wait a few minutes and try again.",
        );
      }

      const user = await repository.findForLogin(emailLower);

      // Always verify against *something*, so an unknown address costs the
      // same time as a known one. Otherwise the response time enumerates
      // valid accounts.
      const passwordOk = await verifyPassword(
        user?.passwordHash ?? DUMMY_HASH,
        password,
      );

      if (!user || !passwordOk || !user.isActive) {
        await repository.recordLoginAttempt(emailLower, ipHash, false);
        // One message for every failure mode — wrong password, unknown
        // address, deactivated account. Telling them apart is an
        // enumeration feature.
        logger.info({ emailLower }, "Failed login");
        throw unauthorized("Those sign-in details are not correct.");
      }

      if (!config.sessionSecret) {
        throw new Error("SESSION_SECRET is required to issue a session");
      }

      const token = generateToken();
      const sessionId = hashWithSecret(token, config.sessionSecret);
      const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);

      await repository.createSession({
        sessionId,
        userId: user.id,
        expiresAt,
        ipHash,
        userAgent: clientUserAgent(req),
      });
      await repository.recordLoginAttempt(emailLower, ipHash, true);
      await repository.markLoggedIn(user.id);

      // A `Secure` cookie sent over plain HTTP is silently discarded by the
      // browser, which looks exactly like the session expiring the instant
      // you sign in. Tying the flag to NODE_ENV got that wrong for any
      // production-mode deployment not behind TLS — a staging box on a LAN,
      // for instance, where no certificate is possible.
      //
      // `req.secure` is the real answer: with `trust proxy` set (app.ts) it
      // reflects X-Forwarded-Proto, which nginx sets from $scheme in both
      // topologies. Over HTTPS the cookie is Secure; over HTTP it is usable.
      if (config.isProduction && !req.secure) {
        logger.warn(
          "Admin sign-in over a non-HTTPS connection: the session cookie is " +
            "being issued without the Secure flag. Expected on a staging host " +
            "without TLS; on a public site it means the proxy is not setting " +
            "X-Forwarded-Proto, and the session cookie is exposed.",
        );
      }

      res.cookie(SESSION_COOKIE, token, {
        // Not readable from JavaScript, so an XSS cannot exfiltrate it.
        httpOnly: true,
        // Set when the connection actually is TLS, not when NODE_ENV says so.
        secure: req.secure,
        // Blocks the cookie on cross-site POSTs, which is the CSRF defence
        // for the admin write routes. `strict` rather than `lax` because no
        // admin flow starts from an external link.
        sameSite: "strict",
        path: "/",
        expires: expiresAt,
      });

      logger.info({ userId: user.id }, "Admin signed in");

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        expiresAt: expiresAt.toISOString(),
      });
    }),
  );

  router.post(
    "/admin/logout",
    asyncHandler(async (req, res) => {
      // Deliberately not behind requireAuth: logging out with an already
      // invalid session should clear the cookie and succeed, not 401.
      const token = req.cookies?.[SESSION_COOKIE];
      if (typeof token === "string" && token && config.sessionSecret) {
        await repository.deleteSession(hashWithSecret(token, config.sessionSecret));
      }
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.json({ ok: true });
    }),
  );

  /** Lets the admin UI discover who it is signed in as after a page load. */
  router.get(
    "/admin/me",
    requireAuth(repository, config),
    asyncHandler(async (req, res) => {
      const user = req.adminUser!;
      // Same shape as the login response. `isActive` is omitted because a
      // request that reached here is from an active account by definition,
      // and two different shapes for "the current user" invites bugs.
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }),
  );

  return router;
}
