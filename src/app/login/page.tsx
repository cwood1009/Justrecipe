import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in — JustRecipe" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-serif text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-center text-muted">Sign in to see your saved recipes.</p>
      <div className="mt-8 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
