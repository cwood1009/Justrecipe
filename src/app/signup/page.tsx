import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account — JustRecipe" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-serif text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-center text-muted">Save recipes and find them again from any device.</p>
      <div className="mt-8 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </div>
  );
}
