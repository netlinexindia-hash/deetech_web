"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveContent, type FormState } from "@/app/admin/content-actions";
import { groupFields, type FieldSpec } from "@/lib/admin/resources";
import type { AdminResourceSlug } from "@/lib/admin/registry";
import { cn } from "@/lib/cn";
import { MediaPickerField } from "@/components/admin/MediaPickerField";

interface Point {
  title: string;
  body: string;
}

/** A repeating list of title/body pairs, for service benefits and inclusions. */
function PointsField({
  name,
  label,
  hint,
  initial,
  errors,
}: {
  name: string;
  label: string;
  hint?: string;
  initial: Point[];
  errors?: string[];
}) {
  const [points, setPoints] = useState<Point[]>(initial);
  const id = useId();

  const update = (index: number, key: keyof Point, value: string) =>
    setPoints((current) =>
      current.map((point, i) => (i === index ? { ...point, [key]: value } : point)),
    );

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy-900">{label}</legend>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {errors?.length ? (
        <p className="mt-1.5 text-sm font-medium text-danger">{errors.join(" ")}</p>
      ) : null}

      {/* The real value: a dynamic list of pairs does not round-trip through
          flat form encoding, so it is submitted as JSON in one field. */}
      <input type="hidden" name={name} value={JSON.stringify(points)} />

      <ul className="mt-3 space-y-3">
        {points.map((point, index) => (
          <li
            key={`${id}-${index}`}
            className="rounded-lg border border-border bg-surface-subtle p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <div>
                  <label
                    htmlFor={`${id}-${index}-title`}
                    className="block text-xs font-semibold text-navy-700"
                  >
                    Title
                  </label>
                  <input
                    id={`${id}-${index}-title`}
                    value={point.title}
                    onChange={(event) => update(index, "title", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-[0.9375rem]"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${id}-${index}-body`}
                    className="block text-xs font-semibold text-navy-700"
                  >
                    Description
                  </label>
                  <textarea
                    id={`${id}-${index}-body`}
                    rows={2}
                    value={point.body}
                    onChange={(event) => update(index, "body", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-[0.9375rem]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPoints((c) => c.filter((_, i) => i !== index))}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-navy-200 text-navy-700 hover:border-danger hover:text-danger"
              >
                <span aria-hidden="true">&times;</span>
                <span className="sr-only">
                  Remove {point.title || `item ${index + 1}`}
                </span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setPoints((c) => [...c, { title: "", body: "" }])}
        className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
      >
        Add {label.toLowerCase().replace(/s$/, "")}
      </button>
    </fieldset>
  );
}

function Field({
  spec,
  value,
  errors,
  options,
}: {
  spec: FieldSpec;
  value: unknown;
  errors?: string[];
  options?: { value: string; label: string }[];
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);

  if (spec.kind === "points") {
    return (
      <PointsField
        name={spec.name}
        label={spec.label}
        hint={spec.hint}
        errors={errors}
        initial={Array.isArray(value) ? (value as Point[]) : []}
      />
    );
  }

  if (spec.kind === "media") {
    return (
      <MediaPickerField
        name={spec.name}
        label={spec.label}
        hint={spec.hint}
        required={spec.required}
        initialValue={value === null || value === undefined ? "" : String(value)}
        errors={errors}
      />
    );
  }

  const describedBy =
    [spec.hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const common = {
    id,
    name: spec.name,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    className: cn(
      "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink",
      invalid ? "border-danger" : "border-navy-200 hover:border-navy-300",
      (spec.kind === "markdown" || spec.kind === "slug") && "font-mono text-sm",
    ),
  };

  const stringValue = value === null || value === undefined ? "" : String(value);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {spec.label}
        {spec.required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>

      {spec.kind === "textarea" || spec.kind === "markdown" ? (
        <textarea {...common} rows={spec.rows ?? 6} defaultValue={stringValue} />
      ) : spec.kind === "select" || spec.kind === "status" ? (
        <select {...common} defaultValue={stringValue}>
          {spec.kind === "select" && !spec.required ? (
            <option value="">— none —</option>
          ) : null}
          {(
            options ??
            spec.options ?? [
              { value: "draft", label: "Draft — not visible on the site" },
              { value: "published", label: "Published — live on the site" },
            ]
          ).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : spec.kind === "datetime" ? (
        <input
          {...common}
          type="datetime-local"
          // datetime-local wants "YYYY-MM-DDTHH:mm"; the API speaks ISO.
          defaultValue={stringValue ? stringValue.slice(0, 16) : ""}
        />
      ) : spec.kind === "number" ? (
        <input {...common} type="number" min={0} defaultValue={stringValue || "0"} />
      ) : (
        <input {...common} type="text" defaultValue={stringValue} />
      )}

      {spec.hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {spec.hint}
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

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-5 font-semibold text-white transition-colors hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Saving…" : isNew ? "Create" : "Save changes"}
    </button>
  );
}

/**
 * Only the serialisable parts of a ResourceSpec.
 *
 * The full spec carries a Zod schema and a `publicPath` function, and
 * neither can cross the server/client boundary — React rejects class
 * instances and functions in client component props. Those stay on the
 * server, where they are actually used.
 */
export interface FormSpec {
  slug: AdminResourceSlug;
  singular: string;
  fields: FieldSpec[];
}

export function ContentForm({
  spec,
  record,
  brandOptions,
}: {
  spec: FormSpec;
  record: Record<string, unknown> | null;
  brandOptions?: { value: string; label: string }[];
}) {
  const id = record ? Number(record.id) : null;
  const action = saveContent.bind(null, spec.slug, id);
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  // After a failed save, show what was typed rather than what was loaded.
  const source = state.values ?? record ?? {};

  return (
    <form action={formAction} className="space-y-8">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger/5 px-4 py-3 text-[0.9375rem] font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {groupFields(spec.fields).map(([section, fields]) => (
        <fieldset
          key={section}
          className="rounded-xl border border-border bg-white p-6 shadow-card"
        >
          <legend className="px-2 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
            {section}
          </legend>

          <div className="mt-2 space-y-5">
            {fields.map((field) => (
              <Field
                key={field.name}
                spec={field}
                value={source[field.name]}
                errors={state.fieldErrors?.[field.name]}
                options={field.name === "brandId" ? brandOptions : undefined}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton isNew={id === null} />
        <Link
          href={`/admin/${spec.slug}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-navy-200 bg-white px-4 text-[0.9375rem] font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
