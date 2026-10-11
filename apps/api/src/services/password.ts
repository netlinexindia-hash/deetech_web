import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing with Argon2id.
 *
 * Argon2id is the OWASP first choice for new applications: memory-hard, so a
 * GPU or ASIC attacker gains far less than against a SHA-family KDF. The
 * parameters below are OWASP's current minimum (19 MiB, 2 iterations,
 * parallelism 1) and are the library defaults; they are written out
 * explicitly so a future change is a visible decision rather than a silent
 * dependency upgrade.
 */
const OPTIONS = {
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed or empty hash, so a
 * corrupt row is a failed login rather than a 500 that tells an attacker the
 * account exists.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  if (!storedHash) return false;
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}

/**
 * A dummy hash of a fixed string, used to spend the same work on a login for
 * an address that does not exist as for one that does.
 *
 * Without this, "unknown email" returns in microseconds while "wrong
 * password" takes ~50ms, and the difference is a reliable account
 * enumeration oracle.
 */
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$Ry3mPeQ0oBDVa8FQF9ABfjpJqLPDNRxCDMIwO4jRCHQ";
