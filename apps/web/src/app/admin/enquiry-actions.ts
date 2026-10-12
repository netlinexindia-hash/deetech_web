"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EnquiryStatus } from "@deetech/shared-types";
import { adminFetch, NotAuthenticated } from "@/lib/admin/api";

/** Triage only — an enquiry's content is a record and is never editable. */
export async function setEnquiryStatus(
  id: number,
  status: EnquiryStatus,
): Promise<void> {
  try {
    await adminFetch(`/admin/enquiries/${id}`, {
      method: "PATCH",
      body: { status },
    });
  } catch (error) {
    if (error instanceof NotAuthenticated) redirect("/admin/login");
    throw error;
  }
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin");
  redirect(`/admin/enquiries/${id}?updated=1`);
}
