import "server-only";
import { redirect } from "next/navigation";
import { rowToRecipe, type RecipeRow } from "./recipe";
import { createClient, getCurrentUser } from "./supabase/server";

async function requireUserClient() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/recipes");
  return createClient();
}

export async function listMyRecipes() {
  const supabase = await requireUserClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RecipeRow[]).map(rowToRecipe);
}

export async function getMyRecipe(id: string) {
  const supabase = await requireUserClient();
  // Row-level security limits this to the signed-in user's recipes.
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error && error.code !== "22P02") throw error; // 22P02: id isn't a valid uuid
  return data ? rowToRecipe(data as RecipeRow) : null;
}
