"use client";

import { useActionState } from "react";
import { createGroup } from "@/app/groups/actions";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, undefined);
  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
      <label htmlFor="group-name" className="sr-only">
        Group name
      </label>
      <input
        id="group-name"
        name="name"
        required
        maxLength={80}
        placeholder="e.g. The Smith family"
        className="min-w-0 flex-1 rounded-full border border-border bg-background px-5 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
      {state?.error && <p className="text-sm text-accent sm:basis-full">{state.error}</p>}
    </form>
  );
}
