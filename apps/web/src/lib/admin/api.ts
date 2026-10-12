import "server-only";

import { cookies } from "next/headers";

/**
 * Server-side client for the admin API.
 *
 * `server-only` at the top is load-bearing: importing this from a client
 * component is a build error, so the session cookie can never end up in a
 * browser bundle.
 *
 * The browser never talks to the API directly. It holds a cookie on the web
 * origin; this module reads that cookie server-side and forwards it. In
 * production both apps sit behind one nginx hostname, and in development
 * they are on different ports — the same code works either way, and the API
 * is never exposed to the public.
 */

export const SESSION_COOKIE = "deetech_admin";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

/** Thrown when the session is missing or rejected, so callers can redirect. */
export class NotAuthenticated extends AdminApiError {
  constructor() {
    super(401, "unauthorized", "Your session has expired.");
    this.name = "NotAuthenticated";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Multipart passes a FormData straight through without a JSON header. */
  formData?: FormData;
}

export async function adminFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) throw new NotAuthenticated();

  const headers: Record<string, string> = {
    Accept: "application/json",
    Cookie: `${SESSION_COOKIE}=${token}`,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
      // Admin data is per-session and must never be cached between requests.
      cache: "no-store",
      signal: AbortSignal.timeout(options.formData ? 60_000 : 10_000),
    });
  } catch (error) {
    throw new AdminApiError(
      503,
      "api_unreachable",
      `Could not reach the API. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }

  if (response.status === 401) throw new NotAuthenticated();

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (
      payload as {
        error?: { code?: string; message?: string; details?: Record<string, string[]> };
      }
    )?.error;
    throw new AdminApiError(
      response.status,
      error?.code ?? "error",
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details,
    );
  }

  return payload as T;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "editor";
}

/** Returns the signed-in user, or null — never throws for a missing session. */
export async function currentUser(): Promise<AdminUser | null> {
  try {
    const { user } = await adminFetch<{ user: AdminUser }>("/admin/me");
    return user;
  } catch (error) {
    if (error instanceof NotAuthenticated) return null;
    throw error;
  }
}
