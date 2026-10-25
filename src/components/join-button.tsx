"use client";

import { useTransition } from "react";
import { joinGroup } from "@/app/groups/actions";

export function JoinButton({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => joinGroup(code))}
      className="w-full rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? "Joining…" : "Join group"}
    </button>
  );
}
