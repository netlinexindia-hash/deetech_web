"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { submitEnquiry, type EnquiryState } from "@/app/actions/enquiry";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { contact } from "@/lib/site";

const initialState: EnquiryState = { status: "idle" };

function Field({
  name,
  label,
  type = "text",
  required = false,
  autoComplete,
  rows,
  hint,
  errors,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  rows?: number;
  hint?: string;
  errors?: string[];
  defaultValue?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);

  // The input is tied to its hint and its error by id, so a screen reader
  // announces both with the field rather than leaving them orphaned.
  const describedBy =
    [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const shared = {
    id,
    name,
    required,
    autoComplete,
    defaultValue,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    className: cn(
      "w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink",
      "placeholder:text-muted",
      invalid
        ? "border-danger focus-visible:outline-danger"
        : "border-navy-200 hover:border-navy-300",
    ),
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-muted"> (optional)</span>
        )}
      </label>

      <div className="mt-1.5">
        {rows ? (
          <textarea {...shared} rows={rows} />
        ) : (
          <input {...shared} type={type} />
        )}
      </div>

      {hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}

      {invalid ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger">
          {errors?.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Sending…" : "Send enquiry"}
    </Button>
  );
}

export function EnquiryForm({ sourcePage }: { sourcePage: string }) {
  const [state, formAction] = useActionState(submitEnquiry, initialState);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-xl border border-accent-400 bg-white p-8 shadow-card"
      >
        <h2 className="text-h3">Thank you — we have your enquiry</h2>
        <p className="mt-3 text-body">
          {contact.responseTime} If it is urgent, call{" "}
          <a
            href={`tel:${contact.phoneHref}`}
            className="font-semibold text-brand-800 underline underline-offset-4"
          >
            {contact.phone}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.message ? (
        // `alert` so the failure is announced immediately rather than being
        // discovered when the user tabs back up the form.
        <div
          role="alert"
          className="rounded-lg border border-danger bg-danger/5 px-4 py-3 text-[0.9375rem] font-medium text-danger"
        >
          {state.message}
        </div>
      ) : null}

      <input type="hidden" name="sourcePage" value={sourcePage} />

      {/* Honeypot. Hidden from layout and from the accessibility tree, so no
          real user ever fills it. Rejected on the server, not here. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          name="name"
          label="Your name"
          required
          autoComplete="name"
          errors={state.errors?.name}
          defaultValue={state.values?.name}
        />
        <Field
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          errors={state.errors?.email}
          defaultValue={state.values?.email}
        />
        <Field
          name="company"
          label="Company"
          autoComplete="organization"
          errors={state.errors?.company}
          defaultValue={state.values?.company}
        />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          errors={state.errors?.phone}
          defaultValue={state.values?.phone}
        />
      </div>

      <Field
        name="subject"
        label="What is this about?"
        required
        hint="For example: new website, email migration, ongoing IT support."
        errors={state.errors?.subject}
        defaultValue={state.values?.subject}
      />

      <Field
        name="message"
        label="Tell us more"
        required
        rows={6}
        hint="What are you working with now, what needs to change, and is there a date it needs to happen by?"
        errors={state.errors?.message}
        defaultValue={state.values?.message}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SubmitButton />
        <p className="text-sm text-muted">
          We use your details only to answer this enquiry. See our{" "}
          <a
            href="/privacy-policy"
            className="font-medium text-brand-800 underline underline-offset-4"
          >
            privacy policy
          </a>
          .
        </p>
      </div>
    </form>
  );
}
