"use client";

import { useState, useTransition } from "react";
import { leaveGroup, removeMember, setShareAll } from "@/app/groups/actions";

export function GroupControls({
  groupId,
  shareAll,
  isOwner,
}: {
  groupId: string;
  shareAll: boolean;
  isOwner: boolean;
}) {
  const [checked, setChecked] = useState(shareAll);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            startTransition(async () => {
              try {
                await setShareAll(groupId, next);
              } catch {
                setChecked(!next);
              }
            });
          }}
          className="mt-1 size-4 shrink-0 accent-accent"
        />
        <span>
          <span className="font-medium">Share all my recipes</span>
          <span className="block text-sm text-muted">
            Everything you save, now and later, shows up here. Turn it off to pick recipes one at a time.
          </span>
        </span>
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const warning = isOwner
            ? "Leave this group? Your shared recipes will be removed from it, and another member will become the owner. If you're the only member, the group is deleted."
            : "Leave this group? Your shared recipes will be removed from it.";
          if (confirm(warning)) startTransition(() => leaveGroup(groupId));
        }}
        className="mt-4 text-sm text-muted hover:text-accent"
      >
        Leave group
      </button>
    </section>
  );
}

export function RemoveMemberButton({
  groupId,
  memberId,
  name,
}: {
  groupId: string;
  memberId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Remove ${name} from the group? Recipes they shared will be removed too.`)) {
          startTransition(() => removeMember(groupId, memberId));
        }
      }}
      className="shrink-0 text-xs text-muted hover:text-accent disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
