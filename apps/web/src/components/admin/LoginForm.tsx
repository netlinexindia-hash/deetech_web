"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-5 font-semibold text-white transition-colors hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-h3">Sign in</h2>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger/5 px-3.5 py-2.5 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-navy-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-navy-200 px-3.5 py-2.5 text-[0.9375rem]"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-navy-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-navy-200 px-3.5 py-2.5 text-[0.9375rem]"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
