import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Keyed hashing for values we need to compare but must not store in the
 * clear: client IPs and session ids.
 *
 * HMAC with a secret, not a bare SHA-256. The IPv4 space is small enough to
 * enumerate in seconds, so an unkeyed hash of an IP address is reversible by
 * brute force and is not a de-identification measure at all.
 */
export function hashWithSecret(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** A URL-safe, high-entropy token for session cookies. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time string comparison, for tokens and digests. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself leak the
  // length; compare a fixed-size digest instead.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
