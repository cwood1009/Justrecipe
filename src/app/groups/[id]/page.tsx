import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GroupControls, RemoveMemberButton } from "@/components/group-controls";
import { InviteLink } from "@/components/invite-link";
import { RecipeGrid } from "@/components/recipe-grid";
import { displayName, getGroup } from "@/lib/groups-data";

export default function GroupPage({ params }: PageProps<"/groups/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/groups" className="text-sm text-muted hover:text-foreground">
        ← Groups
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading group…</p>}>
        <Group params={params} />
      </Suspense>
    </div>
  );
}

async function Group({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();
  const isOwner = group.me.role === "owner";

  return (
    <>
      <h1 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">{group.name}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <h2 className="font-serif text-xl font-semibold">Shared recipes</h2>
          {group.recipes.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-border p-8 text-center text-muted">
              <p>No recipes shared yet.</p>
              <p className="mt-1 text-sm">
                Open one of <Link href="/recipes" className="text-accent hover:underline">your recipes</Link> and
                use Share, or turn on &ldquo;Share all my recipes&rdquo;.
              </p>
            </div>
          ) : (
            <RecipeGrid
              recipes={group.recipes.map((r) => ({
                ...r,
                byline: `Shared by ${r.isMine ? "you" : r.sharedBy}`,
              }))}
            />
          )}
        </section>

        <aside className="space-y-6">
          <GroupControls groupId={group.id} shareAll={group.me.shareAll} isOwner={isOwner} />

          {group.inviteCode && <InviteLink groupId={group.id} code={group.inviteCode} />}

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold">Members</h2>
            <ul className="mt-3 space-y-2">
              {group.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate" title={m.email}>
                    {displayName(m.email)}
                    {m.userId === group.me.userId && <span className="text-muted"> (you)</span>}
                    {m.role === "owner" && <span className="ml-1 text-xs text-accent">owner</span>}
                  </span>
                  {isOwner && m.userId !== group.me.userId && (
                    <RemoveMemberButton groupId={group.id} memberId={m.userId} name={displayName(m.email)} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
