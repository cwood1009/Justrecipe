import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JoinButton } from "@/components/join-button";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a group — JustRecipe" };

export default function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Suspense fallback={<p className="text-muted">Loading invite…</p>}>
        <Invite params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Invite({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const failed = (await searchParams).error === "1";
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([
    supabase.rpc("get_group_invite", { code }),
    getCurrentUser(),
  ]);
  const group = (data as { id: string; name: string; member_count: number }[] | null)?.[0];

  if (!group) {
    return (
      <>
        <h1 className="font-serif text-3xl font-semibold">Invite not found</h1>
        <p className="mt-3 text-muted">
          This link may be old. Ask whoever sent it for a new one.
        </p>
      </>
    );
  }

  const next = `/join/${code}`;
  return (
    <>
      <p className="text-sm font-medium uppercase tracking-wide text-accent">You&apos;re invited</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">{group.name}</h1>
      <p className="mt-2 text-muted">
        {group.member_count} {group.member_count === 1 ? "member" : "members"} sharing recipes
      </p>
      {failed && <p className="mt-4 text-sm text-accent">Couldn&apos;t join. Please try again.</p>}
      <div className="mt-8">
        {user ? (
          <JoinButton code={code} />
        ) : (
          <div className="flex flex-col gap-3">
            <Link
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-hover"
            >
              Create an account to join
            </Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-accent hover:underline">
              I already have an account
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
