"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setRecipeShared } from "@/app/groups/actions";

type GroupShare = { groupId: string; name: string; shared: boolean; sharesAll: boolean };

export function ShareMenu({ recipeId, groups }: { recipeId: string; groups: GroupShare[] }) {
  const [state, setState] = useState(groups);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sharedCount = state.filter((g) => g.shared || g.sharesAll).length;

  const toggle = (groupId: string, shared: boolean) => {
    setError(null);
    setState((s) => s.map((g) => (g.groupId === groupId ? { ...g, shared } : g)));
    startTransition(async () => {
      try {
        await setRecipeShared(recipeId, groupId, shared);
      } catch {
        setState((s) => s.map((g) => (g.groupId === groupId ? { ...g, shared: !shared } : g)));
        setError("Couldn't update sharing. Try again.");
      }
    });
  };

  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none rounded-full border border-border px-5 py-2.5 font-medium hover:bg-accent-soft [&::-webkit-details-marker]:hidden">
        Share{sharedCount > 0 && ` · ${sharedCount}`}
      </summary>
      <div className="absolute left-0 z-10 mt-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-lg">
        {state.length === 0 ? (
          <p className="text-sm text-muted">
            You&apos;re not in any groups yet.{" "}
            <Link href="/groups" className="font-medium text-accent hover:underline">
              Create one
            </Link>{" "}
            to share recipes with family and friends.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium">Share with</p>
            <ul className="space-y-1">
              {state.map((g) => (
                <li key={g.groupId}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-accent-soft/60">
                    <input
                      type="checkbox"
                      checked={g.shared || g.sharesAll}
                      disabled={g.sharesAll || pending}
                      onChange={(e) => toggle(g.groupId, e.target.checked)}
                      className="mt-1 size-4 shrink-0 accent-accent"
                    />
                    <span>
                      {g.name}
                      {g.sharesAll && (
                        <span className="block text-xs text-muted">You share all your recipes here</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      </div>
    </details>
  );
}
