import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { PrintButton } from "@/components/print-button";
import { RecipeView } from "@/components/recipe-view";
import { getMyRecipe } from "@/lib/recipes-data";

export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/recipes" className="text-sm text-muted hover:text-foreground print:hidden">
        ← My recipes
      </Link>
      <div className="mt-4">
        <Suspense fallback={<p className="text-muted">Loading recipe…</p>}>
          <SavedRecipe params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function SavedRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getMyRecipe(id);
  if (!recipe) notFound();

  return (
    <RecipeView
      recipe={recipe}
      actions={
        <>
          <PrintButton />
          <DeleteRecipeButton id={recipe.id} />
        </>
      }
    />
  );
}
