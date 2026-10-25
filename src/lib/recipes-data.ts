import "server-only";
import { redirect } from "next/navigation";
import { rowToRecipe, type RecipeRow } from "./recipe";
import { createClient, getCurrentUser } from "./supabase/server";

async function requireUser(next = "/recipes") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user, supabase: await createClient() };
}

export async function listMyRecipes() {
  const { user, supabase } = await requireUser();
  // Filter by owner: row-level security also returns recipes shared with your groups.
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RecipeRow[]).map(rowToRecipe);
}

/** A recipe you own or one shared with one of your groups. */
export async function getRecipe(id: string) {
  const { user, supabase } = await requireUser(`/recipes/${id}`);
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error && error.code !== "22P02") throw error; // 22P02: id isn't a valid uuid
  if (!data) return null;
  const row = data as RecipeRow;
  return { recipe: rowToRecipe(row), ownerId: row.user_id, isOwner: row.user_id === user.id };
}
