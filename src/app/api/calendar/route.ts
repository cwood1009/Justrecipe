import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { buildIcs, parseStamp, recipeEvent } from "@/lib/calendar";
import { extractRecipe } from "@/lib/extract";
import { rowToRecipe, type Recipe, type RecipeRow } from "@/lib/recipe";
import { fetchPublicPage } from "@/lib/safe-fetch";
import { createClient } from "@/lib/supabase/server";

// Serves a one-event .ics file. iPhone Safari opens it straight into Calendar.
// The event comes from a saved recipe or the recipe's own page, never from
// free text in the link, so nobody can use it to serve made-up events.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = parseStamp(params.get("start") ?? "");
  if (!start) return text("That calendar link is missing a valid time.", 400);

  let recipe: Recipe | null = null;
  const id = params.get("recipe");
  const source = params.get("source");
  if (id) {
    // Row-level security: only the owner or their group members can read it.
    const supabase = await createClient();
    const { data } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
    recipe = data ? rowToRecipe(data as RecipeRow) : null;
    if (!recipe) return text("Recipe not found. Sign in and try again.", 404);
  } else if (source) {
    try {
      const page = await fetchPublicPage(source);
      recipe = extractRecipe(page.html, page.url);
    } catch {
      return text("Couldn't read that recipe right now. Try the Google Calendar option instead.", 422);
    }
  } else {
    return text("That calendar link is missing its recipe.", 400);
  }

  const event = recipeEvent(recipe, start);
  const ics = buildIcs(event, `${randomUUID()}@justrecipe`);
  const filename = recipe.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "recipe";
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
