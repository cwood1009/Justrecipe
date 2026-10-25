"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { extractRecipe, NoRecipeError } from "@/lib/extract";
import { recordFailure } from "@/lib/failure-queue";
import { recipeToRow, type InstructionSection, type Recipe } from "@/lib/recipe";
import { FetchError, fetchPublicPage } from "@/lib/safe-fetch";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type ExtractResult =
  | { ok: true; recipe: Recipe; savedId: string | null }
  | { ok: false; error: string };

export async function extractRecipeFromUrl(input: string): Promise<ExtractResult> {
  let url = input.trim();
  if (!url) return { ok: false, error: "Paste a link to a recipe." };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let pageUrl = url;
  try {
    const page = await fetchPublicPage(url);
    pageUrl = page.url;
    const recipe = extractRecipe(page.html, page.url);
    return { ok: true, recipe, savedId: await findSavedId(recipe.sourceUrl) };
  } catch (err) {
    // Queue real misses for analysis, after the response so the user isn't kept waiting.
    if (err instanceof NoRecipeError) {
      after(() => recordFailure(pageUrl, "no_recipe", err.message));
      return { ok: false, error: err.message };
    }
    if (err instanceof FetchError) {
      if (err.kind === "blocked") after(() => recordFailure(pageUrl, "blocked", err.message));
      return { ok: false, error: err.message };
    }
    console.error("Recipe extraction failed", err);
    after(() => recordFailure(pageUrl, "error", err instanceof Error ? err.message : String(err)));
    return { ok: false, error: "Something went wrong reading that page." };
  }
}

async function findSavedId(sourceUrl: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("id")
    .eq("user_id", user.id)
    .eq("source_url", sourceUrl)
    .maybeSingle();
  return data?.id ?? null;
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string; needsLogin?: boolean };

export async function saveRecipe(input: Recipe): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save recipes.", needsLogin: true };

  const recipe = sanitizeRecipe(input);
  if (!recipe) return { ok: false, error: "That recipe couldn't be saved." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .upsert({ ...recipeToRow(recipe), user_id: user.id }, { onConflict: "user_id,source_url" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Saving recipe failed", error);
    return { ok: false, error: "Couldn't save the recipe. Please try again." };
  }

  revalidatePath("/recipes");
  return { ok: true, id: data.id };
}

export async function deleteRecipe(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("Deleting recipe failed", error);
    throw new Error("Couldn't delete the recipe.");
  }

  revalidatePath("/recipes");
  redirect("/recipes");
}

// The recipe comes back from the browser, so re-check its shape before storing it.
function sanitizeRecipe(input: unknown): Recipe | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;

  const str = (v: unknown, max = 2000) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const httpUrl = (v: unknown) => {
    const s = str(v);
    if (!s) return null;
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  };
  const strList = (v: unknown, maxItems = 300) =>
    Array.isArray(v)
      ? v.map((x) => str(x)).filter((x): x is string => x !== null).slice(0, maxItems)
      : [];

  const sourceUrl = httpUrl(r.sourceUrl);
  const title = str(r.title, 300);
  if (!sourceUrl || !title) return null;

  const instructions: InstructionSection[] = Array.isArray(r.instructions)
    ? r.instructions
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({ name: str(s.name, 300), steps: strList(s.steps) }))
        .filter((s) => s.steps.length > 0)
        .slice(0, 50)
    : [];

  return {
    title,
    sourceUrl,
    description: str(r.description, 5000),
    imageUrl: httpUrl(r.imageUrl),
    siteName: str(r.siteName, 300),
    author: str(r.author, 300),
    yield: str(r.yield, 100),
    prepTime: str(r.prepTime, 100),
    cookTime: str(r.cookTime, 100),
    totalTime: str(r.totalTime, 100),
    ingredients: strList(r.ingredients),
    instructions,
  };
}
