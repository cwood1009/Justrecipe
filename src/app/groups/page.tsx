import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreateGroupForm } from "@/components/create-group-form";
import { listMyGroups } from "@/lib/groups-data";

export const metadata: Metadata = { title: "Groups — JustRecipe" };

export default function GroupsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Groups</h1>
      <p className="mt-2 text-muted">
        Share recipes with family and friends. Everyone in a group sees the recipes its members share.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading your groups…</p>}>
        <GroupList />
      </Suspense>
      <section className="mt-10 rounded-3xl border border-border bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold">Start a new group</h2>
        <p className="mt-1 text-sm text-muted">
          You&apos;ll get an invite link to send to the people you want in it.
        </p>
        <CreateGroupForm />
      </section>
    </div>
  );
}

async function GroupList() {
  const groups = await listMyGroups();
  if (groups.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center text-muted">
        You&apos;re not in any groups yet. Start one below, or open an invite link someone sent you.
      </p>
    );
  }
  return (
    <ul className="mt-8 space-y-3">
      {groups.map((g) => (
        <li key={g.id}>
          <Link
            href={`/groups/${g.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm hover:shadow-md"
          >
            <span>
              <span className="font-serif text-lg font-semibold">{g.name}</span>
              <span className="block text-sm text-muted">
                {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                {g.role === "owner" && " · You manage this group"}
              </span>
            </span>
            <span aria-hidden className="text-muted">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
