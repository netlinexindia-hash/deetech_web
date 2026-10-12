"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminMediaSchema } from "@deetech/shared-types/admin";
import { AdminApiError, adminFetch, NotAuthenticated } from "@/lib/admin/api";

export interface MediaFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Uploads a file.
 *
 * Alt text is validated here so the editor is told before the bytes are
 * sent, and again by the API, which is what actually enforces it — the
 * column is NOT NULL precisely because every one of the 53 media items on
 * the legacy site has none.
 */
export async function uploadMedia(
  _previous: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload.", fieldErrors: { file: ["Required."] } };
  }

  const parsed = adminMediaSchema.safeParse({ altText: formData.get("altText") });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        altText: parsed.error.issues.map((issue) => issue.message),
      },
    };
  }

  try {
    await adminFetch("/admin/media", { method: "POST", formData });
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    if (error instanceof AdminApiError) {
      return {
        error: error.message,
        ...(error.details ? { fieldErrors: error.details } : {}),
      };
    }
    throw error;
  }

  revalidatePath("/admin/media");
  redirect("/admin/media?uploaded=1");
}

export async function deleteMedia(id: number): Promise<void> {
  try {
    await adminFetch(`/admin/media/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    if (error instanceof AdminApiError) {
      redirect(`/admin/media?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath("/admin/media");
  redirect("/admin/media?deleted=1");
}
