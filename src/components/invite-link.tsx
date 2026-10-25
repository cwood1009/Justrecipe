"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { resetInvite } from "@/app/groups/actions";

export function InviteLink({ groupId, code }: { groupId: string; code: string }) {
  // The link uses whichever address the site is open on (preview or production).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const link = `${origin}/join/${code}`;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Invite people</h2>
      <p className="mt-1 text-sm text-muted">Anyone with this link can join after signing in.</p>
      <input
        readOnly
        value={link}
        onFocus={(e) => e.target.select()}
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        aria-label="Invite link"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Make a new invite link? The old one will stop working.")) {
              startTransition(() => resetInvite(groupId));
            }
          }}
          className="rounded-full px-4 py-2 text-sm text-muted hover:bg-accent-soft disabled:opacity-60"
        >
          {pending ? "Resetting…" : "New link"}
        </button>
      </div>
    </section>
  );
}
