"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-alt p-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-card bg-surface p-8 shadow-sm ring-1 ring-black/5"
      >
        <h1 className="text-xl font-semibold">Studio CMS</h1>
        <p className="mt-1 text-sm text-muted">Sign in to manage your sites.</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-btn border border-black/10 px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-btn border border-black/10 px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {state.error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-btn bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
