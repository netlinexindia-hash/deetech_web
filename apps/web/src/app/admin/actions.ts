"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/admin/api";

/**
 * Sign-in and sign-out.
 *
 * The API issues the session cookie for its own origin, which the browser
 * never sees because it only ever talks to the web app. So the token is
 * read out of the API's `Set-Cookie` here and re-issued on the web origin
 * with the same hardening. The API remains the only thing that can mint or
 * validate a session.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";

export interface LoginState {
  error?: string;
}

/**
 * Whether this request actually arrived over TLS.
 *
 * A `Secure` cookie delivered over plain HTTP is silently dropped by the
 * browser, so sign-in appears to work and the very next request is
 * anonymous — indistinguishable from the session expiring instantly.
 * Deciding the flag from NODE_ENV got that wrong for every production-mode
 * deployment not behind TLS, such as a staging host on a LAN where no
 * certificate is possible.
 *
 * nginx sets X-Forwarded-Proto from $scheme in both topologies. Falling back
 * to `true` matters: if the header is ever missing the safe assumption is
 * HTTPS, so a misconfigured proxy cannot silently downgrade a real
 * production cookie — it breaks the login loudly instead.
 */
async function isSecureRequest(): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-proto");
  if (!forwarded) return true;
  // The header can be a list when more than one proxy is in front.
  return forwarded.split(",")[0]!.trim().toLowerCase() === "https";
}

/** Pulls our cookie's value out of a Set-Cookie header list. */
function readSessionToken(setCookie: string[] | null): string | null {
  if (!setCookie) return null;
  for (const header of setCookie) {
    const match = header.match(new RegExp(`^${SESSION_COOKIE}=([^;]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password." };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    // The API returns one message for every failure mode on purpose, so this
    // passes it through rather than elaborating on it.
    return {
      error: body?.error?.message ?? "Those sign-in details are not correct.",
    };
  }

  const token = readSessionToken(response.headers.getSetCookie());
  if (!token) {
    return { error: "Sign-in succeeded but no session was issued. Please try again." };
  }

  const { expiresAt } = (await response.json()) as { expiresAt: string };

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Follows the connection, not NODE_ENV. See isSecureRequest above.
    secure: await isSecureRequest(),
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
  });

  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // Best effort: the server-side session is deleted so the token is dead
    // even if it was captured, but a failure here must not block sign-out.
    await fetch(`${API_BASE_URL}/api/v1/admin/logout`, {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {});
  }

  store.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
