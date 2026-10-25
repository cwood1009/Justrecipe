"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, signUp } from "@/app/auth/actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const confirmFailed = searchParams.get("error") === "confirm";
  const [state, formAction, pending] = useActionState(mode === "login" ? signIn : signUp, undefined);

  const isLogin = mode === "login";
  const otherHref = `${isLogin ? "/signup" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  if (state?.message) {
    return (
      <div className="rounded-2xl bg-accent-soft px-5 py-4 text-center" role="status">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {confirmFailed && !state?.error && (
        <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm">
          That confirmation link is invalid or has expired. Try signing in, or create your account again.
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 8}
          required
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {!isLogin && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "One moment…" : isLogin ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link href={otherHref} className="font-medium text-accent hover:underline">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
