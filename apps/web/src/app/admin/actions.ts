"use server";

import { cookies } from "next/headers";
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
    secure: process.env.NODE_ENV === "production",
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
