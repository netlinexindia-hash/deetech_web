import type { Request } from "express";
import { hashWithSecret } from "../services/hash.js";

/**
 * The client's IP, hashed with the session secret.
 *
 * `app.set("trust proxy", 1)` means `req.ip` is the X-Forwarded-For address
 * nginx set, not the proxy's own. Returns null when no secret is configured
 * rather than falling back to an unkeyed hash.
 */
export function clientIpHash(req: Request, secret: string | undefined): string | null {
  if (!secret) return null;
  const ip = req.ip;
  return ip ? hashWithSecret(ip, secret) : null;
}

/** Bounded, so a hostile User-Agent cannot bloat a row. */
export function clientUserAgent(req: Request): string | null {
  const value = req.get("user-agent");
  return value ? value.slice(0, 255) : null;
}
