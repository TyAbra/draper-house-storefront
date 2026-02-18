"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";

const INITIAL_STATE: LoginState = {
  error: null,
};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-medium text-[var(--dh-wood)]">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-[var(--dh-walnut)] px-4 py-3 text-base font-medium text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>

      {state.error && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-sm text-[var(--dh-terracotta)]">{state.error}</p>
      )}
    </form>
  );
}
