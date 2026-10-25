"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

async function signedIn(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user, supabase: await createClient() };
}

export type GroupFormState = { error?: string } | undefined;

export async function createGroup(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give your group a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const { supabase } = await signedIn("/groups");
  const { data, error } = await supabase.rpc("create_group", { group_name: name });
  if (error || !data) {
    console.error("Creating group failed", error);
    return { error: "Couldn't create the group. Please try again." };
  }
  redirect(`/groups/${data}`);
}

export async function joinGroup(code: string) {
  const { supabase } = await signedIn(`/join/${code}`);
  const { data, error } = await supabase.rpc("join_group", { code });
  if (error || !data) {
    console.error("Joining group failed", error);
    redirect(`/join/${code}?error=1`);
  }
  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

export async function leaveGroup(groupId: string) {
  const { user, supabase } = await signedIn(`/groups/${groupId}`);
  const { error } = await supabase.rpc("remove_group_member", { gid: groupId, member: user.id });
  if (error) throw new Error("Couldn't leave the group.");
  revalidatePath("/groups");
  redirect("/groups");
}

export async function removeMember(groupId: string, memberId: string) {
  const { supabase } = await signedIn(`/groups/${groupId}`);
  const { error } = await supabase.rpc("remove_group_member", { gid: groupId, member: memberId });
  if (error) throw new Error("Couldn't remove that member.");
  revalidatePath(`/groups/${groupId}`);
}

export async function resetInvite(groupId: string) {
  const { supabase } = await signedIn(`/groups/${groupId}`);
  const { error } = await supabase.rpc("reset_group_invite", { gid: groupId });
  if (error) throw new Error("Couldn't reset the invite link.");
  revalidatePath(`/groups/${groupId}`);
}

export async function setShareAll(groupId: string, shareAll: boolean) {
  const { user, supabase } = await signedIn(`/groups/${groupId}`);
  const { error } = await supabase
    .from("group_members")
    .update({ share_all: shareAll })
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) throw new Error("Couldn't update that setting.");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
}

export async function setRecipeShared(recipeId: string, groupId: string, shared: boolean) {
  const { user, supabase } = await signedIn(`/recipes/${recipeId}`);
  const { error } = shared
    ? await supabase
        .from("group_recipes")
        .upsert({ group_id: groupId, recipe_id: recipeId, shared_by: user.id }, { ignoreDuplicates: true })
    : await supabase.from("group_recipes").delete().eq("group_id", groupId).eq("recipe_id", recipeId);
  if (error) {
    console.error("Updating share failed", error);
    throw new Error("Couldn't update sharing.");
  }
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/groups/${groupId}`);
}
