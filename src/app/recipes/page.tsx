import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RecipeGrid } from "@/components/recipe-grid";
import { listMyRecipes } from "@/lib/recipes-data";

export const metadata: Metadata = { title: "My recipes — JustRecipe" };

export default function RecipesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">My recipes</h1>
        <Link
          href="/"
          className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
        >
          + Add a recipe
        </Link>
      </div>
      <Suspense fallback={<p className="mt-10 text-muted">Loading your recipes…</p>}>
        <Recipes />
      </Suspense>
    </div>
  );
}

async function Recipes() {
  const recipes = await listMyRecipes();

  if (recipes.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border p-10 text-center">
        <p className="font-serif text-xl">No saved recipes yet.</p>
        <p className="mt-2 text-muted">
          Paste a recipe link on the <Link href="/" className="text-accent hover:underline">home page</Link> and
          hit &ldquo;Save recipe&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <RecipeGrid
      recipes={recipes.map((r) => ({
        id: r.id,
        title: r.title,
        siteName: r.siteName,
        imageUrl: r.imageUrl,
        totalTime: r.totalTime,
      }))}
    />
  );
}
