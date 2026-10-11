"use server";

import { enquirySchema, isLikelySpam } from "@deetech/shared-types";

/**
 * Receives the contact form.
 *
 * The form is also validated in the browser, but that is a convenience only —
 * this action re-validates everything against the same shared schema the
 * Express route will use, because a server action is a public HTTP endpoint
 * and anything can POST to it.
 *
 * `POST /api/v1/enquiries` does not exist until Week 3 Day 14. Until it does,
 * submission fails with a clear message and the phone number and email
 * address. That is the honest behaviour: the form does not pretend to have
 * sent something that went nowhere.
 */

export interface EnquiryState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field-level problems, keyed by field name. */
  errors?: Record<string, string[]>;
  /** Values to put back in the form so a failed submit does not lose typing. */
  values?: Record<string, string>;
}

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";

export async function submitEnquiry(
  _previous: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  const raw = Object.fromEntries(formData.entries());
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") values[key] = value;
  }

  const parsed = enquirySchema.safeParse(values);

  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      (errors[key] ??= []).push(issue.message);
    }
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      errors,
      values,
    };
  }

  // Honeypot. A real browser leaves this empty because the field is hidden
  // from layout and from the accessibility tree. Return the same success
  // state a genuine submission gets and send nothing onward, so a bot cannot
  // tell rejection from acceptance.
  if (isLikelySpam(parsed.data)) {
    return { status: "success" };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      // Fail fast rather than leaving the user watching a spinner.
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 429) {
      return {
        status: "error",
        message:
          "That is a few too many submissions in a short time. Please wait a minute and try again.",
        values,
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        message:
          "We could not send that just now. Please email support@deetechgroup.com or call +91 86300 10632 and we will pick it up.",
        values,
      };
    }

    return { status: "success" };
  } catch {
    // Network failure, timeout, or the API is not running yet.
    return {
      status: "error",
      message:
        "We could not reach our systems just now. Please email support@deetechgroup.com or call +91 86300 10632 and we will pick it up.",
      values,
    };
  }
}
