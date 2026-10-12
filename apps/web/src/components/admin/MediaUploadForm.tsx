"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { uploadMedia, type MediaFormState } from "@/app/admin/media-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

export function MediaUploadForm({ accept }: { accept: string }) {
  const [state, formAction] = useActionState<MediaFormState, FormData>(uploadMedia, {});
  const fileId = useId();
  const altId = useId();

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger/5 px-3.5 py-2.5 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor={fileId} className="block text-sm font-semibold text-navy-900">
          File <span className="text-danger">*</span>
        </label>
        <input
          id={fileId}
          name="file"
          type="file"
          required
          accept={accept}
          aria-invalid={state.fieldErrors?.file ? true : undefined}
          className="mt-1.5 w-full rounded-lg border border-navy-200 px-3.5 py-2.5 text-[0.9375rem] file:mr-3 file:rounded file:border-0 file:bg-navy-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-navy-800"
        />
        {state.fieldErrors?.file ? (
          <p className="mt-1.5 text-sm font-medium text-danger">
            {state.fieldErrors.file.join(" ")}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={altId} className="block text-sm font-semibold text-navy-900">
          Alt text <span className="text-danger">*</span>
        </label>
        <input
          id={altId}
          name="altText"
          type="text"
          required
          aria-invalid={state.fieldErrors?.altText ? true : undefined}
          aria-describedby={`${altId}-hint`}
          placeholder="A server rack in a data centre"
          className="mt-1.5 w-full rounded-lg border border-navy-200 px-3.5 py-2.5 text-[0.9375rem]"
        />
        <p id={`${altId}-hint`} className="mt-1.5 text-sm text-muted">
          Describe what the image shows. If it is purely decorative, say so — but prefer
          not uploading decoration at all.
        </p>
        {state.fieldErrors?.altText ? (
          <p className="mt-1.5 text-sm font-medium text-danger">
            {state.fieldErrors.altText.join(" ")}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
