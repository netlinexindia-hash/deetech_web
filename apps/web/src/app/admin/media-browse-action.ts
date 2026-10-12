"use server";

import type { MediaItem, Paginated } from "@deetech/shared-types";
import { adminFetch, NotAuthenticated } from "@/lib/admin/api";
import { redirect } from "next/navigation";

/**
 * Server action used by the client-side MediaPickerField to load a page of
 * uploaded media.
 *
 * The browser never talks to the API directly — the session cookie stays
 * server-side. This thin wrapper is the only public surface.
 */
export async function fetchMediaPage(
  page: number,
  perPage = 24,
): Promise<Paginated<MediaItem>> {
  try {
    return await adminFetch<Paginated<MediaItem>>(
      `/admin/media?page=${page}&perPage=${perPage}`,
    );
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    throw error;
  }
}
