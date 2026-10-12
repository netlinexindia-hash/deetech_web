"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminBlogPostSchema,
  adminBrandSchema,
  adminPageSchema,
  adminProductSchema,
  adminServiceSchema,
} from "@deetech/shared-types/admin";
import { isAdminResource, type AdminResourceSlug } from "@/lib/admin/registry";
import { AdminApiError, adminFetch, NotAuthenticated } from "@/lib/admin/api";
import { RESOURCE_SPECS } from "@/lib/admin/resources";

/**
 * CMS write actions.
 *
 * These validate with the same Zod schemas the API uses, so the editor gets
 * field-level errors without a round trip — but the API validates again
 * regardless. This is for the person filling in the form; the API is the
 * control.
 */

const SCHEMAS = {
  pages: adminPageSchema,
  services: adminServiceSchema,
  brands: adminBrandSchema,
  products: adminProductSchema,
  blog: adminBlogPostSchema,
} as const;

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Echoed back so a failed save never loses what was typed. */
  values?: Record<string, unknown>;
}

/**
 * Rebuilds a typed object from form fields.
 *
 * `benefits` and `inclusions` arrive as a JSON string from the repeater
 * widget, because a dynamic list of pairs does not round-trip through flat
 * form encoding cleanly.
 */
function readForm(resource: AdminResourceSlug, formData: FormData) {
  const values: Record<string, unknown> = {};

  for (const field of RESOURCE_SPECS[resource].fields) {
    const raw = formData.get(field.name);

    if (field.kind === "points") {
      try {
        values[field.name] = JSON.parse(String(raw ?? "[]"));
      } catch {
        values[field.name] = [];
      }
      continue;
    }

    values[field.name] = raw === null ? "" : String(raw);
  }

  return values;
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    // Nested paths like benefits.0.title are reported against the top field,
    // which is where the repeater widget shows them.
    const key = String(issue.path[0] ?? "_");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

/** Revalidates the public pages a change could have affected. */
function revalidateFor(resource: AdminResourceSlug, slug?: string) {
  revalidatePath("/sitemap.xml");
  revalidatePath("/");

  const map: Record<AdminResourceSlug, string> = {
    pages: "/",
    services: "/services",
    brands: "/brands",
    products: "/products",
    blog: "/blog",
  };
  revalidatePath(map[resource]);
  if (slug) revalidatePath(`${map[resource]}/${slug}`);
  if (resource === "blog") revalidatePath("/blog/rss.xml");
}

export async function saveContent(
  resource: string,
  id: number | null,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isAdminResource(resource)) {
    return { error: "Unknown content type." };
  }

  const values = readForm(resource, formData);
  const parsed = SCHEMAS[resource].safeParse(values);

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values,
    };
  }

  let saved: { id: number; slug: string };
  try {
    saved = await adminFetch<{ id: number; slug: string }>(
      id === null ? `/admin/content/${resource}` : `/admin/content/${resource}/${id}`,
      { method: id === null ? "POST" : "PATCH", body: parsed.data },
    );
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    if (error instanceof AdminApiError) {
      return {
        error: error.message,
        ...(error.details ? { fieldErrors: error.details } : {}),
        values,
      };
    }
    throw error;
  }

  revalidateFor(resource, saved.slug);
  redirect(`/admin/${resource}/${saved.id}?saved=1`);
}

export async function setContentStatus(
  resource: string,
  id: number,
  status: "draft" | "published",
): Promise<void> {
  if (!isAdminResource(resource)) return;

  try {
    const row = await adminFetch<{ slug: string }>(
      `/admin/content/${resource}/${id}/status`,
      { method: "POST", body: { status } },
    );
    revalidateFor(resource, row.slug);
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    throw error;
  }

  redirect(`/admin/${resource}/${id}?status=${status}`);
}

export async function deleteContent(resource: string, id: number): Promise<void> {
  if (!isAdminResource(resource)) return;

  try {
    await adminFetch(`/admin/content/${resource}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    if (error instanceof AdminApiError) {
      // Surfaced on the list page rather than thrown — the usual cause is a
      // brand that still has products, which is a message, not a crash.
      redirect(`/admin/${resource}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidateFor(resource);
  redirect(`/admin/${resource}?deleted=1`);
}
