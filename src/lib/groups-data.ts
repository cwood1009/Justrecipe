import "server-only";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "./supabase/server";

export type GroupSummary = {
  id: string;
  name: string;
  role: "owner" | "member";
  shareAll: boolean;
  memberCount: number;
};

export type GroupMember = {
  userId: string;
  email: string;
  role: "owner" | "member";
  shareAll: boolean;
};

export type GroupRecipeCard = {
  id: string;
  title: string;
  siteName: string | null;
  imageUrl: string | null;
  totalTime: string | null;
  sharedBy: string;
  isMine: boolean;
};

async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user, supabase: await createClient() };
}

export async function listMyGroups(): Promise<GroupSummary[]> {
  const { user, supabase } = await requireUser("/groups");
  const { data, error } = await supabase
    .from("group_members")
    .select("role, share_all, groups(id, name, group_members(count))")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });
  if (error) throw error;

  type Row = {
    role: "owner" | "member";
    share_all: boolean;
    groups: { id: string; name: string; group_members: { count: number }[] } | null;
  };
  return (data as unknown as Row[])
    .filter((row) => row.groups)
    .map((row) => ({
      id: row.groups!.id,
      name: row.groups!.name,
      role: row.role,
      shareAll: row.share_all,
      memberCount: row.groups!.group_members[0]?.count ?? 1,
    }));
}

export async function getGroup(id: string) {
  const { user, supabase } = await requireUser(`/groups/${id}`);

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, invite_code")
    .eq("id", id)
    .maybeSingle();
  if (error && error.code !== "22P02") throw error;
  if (!group) return null;

  const [{ data: memberRows, error: membersError }, { data: recipeRows, error: recipesError }] =
    await Promise.all([
      supabase
        .from("group_members")
        .select("user_id, email, role, share_all")
        .eq("group_id", id)
        .order("joined_at", { ascending: true }),
      supabase.rpc("get_group_recipes", { gid: id }),
    ]);
  if (membersError) throw membersError;
  if (recipesError) throw recipesError;

  const members: GroupMember[] = (memberRows ?? []).map((m) => ({
    userId: m.user_id,
    email: m.email,
    role: m.role,
    shareAll: m.share_all,
  }));
  const me = members.find((m) => m.userId === user.id)!;

  type RecipeRow = {
    id: string;
    title: string;
    site_name: string | null;
    image_url: string | null;
    total_time: string | null;
    owner_id: string;
    shared_by_email: string;
  };
  const recipes: GroupRecipeCard[] = ((recipeRows ?? []) as RecipeRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    siteName: r.site_name,
    imageUrl: r.image_url,
    totalTime: r.total_time,
    sharedBy: displayName(r.shared_by_email),
    isMine: r.owner_id === user.id,
  }));

  return {
    id: group.id as string,
    name: group.name as string,
    // Only owners can hand out the invite link.
    inviteCode: me.role === "owner" ? (group.invite_code as string) : null,
    me,
    members,
    recipes,
  };
}

/** The groups a recipe can be shared with, and whether it already is. */
export async function getRecipeSharing(recipeId: string) {
  const { user, supabase } = await requireUser(`/recipes/${recipeId}`);
  const [{ data: memberships, error }, { data: shares, error: sharesError }] = await Promise.all([
    supabase
      .from("group_members")
      .select("share_all, groups(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true }),
    supabase.from("group_recipes").select("group_id").eq("recipe_id", recipeId),
  ]);
  if (error) throw error;
  if (sharesError) throw sharesError;

  const sharedWith = new Set((shares ?? []).map((s) => s.group_id as string));
  type Row = { share_all: boolean; groups: { id: string; name: string } | null };
  return (memberships as unknown as Row[])
    .filter((m) => m.groups)
    .map((m) => ({
      groupId: m.groups!.id,
      name: m.groups!.name,
      shared: sharedWith.has(m.groups!.id),
      sharesAll: m.share_all,
    }));
}

/** Who shared a recipe, shown to people who aren't its owner. */
export async function getMemberEmail(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("email")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.email ? displayName(data.email) : null;
}

export function displayName(email: string): string {
  return email.split("@")[0] || "A member";
}
